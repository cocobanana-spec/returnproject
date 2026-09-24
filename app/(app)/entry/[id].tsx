// 기록 상세·편집(S10) — 금액·형태·참석·측·답례·메모를 고친다
//
// 방향(준돈/받은돈)은 컬럼이 아니라 소속 행사의 is_mine에서 파생되므로 여기서 바꿀 수 없다.
// 표시만 한다(docs/03 결정 5). 입력자는 구성원이 2명 이상일 때만 보여 준다.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  METHODS,
  METHOD_LABEL,
  type DatePrecision,
  type Method,
  type Side,
} from '../../../src/domain/constants.ts';
import { directionLabel, entrySubtitle } from '../../../src/domain/entry.ts';
import { allowsMissingAmount, formatWon, parseAmountInput } from '../../../src/domain/money.ts';
import { useAuth } from '../../../src/auth/AuthProvider';
import { useLedgerId } from '../../../src/ledger/LedgerProvider';
import { queryKeys } from '../../../src/lib/queryKeys';
import { deleteEntry, getEntry, updateEntry } from '../../../src/repositories/entries';
import { listMembers } from '../../../src/repositories/ledgers';
import { useTokens } from '../../../src/theme/tokens';
import { Button } from '../../../src/ui/Button';
import { Chip } from '../../../src/ui/Chip';
import { EmptyState } from '../../../src/ui/EmptyState';
import { Field } from '../../../src/ui/Field';
import { Screen } from '../../../src/ui/Screen';

// 금액 해석은 parseAmountInput 하나로만 한다. Number()를 따로 쓰면 "12,000" 같은 입력에서
// 힌트와 저장 결과가 어긋난다.
function amountHint(text: string): string {
  if (text.trim() === '') return '미확정으로 저장되어 합계에서 빠집니다.';
  const amount = parseAmountInput(text);
  if (amount === undefined) return '숫자로만 넣어 주세요.';
  if (amount === null) return '미확정으로 저장되어 합계에서 빠집니다.';
  return formatWon(amount);
}

