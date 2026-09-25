// 받은돈 연속 입력(S09) — 이름·금액·메모만 받는다. 날짜와 종류는 행사의 것이다(2026-09-24)
//
// 측·형태·참석·공동 부조자는 입력에서 뺐다. 컬럼은 남아 있고 기본값으로 저장된다.
// S02와 같은 다단 저장 구조다. 사람(새 사람일 때) → 기록 순차 INSERT이며, 중간에 실패해도
// 이미 만든 것을 ref에 기억해 재시도가 이어서 진행한다. 행사는 이미 있으므로 2단이다.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  RELATION_GROUPS,
  RELATION_GROUP_LABEL,
  type RelationGroup,
} from '../../../src/domain/constants.ts';
import { entryRowName } from '../../../src/domain/home.ts';
import { isValidName, normalizeName } from '../../../src/domain/name.ts';
import { SAME_NAME_LABEL_ERROR } from '../../../src/domain/person.ts';
import { AMOUNT_PRESETS_WON, formatWon, formatWonShort } from '../../../src/domain/money.ts';
import {
  carryOver,
  emptyReceivingDraft,
  validateReceiving,
  type ReceivingDraft,
} from '../../../src/domain/receiving.ts';
import { useLedgerId } from '../../../src/ledger/LedgerProvider';
import { queryKeys } from '../../../src/lib/queryKeys';
import { createEntry, deleteEntry, listEntriesByEvent } from '../../../src/repositories/entries';
import { getEvent, getEventSummary } from '../../../src/repositories/events';
import { createPerson, findByNormalizedName, type PersonBalance } from '../../../src/repositories/people';
import { useTokens } from '../../../src/theme/tokens';
import { Button } from '../../../src/ui/Button';
import { Chip } from '../../../src/ui/Chip';
import { Field } from '../../../src/ui/Field';
import { LoadFailed } from '../../../src/ui/LoadFailed';
import { PersonPicker } from '../../../src/ui/PersonPicker';
import { Screen } from '../../../src/ui/Screen';

