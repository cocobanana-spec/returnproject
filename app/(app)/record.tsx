// 준돈 빠른 기록(S02) — 이름·날짜·경조사 종류·금액·메모 다섯 가지만 받는다(2026-09-24 사용자 결정)
//
// 형태·참석·공동 부조자·장소는 입력에서 뺐다. 컬럼은 남아 있고 기본값으로 저장된다.
// 저장은 사람 → 행사 → 기록 순차 INSERT다. 하나의 데이터 수정 CTE로 묶으면 뒤 문장이 앞 CTE가
// 넣은 행을 보지 못해 FK와 같은 장부 트리거가 전부 실패한다(docs/03 결정 26).
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  EVENT_TYPES,
  EVENT_TYPE_LABEL,
  RELATION_GROUPS,
  RELATION_GROUP_LABEL,
  type EventType,
  type RelationGroup,
} from '../../src/domain/constants.ts';
import { AMOUNT_PRESETS_WON, formatWonShort } from '../../src/domain/money.ts';
import { normalizeName, trimName } from '../../src/domain/name.ts';
import {
  displayName,
  distinguishLine,
  duplicateNameKeys,
  sameNameCandidates,
} from '../../src/domain/person.ts';
import {
  emptyDraft,
  pickClosestEvent,
  undoPlan,
  validateQuickRecord,
  type QuickRecordDraft,
} from '../../src/domain/quickRecord.ts';
import { autoEventTitle, formatEventDate, todayISO } from '../../src/domain/title.ts';
import { useLedgerId } from '../../src/ledger/LedgerProvider';
import { queryKeys } from '../../src/lib/queryKeys';
import { createEntry, deleteEntry } from '../../src/repositories/entries';
import { createEvent, deleteEvent, findMatchingEvent, getEvent } from '../../src/repositories/events';
import {
  createPerson,
  deletePerson,
  findByNormalizedName,
  searchPeopleByPrefix,
  type PersonBalance,
} from '../../src/repositories/people';
import { useTokens } from '../../src/theme/tokens';
import { Button } from '../../src/ui/Button';
import { Chip } from '../../src/ui/Chip';
import { Field } from '../../src/ui/Field';
import { Screen } from '../../src/ui/Screen';
import { useToast } from '../../src/ui/ToastProvider';