export default function EntryDetailScreen() {
  const ledgerId = useLedgerId();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, space, font, radius } = useTokens();
  const { userId } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const entryId = id as string;

  const entry = useQuery({
    queryKey: queryKeys.entries.detail(ledgerId, entryId),
    queryFn: () => getEntry(ledgerId, entryId),
  });

  const members = useQuery({
    queryKey: queryKeys.ledgers.members(ledgerId),
    queryFn: () => listMembers(ledgerId),
  });

  const [amountText, setAmountText] = useState('');
  const [method, setMethod] = useState<Method>('cash');
  const [attended, setAttended] = useState<boolean | null>(null);
  const [side, setSide] = useState<Side | null>(null);
  const [returned, setReturned] = useState(false);
  const [returnMemo, setReturnMemo] = useState('');
  const [memo, setMemo] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  // 서버 값으로 폼을 채우는 것은 한 번뿐이다(1차에서 배운 규칙).
  const filled = useRef(false);
  useEffect(() => {
    const row = entry.data;
    if (!row || filled.current) return;
    filled.current = true;
    setAmountText(row.amount === null ? '' : String(row.amount));
    setMethod(row.method as Method);
    setAttended(row.attended);
    setSide(row.side as Side | null);
    setReturned(row.returned_at !== null);
    setReturnMemo(row.return_memo ?? '');
    setMemo(row.memo ?? '');
  }, [entry.data]);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['entries'] });
    void queryClient.invalidateQueries({ queryKey: ['events'] });
    void queryClient.invalidateQueries({ queryKey: ['people'] });
    void queryClient.invalidateQueries({ queryKey: ['stats'] });
  }

  const save = useMutation({
    mutationFn: async () => {
      const amount = parseAmountInput(amountText);
      if (amount === undefined) throw new Error('금액은 숫자로만 넣어 주세요.');
      if (amount === null && !allowsMissingAmount(method)) {
        throw new Error('금액을 넣거나 부조 형태를 바꿔 주세요.');
      }
      return updateEntry(ledgerId, entryId, {
        amount,
        method,
        attended,
        side,
        returned_at: returned ? (entry.data?.returned_at ?? new Date().toISOString()) : null,
        return_memo: returned ? returnMemo.trim() || null : null,
        memo: memo.trim() || null,
      });
    },
    onSuccess: () => {
      invalidate();
      router.back();
    },
    onError: (err: Error) => setErrors(err.message.split('\n')),
  });

  const remove = useMutation({
    mutationFn: () => deleteEntry(ledgerId, entryId),
    onSuccess: () => {
      invalidate();
      router.back();
    },
    onError: (err: Error) => Alert.alert('지우지 못했습니다', err.message),
  });

  if (entry.isLoading) {
    return (
      <Screen edges={{ top: false }}>
        <ActivityIndicator color={colors.textMuted} />
      </Screen>
    );
  }

  // 조회 실패를 "삭제된 기록"으로 읽으면 안 된다. 네트워크·토큰 문제도 빈 결과처럼 보인다.
  if (entry.isError) {
    return (
      <Screen edges={{ top: false }}>
        <View style={{ gap: space.md }}>
          <Text style={{ color: colors.danger, fontSize: font.body, textAlign: 'center' }}>
            기록을 불러오지 못했습니다.
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: font.caption, textAlign: 'center' }}>
            연결을 확인하고 다시 시도해 주세요. 기록이 사라진 것은 아닙니다.
          </Text>
          <Button label="다시 시도" variant="secondary" onPress={() => void entry.refetch()} />
        </View>
      </Screen>
    );
  }

  const row = entry.data;
  if (!row) {
    return (
      <Screen edges={{ top: false }}>
        <EmptyState title="기록을 찾을 수 없습니다" hint="이미 삭제되었거나 다른 장부의 기록입니다." />
      </Screen>
    );
  }

  const isMine = row.event?.is_mine ?? false;
  const hasSides = Boolean(row.event?.side_a_label);
  // 구성원이 나 혼자면 입력자를 보여 줄 이유가 없다(docs/02 §5).
  const memberList = members.data ?? [];
  const showCreator = memberList.length > 1;
  const creator = memberList.find((m) => m.user_id === row.created_by);

  return (
    <Screen scroll edges={{ top: false }}>
      <View style={{ gap: space.lg }}>
        {/* 맥락 — 누구와, 어떤 행사에서 */}
        <View style={{ backgroundColor: colors.bgSubtle, borderRadius: radius.lg, padding: space.lg }}>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: space.xs }}>
            <Text style={{ color: colors.text, fontSize: font.title, fontWeight: '700' }}>
              {row.person?.name ?? '(이름 없음)'}
            </Text>
            {row.co_person && (
              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: radius.sm,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                }}
              >
                <Text style={{ color: colors.textMuted, fontSize: font.caption - 2 }}>
                  공동 · {row.co_person.name}
                </Text>
              </View>
            )}
          </View>
          <Pressable
            onPress={() => row.event && router.push(`/event/${row.event.id}`)}
            style={{ alignItems: 'center', flexDirection: 'row', gap: space.xs, marginTop: space.xs }}
          >
            <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
              {row.event?.title ?? '(행사 없음)'} · {entrySubtitle(row.event)} · {directionLabel(isMine)}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
          </Pressable>
          {showCreator && (
            <Text style={{ color: colors.textMuted, fontSize: font.caption, marginTop: space.xs }}>
              입력 · {creator ? creator.display_name : '이전 구성원'}
              {row.created_by === userId ? ' (나)' : ''}
            </Text>
          )}
        </View>

        <Field
          label="금액 (비워 두면 미확정)"
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="number-pad"
          hint={amountHint(amountText)}
        />

        <View style={{ gap: space.sm }}>
          <Text style={{ color: colors.textMuted, fontSize: font.caption }}>부조 형태</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {METHODS.map((m) => (
              <Chip key={m} label={METHOD_LABEL[m]} selected={method === m} onPress={() => setMethod(m)} />
            ))}
          </View>
        </View>

        <View style={{ gap: space.sm }}>
          <Text style={{ color: colors.textMuted, fontSize: font.caption }}>참석 여부</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Chip label="참석" selected={attended === true} onPress={() => setAttended(attended === true ? null : true)} />
            <Chip label="불참" selected={attended === false} onPress={() => setAttended(attended === false ? null : false)} />
          </View>
        </View>

        {hasSides && (
          <View style={{ gap: space.sm }}>
            <Text style={{ color: colors.textMuted, fontSize: font.caption }}>측</Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Chip label="미지정" selected={side === null} onPress={() => setSide(null)} />
              <Chip
                label={row.event?.side_a_label ?? '측 A'}
                selected={side === 'a'}
                onPress={() => setSide('a')}
              />
              {row.event?.side_b_label && (
                <Chip
                  label={row.event.side_b_label}
                  selected={side === 'b'}
                  onPress={() => setSide('b')}
                />
              )}
            </View>
          </View>
        )}

        {/* 답례는 받은돈에만 의미가 있다 */}
        {isMine && (
          <View style={{ gap: space.sm }}>
            <Text style={{ color: colors.textMuted, fontSize: font.caption }}>답례</Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Chip
                label={returned ? '답례 완료' : '답례 안 함'}
                selected={returned}
                onPress={() => setReturned((prev) => !prev)}
              />
            </View>
            {returned && (
              <Field
                value={returnMemo}
                onChangeText={setReturnMemo}
                maxLength={200}
                placeholder="답례떡 발송 5/20"
              />
            )}
          </View>
        )}

        <Field label="메모" value={memo} onChangeText={setMemo} maxLength={500} multiline />

        {errors.map((e) => (
          <Text key={e} style={{ color: colors.danger, fontSize: font.caption }}>
            {e}
          </Text>
        ))}

        <Button label="저장" onPress={() => save.mutate()} loading={save.isPending} disabled={save.isPending} />
        <Button
          label="이 기록 지우기"
          variant="secondary"
          disabled={save.isPending}
          onPress={() =>
            Alert.alert('기록 삭제', '되돌릴 수 없습니다.', [
              { text: '취소', style: 'cancel' },
              { text: '삭제', style: 'destructive', onPress: () => remove.mutate() },
            ])
          }
        />
      </View>
    </Screen>
  );
}