export default function ReceiveScreen() {
  const ledgerId = useLedgerId();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, space, font, radius } = useTokens();
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = id as string;

  const event = useQuery({
    queryKey: queryKeys.events.detail(ledgerId, eventId),
    queryFn: () => getEvent(ledgerId, eventId),
  });
  const summary = useQuery({
    queryKey: queryKeys.events.summary(ledgerId, eventId),
    queryFn: () => getEventSummary(ledgerId, eventId),
  });
  const recent = useQuery({
    queryKey: queryKeys.entries.byEvent(ledgerId, eventId, { recent: true }),
    queryFn: () => listEntriesByEvent(ledgerId, eventId, { limit: 8 }),
  });

  const e = event.data;

  const [draft, setDraft] = useState<ReceivingDraft>(() => emptyReceivingDraft());
  const [picked, setPicked] = useState<PersonBalance | null>(null);
  const [nameText, setNameText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  // 이번 저장에서 새로 만든 사람. 재시도가 같은 이름을 또 만들지 않게 기억한다.
  // 이름도 함께 기억해야 한다. 이름만 기억하지 않으면 사람 생성은 됐는데 기록 생성이 실패한 뒤
  // 사용자가 이름을 고쳐 다시 저장할 때, 앞 사람에게 돈이 잘못 붙는다.
  const created = useRef<{ personId: string | null; name: string | null }>({
    personId: null,
    name: null,
  });

  function patch(next: Partial<ReceivingDraft>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  // 같은 이름이 이 장부에 있는지는 서버에 정확 일치로 묻는다. S02와 같은 규칙이며,
  // 명부는 연속 입력이라 구분 칸은 이름 아래 한 줄로만 나타나고 "저장하고 다음" 뒤에 사라진다.
  const nameKey = normalizeName(nameText);
  const sameName = useQuery({
    queryKey: queryKeys.people.search(ledgerId, `same:${nameKey}`),
    queryFn: () => findByNormalizedName(ledgerId, nameKey),
    enabled: !picked && isValidName(nameText),
    gcTime: 60_000,
  });
  const needsLabel = !picked && isValidName(nameText) && (sameName.data?.length ?? 0) > 0;
  const draftForSave = (): ReceivingDraft => ({ ...draft, sameNameExists: needsLabel });

  function resetForNext(next: ReceivingDraft) {
    setDraft(next);
    setPicked(null);
    setNameText('');
    setErrors([]);
    created.current = { personId: null, name: null };
  }

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['entries'] });
    void queryClient.invalidateQueries({ queryKey: ['events'] });
    void queryClient.invalidateQueries({ queryKey: ['people'] });
    void queryClient.invalidateQueries({ queryKey: ['stats'] });
  }

  const save = useMutation({
    mutationFn: async () => {
      const validation = validateReceiving(draftForSave());
      if (!validation.ok) throw new Error(validation.errors.join('\n'));

      const newName = validation.plan.personName as string | null;
      // 직전 재시도에서 만든 사람은 "같은 이름일 때만" 다시 쓴다.
      const reusable =
        created.current.personId !== null && created.current.name === newName
          ? created.current.personId
          : null;
      let personId = draft.personId ?? reusable;
      if (!personId) {
        // 화면 판정이 실패했거나 아직 안 왔을 수 있다. 저장 직전에 서버로 한 번 더 확인한다.
        const same = await findByNormalizedName(ledgerId, normalizeName(newName as string));
        if (same.length > 0 && !validation.plan.personLabel) throw new Error(SAME_NAME_LABEL_ERROR);
        const madePerson = await createPerson(ledgerId, {
          name: newName as string,
          relation_group: draft.newPersonGroup,
          label: validation.plan.personLabel,
        });
        personId = madePerson.id;
        created.current = { personId: madePerson.id, name: newName };
      }

      // 형태는 입력에서 뺐다. 현금으로 저장한다(docs/02 §3.3, 2026-09-24).
      await createEntry(ledgerId, {
        event_id: eventId,
        person_id: personId,
        amount: validation.plan.amount,
        method: 'cash',
        memo: draft.memo.trim() || null,
      });
    },
    onSuccess: () => {
      invalidate();
      // 관계 그룹과 금액 단위는 유지하고 나머지를 비운다. 이게 속도를 만든다.
      resetForNext(carryOver(draft));
    },
    onError: (err: Error) => setErrors(err.message.split('\n')),
  });

  const removeEntry = useMutation({
    mutationFn: (entryId: string) => deleteEntry(ledgerId, entryId),
    onSuccess: invalidate,
    onError: (err: Error) => Alert.alert('지우지 못했습니다', err.message),
  });

  function onSaveNext() {
    if (save.isPending) return;
    setErrors([]);
    const validation = validateReceiving(draftForSave());
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    save.mutate();
  }

  const s = summary.data;
  const rows = recent.data?.rows ?? [];

  if (event.isLoading) {
    return (
      <Screen edges={{ top: false }}>
        <ActivityIndicator color={colors.textMuted} />
      </Screen>
    );
  }

  // 행사를 못 받은 채로 입력을 열어 두면 어느 행사에 넣는지도 모른 채 기록이 쌓인다. 막는다.
  if (event.isError || !e) {
    return (
      <Screen edges={{ top: false }}>
        <LoadFailed title="행사를 불러오지 못했습니다" onRetry={() => void event.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen scroll edges={{ top: false }}>
      <View style={{ gap: space.lg }}>
        {/* 누적 — 명부를 넣는 동안 계속 보인다 */}
        <View
          style={{
            backgroundColor: colors.bgSubtle,
            borderRadius: radius.lg,
            padding: space.lg,
          }}
        >
          <Text style={{ color: colors.textMuted, fontSize: font.caption }}>{e.title}</Text>
          <Text style={{ color: colors.text, fontSize: font.title, fontWeight: '700', marginTop: 2 }}>
            {/* 집계 실패를 "0명 · 0원"으로 찍으면 200명 넣은 사용자가 다시 넣기 시작한다 */}
            {summary.isSuccess ? `${s?.cnt ?? 0}명 · ${formatWon(s?.total ?? 0)}` : '누적을 세는 중'}
          </Text>
          {(s?.unconfirmed ?? 0) > 0 && (
            <Text style={{ color: colors.textMuted, fontSize: font.caption, marginTop: 2 }}>
              미확정 {s?.unconfirmed}건
            </Text>
          )}
        </View>

        {/* 이름 */}
        <PersonPicker
          ledgerId={ledgerId}
          label="이름"
          picked={picked}
          text={nameText}
          onChangeText={(next) => {
            setNameText(next);
            patch({ newPersonName: next, personId: null });
          }}
          onPick={(p) => {
            setPicked(p);
            patch({ personId: p.id as string, newPersonName: '' });
          }}
          onClear={() => {
            setPicked(null);
            setNameText('');
            // 다른 이름으로 바꾸는 길이라 앞 사람에게 적던 구분할 말은 같이 비운다.
            patch({ personId: null, newPersonName: '', newPersonLabel: '' });
          }}
          allowNew
          onUseNew={(name) => {
            setPicked(null);
            patch({ personId: null, newPersonName: name });
          }}
          autoFocus
        />

        {/* 같은 이름이 있을 때만 한 줄. 저장하고 다음 뒤에는 초안이 비워져 사라진다 */}
        {needsLabel && (
          <Field
            label="같은 이름이 이미 있어요. 구분할 말을 적어 주세요(예: 회사, 고등학교)"
            value={draft.newPersonLabel}
            onChangeText={(next) => patch({ newPersonLabel: next })}
            maxLength={30}
            placeholder="회사"
          />
        )}

        {/* 새 사람이면 관계 그룹 */}
        {!picked && nameText.trim().length > 0 && (
          <View style={{ gap: space.sm }}>
            <Text style={{ color: colors.textMuted, fontSize: font.caption }}>관계 (새 사람일 때)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {RELATION_GROUPS.map((g) => (
                <Chip
                  key={g}
                  label={RELATION_GROUP_LABEL[g]}
                  selected={draft.newPersonGroup === g}
                  onPress={() => patch({ newPersonGroup: g as RelationGroup })}
                />
              ))}
            </View>
          </View>
        )}

        {/* 금액 — 비우면 미확정 */}
        <View style={{ gap: space.sm }}>
          <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
            금액 (비워 두면 미확정으로 저장됩니다)
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {AMOUNT_PRESETS_WON.map((won) => (
              <Chip
                key={won}
                label={formatWonShort(won)}
                selected={draft.amountUnit === 'won' && draft.amountText === String(won)}
                onPress={() => patch({ amountText: String(won), amountUnit: 'won' })}
              />
            ))}
          </View>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: space.sm }}>
            <Field
              value={draft.amountText}
              onChangeText={(next) => patch({ amountText: next })}
              placeholder="직접 입력"
              keyboardType="number-pad"
              style={{ flex: 1, textAlign: 'right' }}
            />
            <Chip
              label={draft.amountUnit === 'manwon' ? '만원' : '원'}
              selected={draft.amountUnit === 'manwon'}
              onPress={() => patch({ amountUnit: draft.amountUnit === 'manwon' ? 'won' : 'manwon' })}
            />
          </View>
        </View>

        {/* 메모 */}
        <Field
          label="메모"
          value={draft.memo}
          onChangeText={(next) => patch({ memo: next })}
          maxLength={500}
          placeholder="봉투에 적힌 문구 …"
        />

        {errors.map((err) => (
          <Text key={err} style={{ color: colors.danger, fontSize: font.caption }}>
            {err}
          </Text>
        ))}

        <Button
          label="저장하고 다음"
          onPress={onSaveNext}
          loading={save.isPending}
          disabled={save.isPending}
        />
        <Button label="완료" variant="secondary" onPress={() => router.back()} disabled={save.isPending} />

        {/* 방금 넣은 것들 — 행을 탭하면 기록 편집(S10), X는 바로 삭제 */}
        {rows.length > 0 && (
          <View style={{ gap: space.sm }}>
            <Text style={{ color: colors.textMuted, fontSize: font.caption }}>방금 넣은 기록</Text>
            {rows.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => router.push(`/entry/${item.id}`)}
                style={({ pressed }) => ({
                  alignItems: 'center',
                  borderBottomColor: colors.border,
                  borderBottomWidth: 1,
                  flexDirection: 'row',
                  gap: space.sm,
                  paddingVertical: space.sm,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: font.body }} numberOfLines={1}>
                    {entryRowName(item.person, item.co_person)}
                  </Text>
                  {item.memo && (
                    <Text style={{ color: colors.textMuted, fontSize: font.caption, marginTop: 2 }} numberOfLines={1}>
                      {item.memo}
                    </Text>
                  )}
                </View>
                <Text
                  style={{
                    color: item.amount === null ? colors.textMuted : colors.received,
                    fontSize: font.body,
                    fontWeight: '600',
                  }}
                >
                  {formatWonShort(item.amount)}
                </Text>
                <Pressable
                  onPress={() =>
                    Alert.alert('이 기록을 지울까요', `${entryRowName(item.person, item.co_person)} · ${formatWonShort(item.amount)}`, [
                      { text: '취소', style: 'cancel' },
                      { text: '지우기', style: 'destructive', onPress: () => removeEntry.mutate(item.id) },
                    ])
                  }
                  hitSlop={8}
                >
                  <Ionicons name="close-circle-outline" size={20} color={colors.textMuted} />
                </Pressable>
              </Pressable>
            ))}
            <Pressable onPress={() => router.push(`/event/${eventId}`)}>
              <Text style={{ color: colors.textMuted, fontSize: font.caption }}>전체 보기 →</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Screen>
  );
}