export default function RecordScreen() {
  const ledgerId = useLedgerId();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { colors, space, font, radius } = useTokens();

  const [draft, setDraft] = useState<QuickRecordDraft>(() => emptyDraft(todayISO()));
  const [picked, setPicked] = useState<PersonBalance | null>(null);
  const [nameText, setNameText] = useState('');
  const [showDate, setShowDate] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  // 저장 판정(기존 행사 조회) 중에도 버튼을 잠근다. 두 번 누르면 기록이 두 건 생긴다.
  const [checking, setChecking] = useState(false);

  // 저장이 중간에 실패해도 이미 만들어진 것은 서버에 남는다.
  // 무엇을 만들었는지 기억해 두어야 (1) 재시도가 같은 사람을 또 만들지 않고
  // (2) 실행 취소가 새로 만든 것까지 정확히 지운다.
  // 이름도 함께 기억한다. 중간 실패 뒤 이름을 고쳐 다시 저장하면 앞 사람에게 돈이 붙는다.
  const created = useRef<{ personId: string | null; personName: string | null; eventId: string | null }>({
    personId: null,
    personName: null,
    eventId: null,
  });

  function patch(next: Partial<QuickRecordDraft>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  const prefix = normalizeName(nameText);

  const suggestions = useQuery({
    queryKey: queryKeys.people.search(ledgerId, prefix),
    queryFn: () => searchPeopleByPrefix(ledgerId, prefix),
    enabled: !picked && prefix.length > 0,
  });

  function choosePerson(person: PersonBalance) {
    setPicked(person);
    patch({ personId: person.id as string, newPersonName: '' });
    setErrors([]);
  }

  function clearPerson() {
    setPicked(null);
    setNameText('');
    patch({ personId: null, newPersonName: '', newPersonLabel: '' });
  }

  function useAsNewPerson() {
    setPicked(null);
    patch({ personId: null, newPersonName: nameText });
  }

  // 입력한 이름과 정규화가 같은 사람이 이미 있으면 새 사람에게 구분할 말이 필요하다.
  // 자동완성 결과가 실패했거나 아직 안 왔으면 같은 이름이 있는지 모르는 상태다. 그때는 저장 직전
  // 서버 재확인(mutationFn)이 막아 준다.
  const sameName = sameNameCandidates(suggestions.data ?? [], nameText);
  const needsLabel = !picked && trimName(nameText).length > 0 && sameName.length > 0;
  const draftForSave = (): QuickRecordDraft => ({ ...draft, sameNameExists: needsLabel });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['people'] });
    void queryClient.invalidateQueries({ queryKey: ['entries'] });
    void queryClient.invalidateQueries({ queryKey: ['events'] });
    void queryClient.invalidateQueries({ queryKey: ['stats'] });
  }

  // 사람 → 행사 → 기록 순차 저장. existingEventId가 있으면 행사를 새로 만들지 않는다.
  const save = useMutation({
    mutationFn: async (existingEventId: string | null) => {
      const validation = validateQuickRecord(draftForSave());
      if (!validation.ok) throw new Error(validation.errors.join('\n'));

      const newName = validation.plan.personName as string | null;
      const reusable =
        created.current.personId !== null && created.current.personName === newName
          ? created.current.personId
          : null;
      let personId = draft.personId ?? reusable;
      if (!personId) {
        // 화면의 자동완성은 8건 상한이고 실패할 수도 있다. 서버에 한 번 더 물어 같은 이름이
        // 있는데 구분할 말이 없으면 막는다. 라벨 없는 동명이인이 조용히 생기는 것을 막는 마지막 문이다.
        const same = await findByNormalizedName(ledgerId, normalizeName(newName as string));
        if (same.length > 0 && !validation.plan.personLabel) {
          throw new Error('같은 이름이 이미 있어요. 구분할 말을 적어 주세요(예: 회사, 고등학교).');
        }
        const madePerson = await createPerson(ledgerId, {
          name: newName as string,
          relation_group: draft.newPersonGroup,
          label: validation.plan.personLabel,
        });
        personId = madePerson.id;
        created.current.personId = madePerson.id;
        created.current.personName = newName;
      }

      let eventId = existingEventId ?? created.current.eventId;
      let eventTitle = '';
      if (!eventId) {
        const hostName = picked?.name ?? validation.plan.personName ?? '';
        eventTitle = autoEventTitle({
          type: draft.type as EventType,
          isMine: false,
          hostName,
          date: draft.date,
        });
        const madeEvent = await createEvent(ledgerId, {
          type: draft.type as EventType,
          is_mine: false,
          host_person_id: personId,
          title: eventTitle,
          date: draft.date,
        });
        eventId = madeEvent.id;
        created.current.eventId = madeEvent.id;
      } else {
        eventTitle = (await getEvent(ledgerId, eventId))?.title ?? '';
      }

      // 형태는 입력에서 뺐다. 현금으로 저장한다(docs/02 §3.2, 2026-09-24).
      const entry = await createEntry(ledgerId, {
        event_id: eventId,
        person_id: personId,
        amount: validation.plan.amount,
        method: 'cash',
        memo: draft.memo.trim() || null,
      });

      return {
        refs: { ...created.current, entryId: entry.id },
        amount: validation.plan.amount,
        eventTitle,
      };
    },
    onSuccess: ({ refs, amount, eventTitle }) => {
      invalidate();
      const step = undoPlan(refs);
      created.current = { personId: null, personName: null, eventId: null };
      toast.show({
        message: `${eventTitle} · ${formatWonShort(amount)} 저장했습니다`,
        actionLabel: '실행 취소',
        onAction: () => void undoSave(step),
      });
      router.back();
    },
    // 실패해도 시트를 닫지 않는다. 폼을 그대로 두고 다시 시도할 수 있게 한다(docs/02 §5 오프라인).
    onError: (e: Error) => setErrors(e.message.split('\n')),
  });

  async function undoSave(step: { kind: 'person' | 'event' | 'entry'; id: string }) {
    try {
      if (step.kind === 'person') await deletePerson(ledgerId, step.id);
      else if (step.kind === 'event') await deleteEvent(ledgerId, step.id);
      else await deleteEntry(ledgerId, step.id);
      invalidate();
      toast.show({ message: '기록을 되돌렸습니다', durationMs: 2500 });
    } catch (error) {
      toast.show({ message: `되돌리지 못했습니다 · ${(error as Error).message}`, durationMs: 4000 });
    }
  }

  // 저장 전에 같은 당사자·같은 종류·±7일 행사가 있는지 본다. 기록이 0건인 예정 행사도 잡힌다.
  async function onSave() {
    if (checking || save.isPending) return;
    setErrors([]);
    const validation = validateQuickRecord(draftForSave());
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }

    // 이미 이번 저장에서 행사를 만들었으면 다시 묻지 않는다(중간 실패 후 재시도).
    if (draft.personId && draft.type && !created.current.eventId) {
      setChecking(true);
      try {
        const matches = await findMatchingEvent(ledgerId, {
          hostPersonId: draft.personId,
          type: draft.type,
          date: draft.date,
        });
        const best = pickClosestEvent(matches, draft.date);
        if (best) {
          Alert.alert('이미 있는 행사예요', `"${best.title}"에 이 기록을 추가할까요?`, [
            { text: '취소', style: 'cancel' },
            { text: '새 행사로', onPress: () => save.mutate(null) },
            { text: '기존에 추가', onPress: () => save.mutate(best.id) },
          ]);
          return;
        }
      } catch (error) {
        // 조회가 실패했는데 그냥 진행하면 같은 행사를 하나 더 만든다. 멈추고 알린다.
        setErrors([`기존 행사를 확인하지 못했습니다. 다시 시도해 주세요.\n${(error as Error).message}`]);
        return;
      } finally {
        setChecking(false);
      }
    }
    save.mutate(null);
  }

  function NewPersonRow() {
    return (
      <Pressable
        onPress={useAsNewPerson}
        style={({ pressed }) => ({
          justifyContent: 'center',
          minHeight: 44,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text style={{ color: colors.given, fontSize: font.body, fontWeight: '600' }}>
          “{trimName(nameText)}” 새 사람으로 추가
        </Text>
      </Pressable>
    );
  }

  const showSuggestions = !picked;
  // 최근 기록한 사람 칩은 사용자 요청(2026-09-25)으로 뺐다. 입력에 따른 자동완성만 남긴다.
  const list = prefix.length > 0 ? (suggestions.data ?? []) : [];
  const dupKeys = duplicateNameKeys(list);

  return (
    <Screen scroll edges={{ top: false }}>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Text style={{ color: colors.text, fontSize: font.body }}>취소</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="가져오기"
              hitSlop={8}
              onPress={() => router.push('/import?target=given')}
            >
              <Ionicons name="cloud-upload-outline" size={22} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      <View style={{ gap: space.xl }}>
        {/* 1. 이름 */}
        <View style={{ gap: space.sm }}>
          <Text style={{ color: colors.textMuted, fontSize: font.caption }}>누구에게 냈나요</Text>
          {picked ? (
            <Pressable
              onPress={clearPerson}
              style={{
                alignItems: 'center',
                backgroundColor: colors.bgSubtle,
                borderRadius: radius.md,
                flexDirection: 'row',
                gap: space.sm,
                paddingHorizontal: space.lg,
                paddingVertical: space.md,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '600' }}>
                  {displayName(picked)}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: font.caption, marginTop: 2 }}>
                  {distinguishLine(picked)}
                </Text>
              </View>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </Pressable>
          ) : (
            <>
              <TextInput
                value={nameText}
                onChangeText={(next) => {
                  setNameText(next);
                  patch({ newPersonName: next, personId: null });
                }}
                placeholder="이름"
                placeholderTextColor={colors.textMuted}
                autoFocus
                autoCorrect={false}
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  color: colors.text,
                  fontSize: font.title,
                  paddingHorizontal: space.lg,
                  paddingVertical: space.md,
                }}
              />

              {showSuggestions && prefix.length > 0 && (
                <View style={{ gap: space.xs }}>
                  {suggestions.isError ? (
                    // 조회 실패를 "그런 사람 없음"으로 읽으면 이미 있는 사람을 또 만들게 된다.
                    <Text style={{ color: colors.danger, fontSize: font.caption }}>
                      이름을 확인하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.
                    </Text>
                  ) : (
                    <>
                      {list.length === 0 && !suggestions.isFetching && <NewPersonRow />}
                      {list.map((p) => (
                        <Pressable
                          key={p.id}
                          onPress={() => choosePerson(p)}
                          style={({ pressed }) => ({
                            borderBottomColor: colors.border,
                            borderBottomWidth: 1,
                            paddingVertical: space.sm,
                            opacity: pressed ? 0.6 : 1,
                          })}
                        >
                          <Text style={{ color: colors.text, fontSize: font.body }}>{displayName(p)}</Text>
                          <Text style={{ color: colors.textMuted, fontSize: font.caption, marginTop: 2 }}>
                            {distinguishLine(p, dupKeys)}
                          </Text>
                        </Pressable>
                      ))}
                      {/* 동명이인은 허용된다(docs/02 §5). 일치가 있어도 새로 만드는 길을 막지 않는다 */}
                      {list.length > 0 && <NewPersonRow />}
                    </>
                  )}
                </View>
              )}

              {/* 같은 이름이 이미 있을 때만 나타나는 구분 칸. 다섯 필드 화면은 그대로다 */}
              {needsLabel && (
                <Field
                  label="같은 이름이 이미 있어요. 구분할 말을 적어 주세요(예: 회사, 고등학교)"
                  value={draft.newPersonLabel}
                  onChangeText={(next) => patch({ newPersonLabel: next })}
                  maxLength={30}
                  placeholder="회사"
                />
              )}

              {!picked && trimName(nameText).length > 0 && (
                <View style={{ gap: space.sm, marginTop: space.sm }}>
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
            </>
          )}
        </View>

        {/* 2. 날짜 */}
        <View style={{ gap: space.sm }}>
          <Text style={{ color: colors.textMuted, fontSize: font.caption }}>날짜</Text>
          <Pressable
            onPress={() => setShowDate((prev) => !prev)}
            style={{
              borderColor: colors.border,
              borderRadius: radius.md,
              borderWidth: 1,
              paddingHorizontal: space.lg,
              paddingVertical: space.md,
            }}
          >
            <Text style={{ color: colors.text, fontSize: font.body }}>
              {formatEventDate(draft.date, 'day')}
            </Text>
          </Pressable>
          {showDate && (
            <DateTimePicker
              value={new Date(`${draft.date}T00:00:00`)}
              mode="date"
              display="inline"
              themeVariant={colors.bg === '#FFFFFF' ? 'light' : 'dark'}
              onChange={(_event, date) => {
                if (date) {
                  const y = date.getFullYear();
                  const m = String(date.getMonth() + 1).padStart(2, '0');
                  const d = String(date.getDate()).padStart(2, '0');
                  patch({ date: `${y}-${m}-${d}` });
                }
              }}
            />
          )}
        </View>

        {/* 3. 경조사 종류 */}
        <View style={{ gap: space.sm }}>
          <Text style={{ color: colors.textMuted, fontSize: font.caption }}>어떤 경조사인가요</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {EVENT_TYPES.map((t) => (
              <Chip
                key={t}
                label={EVENT_TYPE_LABEL[t]}
                selected={draft.type === t}
                onPress={() => patch({ type: t as EventType })}
              />
            ))}
          </View>
        </View>

        {/* 4. 금액 */}
        <View style={{ gap: space.sm }}>
          <Text style={{ color: colors.textMuted, fontSize: font.caption }}>얼마를 냈나요</Text>
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
            <TextInput
              value={draft.amountText}
              onChangeText={(next) => patch({ amountText: next })}
              placeholder="직접 입력"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: radius.md,
                borderWidth: 1,
                color: colors.text,
                flex: 1,
                fontSize: font.body,
                paddingHorizontal: space.lg,
                paddingVertical: space.md,
                textAlign: 'right',
              }}
            />
            <Chip
              label={draft.amountUnit === 'manwon' ? '만원' : '원'}
              selected={draft.amountUnit === 'manwon'}
              onPress={() => patch({ amountUnit: draft.amountUnit === 'manwon' ? 'won' : 'manwon' })}
            />
          </View>
        </View>

        {/* 5. 메모 */}
        <Field
          label="메모"
          value={draft.memo}
          onChangeText={(next) => patch({ memo: next })}
          maxLength={500}
          placeholder="김철수 편에 전달 …"
        />

        {errors.length > 0 && (
          <View style={{ gap: space.xs }}>
            {errors.map((e) => (
              <Text key={e} style={{ color: colors.danger, fontSize: font.caption }}>
                {e}
              </Text>
            ))}
          </View>
        )}

        <Button
          label="저장"
          loading={save.isPending || checking}
          disabled={save.isPending || checking}
          onPress={() => void onSave()}
        />
      </View>
    </Screen>
  );
}
