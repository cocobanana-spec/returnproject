// 기록 상세·편집(S10) — 이름·날짜·종류는 보여 주고 금액·메모를 고친다(2026-09-24 사용자 결정)
//
// 형태·참석·측·답례는 입력에서 뺐다. 저장돼 있는 값은 표시하지 않되 저장 시
// (공동 부조자는 기존 데이터를 위해 배지로 표시만 한다)
// 페이로드에 넣지 않아 덮어쓰지 않는다. 방향은 소속 행사의 is_mine에서 파생되므로 여기서
// 바꿀 수 없다. 표시만 한다(docs/03 결정 5). 입력자는 구성원이 2명 이상일 때만 보여 준다.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { confirmAction, notify } from '../../../src/lib/confirm.ts';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  amountFieldLabel,
  directionLabel,
  entrySubtitle,
  validateEntryAmount,
} from '../../../src/domain/entry.ts';
import { formatWon } from '../../../src/domain/money.ts';
import { displayName } from '../../../src/domain/person.ts';
import { useAuth } from '../../../src/auth/AuthProvider';
import { useLedgerId } from '../../../src/ledger/LedgerProvider';
import { queryKeys } from '../../../src/lib/queryKeys';
import { deleteEntry, getEntry, updateEntry } from '../../../src/repositories/entries';
import { listMembers } from '../../../src/repositories/ledgers';
import { useTokens } from '../../../src/theme/tokens';
import { Button } from '../../../src/ui/Button';
import { EmptyState } from '../../../src/ui/EmptyState';
import { Field } from '../../../src/ui/Field';
import { Screen } from '../../../src/ui/Screen';

// 금액 해석과 방향별 규칙(준돈 필수·받은돈 미확정 허용)은 도메인 함수 하나로만 한다.
function amountHint(text: string, isMine: boolean): string {
  const checked = validateEntryAmount(text, isMine);
  if (!checked.ok) return checked.error;
  if (checked.amount === null) return '미확정으로 저장되어 합계에서 빠집니다.';
  return formatWon(checked.amount);
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
  const [memo, setMemo] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  // 서버 값으로 폼을 채우는 것은 한 번뿐이다(1차에서 배운 규칙).
  const filled = useRef(false);
  useEffect(() => {
    const row = entry.data;
    if (!row || filled.current) return;
    filled.current = true;
    setAmountText(row.amount === null ? '' : String(row.amount));
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
      // 준돈은 금액 필수, 받은돈은 빈 금액이 미확정이다. 방향은 소속 행사의 is_mine에서 온다.
      const checked = validateEntryAmount(amountText, entry.data?.event?.is_mine ?? false);
      if (!checked.ok) throw new Error(checked.error);
      const amount = checked.amount;
      // 금액과 메모만 보낸다. 형태·참석·측·답례는 화면에 없으므로 저장돼 있는 값을 건드리지 않는다.
      return updateEntry(ledgerId, entryId, {
        amount,
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
    onError: (err: Error) => void notify('지우지 못했습니다', err.message),
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
              {displayName(row.person)}
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
                  공동 · {displayName(row.co_person)}
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
          label={amountFieldLabel(isMine)}
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="number-pad"
          hint={amountHint(amountText, isMine)}
        />

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
          onPress={() => {
            void confirmAction({
              title: '기록 삭제',
              message: '되돌릴 수 없습니다.',
              confirmLabel: '삭제',
              destructive: true,
            }).then((ok) => {
              if (ok) remove.mutate();
            });
          }}
        />
      </View>
    </Screen>
  );
}
