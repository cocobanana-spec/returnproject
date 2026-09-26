// 준돈 빠른 기록(S02) — 이름·날짜·경조사 종류·금액·메모 다섯 가지만 받는다(2026-09-24 사용자 결정)
//
// 형태·참석·공동 부조자·장소는 입력에서 뺐다. 컬럼은 남아 있고 기본값으로 저장된다.
// 저장은 사람 → 행사 → 기록 순차 INSERT다. 하나의 데이터 수정 CTE로 묶으면 뒤 문장이 앞 CTE가
// 넣은 행을 보지 못해 FK와 같은 장부 트리거가 전부 실패한다(docs/03 결정 26).
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { isWeb } from '../../src/lib/platform.ts';
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
  labelFieldNeeded,
  resolveSameName,
  SAME_NAME_LABEL_ERROR,
  CHOOSE_SAME_NAME_ERROR,
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

type SaveVars = { existingEventId: string | null; personId: string | null };

export default function RecordScreen() {
  const ledgerId = useLedgerId();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { colors, space, font, radius } = useTokens();

  const [draft, setDraft] = useState<QuickRecordDraft>(() => emptyDraft(todayISO()));
  const [picked, setPicked] = useState<PersonBalance | null>(null);
  const [nameText, setNameText] = useState('');
  // "새 사람으로 추가"를 눌렀는지. 이름을 다시 치면 풀린다.
  const [wantsNew, setWantsNew] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  // 저장 판정(기존 행사 조회) 중에도 버튼을 잠근다. 두 번 누르면 기록이 두 건 생긴다.
  const [checking, setChecking] = useState(false);
  // 웹에서 "이미 있는 행사예요"는 세 갈래(취소 / 새 행사로 / 기존에 추가)다.
  // window.confirm 은 예·아니오뿐이라 담을 수 없고, 두 번 묻는 것은 더 나쁘다.
  // 그래서 웹에서는 저장 버튼 위에 선택지를 펼쳐 보여 준다. 앱은 지금처럼 Alert 세 갈래다.
  const [eventChoice, setEventChoice] = useState<
    { title: string; eventId: string; personId: string | null } | null
  >(null);

  // 저장이 중간에 실패해도 이미 만들어진 것은 서버에 남는다.
  // 무엇을 만들었는지 기억해 두어야 (1) 재시도가 같은 사람을 또 만들지 않고
  // (2) 실행 취소가 새로 만든 것까지 정확히 지운다.
  // 이름도 함께 기억한다. 중간 실패 뒤 이름을 고쳐 다시 저장하면 앞 사람에게 돈이 붙는다.
  // 행사의 종류·날짜도 함께 기억한다. 그 둘을 고쳐 재시도하면 앞서 만든 행사는 다른 행사다.
  const created = useRef<{
    personId: string | null;
    personName: string | null;
    eventId: string | null;
    eventType: string | null;
    eventDate: string | null;
  }>({ personId: null, personName: null, eventId: null, eventType: null, eventDate: null });

  // 웹의 "이미 있는 행사예요" 선택지는 화면 안에 펼쳐진 채로 남는다(앱의 Alert 과 달리 화면을
  // 막지 않는다). 그래서 선택지를 띄워 둔 채 이름·종류·날짜를 고칠 수 있는데, 선택지가 들고 있는
  // 사람·행사는 **고치기 전 값의 판정 결과**다. 그대로 누르면 엉뚱한 사람의 엉뚱한 행사에
  // 돈이 붙는다(2026-09-26 QA 중대). 판정의 근거가 바뀌면 선택지를 거둔다 — 다시 저장을 누르면
  // 바뀐 값으로 새로 판정한다. 금액·메모는 판정에 쓰이지 않으므로 그대로 둔다.
  const DECIDING_FIELDS = ['personId', 'newPersonName', 'type', 'date'] as const;

  function patch(next: Partial<QuickRecordDraft>) {
    if (DECIDING_FIELDS.some((k) => k in next)) setEventChoice(null);
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
    setWantsNew(false);
    patch({ personId: person.id as string, newPersonName: '' });
    setErrors([]);
  }

  function clearPerson() {
    setPicked(null);
    setWantsNew(false);
    setNameText('');
    patch({ personId: null, newPersonName: '', newPersonLabel: '' });
  }

  function useAsNewPerson() {
    setPicked(null);
    setWantsNew(true);
    patch({ personId: null, newPersonName: nameText });
  }

  // 같은 이름이 있다는 것만으로는 아무것도 요구하지 않는다. 대개 같은 사람이기 때문이다.
  // 구분할 말은 사용자가 "새 사람으로 추가"를 누른 뒤에만 묻는다(docs/02 §5, 2026-09-26).
  // 자동완성 결과가 실패했거나 아직 안 왔으면 같은 이름이 있는지 모르는 상태다. 그때는 저장 직전
  // 서버 재확인(mutationFn)이 판단한다.
  const sameName = sameNameCandidates(suggestions.data ?? [], nameText);
  const needsLabel = labelFieldNeeded({
    hasExisting: Boolean(picked),
    sameNameCount: sameName.length,
    wantsNewPerson: wantsNew,
  });
  const draftForSave = (): QuickRecordDraft => ({
    ...draft,
    sameNameCount: picked ? 0 : sameName.length,
    wantsNewPerson: wantsNew,
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['people'] });
    void queryClient.invalidateQueries({ queryKey: ['entries'] });
    void queryClient.invalidateQueries({ queryKey: ['events'] });
    void queryClient.invalidateQueries({ queryKey: ['stats'] });
  }

  // 사람 → 행사 → 기록 순차 저장. existingEventId가 있으면 행사를 새로 만들지 않는다.
  const save = useMutation({
    mutationFn: async ({ existingEventId, personId: decided }: SaveVars) => {
      const validation = validateQuickRecord(draftForSave());
      if (!validation.ok) throw new Error(validation.errors.join('\n'));

      const newName = validation.plan.personName as string | null;
      const reusable =
        created.current.personId !== null && created.current.personName === newName
          ? created.current.personId
          : null;
      // onSave가 서버에 물어 이미 정한 사람이 있으면 그걸 쓴다. 두 번 묻지 않는다.
      let personId = draft.personId ?? decided ?? reusable;
      // 앞선 시도에서 만든 사람·행사는 **같은 사람일 때만** 유효하다.
      // decided가 있을 때만 정리하면, 장부에 없는 이름으로 고쳐 재시도할 때(decided === null)
      // 앞선 행사 참조가 살아남아 기록이 앞 사람이 당사자인 행사에 붙는다.
      if (created.current.personId !== null && created.current.personId !== personId) {
        created.current = { personId: null, personName: null, eventId: null, eventType: null, eventDate: null };
      }
      // 종류·날짜를 고쳐 재시도하면 앞서 만든 행사는 다른 행사다. 그 참조도 버린다.
      if (
        created.current.eventId !== null &&
        (created.current.eventType !== draft.type || created.current.eventDate !== draft.date)
      ) {
        created.current.eventId = null;
        created.current.eventType = null;
        created.current.eventDate = null;
      }
      if (!personId) {
        // 같은 이름 판정은 onSave에서 이미 끝났다(마지막 문은 거기다). 여기서는 만들기만 한다.
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
        created.current.eventType = draft.type;
        created.current.eventDate = draft.date;
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
      created.current = { personId: null, personName: null, eventId: null, eventType: null, eventDate: null };
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
  //
  // **당사자를 먼저 정해야 이 확인이 돈다.** 이름만 쳐서 기존 사람에게 자동 연결되는 흔한 경우에
  // 당사자가 정해지지 않으면 확인이 통째로 건너뛰어져 같은 행사가 하나 더 생긴다(2026-09-26 QA).
  async function onSave() {
    if (checking || save.isPending) return;
    setErrors([]);
    setEventChoice(null);
    const validation = validateQuickRecord(draftForSave());
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }

    setChecking(true);
    // 중간 실패 뒤 그대로 재시도하는 경우, 이번 저장에서 이미 만든 사람이 서버 조회에 후보로
    // 잡혀 "구분할 말을 적어 주세요"로 막힌다. 그런데 화면은 아직 그 사람을 몰라 칸도 뜨지 않는다.
    // 내가 만든 사람이면 그 사람으로 확정하고 다시 묻지 않는다(S09와 같은 순서).
    const madeThisRound =
      created.current.personId !== null && created.current.personName === trimName(draft.newPersonName)
        ? created.current.personId
        : null;
    let hostId = draft.personId ?? madeThisRound;
    try {
      if (!hostId) {
        // 화면의 자동완성은 8건 상한이고 실패할 수도 있다. 저장 직전에 서버에 한 번 더 묻고
        // 같은 규칙(resolveSameName)으로 판정한다. 이것이 마지막 문이다.
        const typed = trimName(draft.newPersonName);
        const same = await findByNormalizedName(ledgerId, normalizeName(typed));
        const resolved = resolveSameName(
          same.map((p) => ({ id: p.id as string, name: p.name, label: p.label })),
          { wantsNewPerson: wantsNew, label: draft.newPersonLabel },
        );
        if (resolved.kind === 'needs_label') {
          setErrors([SAME_NAME_LABEL_ERROR]);
          return;
        }
        if (resolved.kind === 'choose') {
          setErrors([CHOOSE_SAME_NAME_ERROR]);
          return;
        }
        // 같은 이름이 한 명이면 그 사람이다. 새로 만들면 같은 사람의 수지가 둘로 갈린다.
        if (resolved.kind === 'attach') hostId = resolved.personId;
      }

      // 이미 이번 저장에서 행사를 만들었으면 다시 묻지 않는다(중간 실패 후 재시도).
      if (hostId && draft.type && !created.current.eventId) {
        const matches = await findMatchingEvent(ledgerId, {
          hostPersonId: hostId,
          type: draft.type,
          date: draft.date,
        });
        const best = pickClosestEvent(matches, draft.date);
        if (best) {
          const decided = hostId;
          if (isWeb) {
            setEventChoice({ title: best.title, eventId: best.id, personId: decided });
            return;
          }
          Alert.alert('이미 있는 행사예요', `"${best.title}"에 이 기록을 추가할까요?`, [
            { text: '취소', style: 'cancel' },
            { text: '새 행사로', onPress: () => save.mutate({ existingEventId: null, personId: decided }) },
            { text: '기존에 추가', onPress: () => save.mutate({ existingEventId: best.id, personId: decided }) },
          ]);
          return;
        }
      }
    } catch (error) {
      // 조회가 실패했는데 그냥 진행하면 같은 사람·같은 행사를 하나 더 만든다. 멈추고 알린다.
      setErrors([`기존 사람·행사를 확인하지 못했습니다. 다시 시도해 주세요.\n${(error as Error).message}`]);
      return;
    } finally {
      setChecking(false);
    }
    save.mutate({ existingEventId: null, personId: hostId });
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
                  setWantsNew(false);
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

        {eventChoice && (
          <View
            style={{
              backgroundColor: colors.bgSubtle,
              borderRadius: radius.lg,
              gap: space.sm,
              padding: space.lg,
            }}
          >
            <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '700' }}>
              이미 있는 행사예요
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: font.caption, lineHeight: 20 }}>
              "{eventChoice.title}"에 이 기록을 추가할까요?
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              <Chip
                label="기존에 추가"
                selected
                onPress={() => {
                  const c = eventChoice;
                  setEventChoice(null);
                  save.mutate({ existingEventId: c.eventId, personId: c.personId });
                }}
              />
              <Chip
                label="새 행사로"
                selected={false}
                onPress={() => {
                  const c = eventChoice;
                  setEventChoice(null);
                  save.mutate({ existingEventId: null, personId: c.personId });
                }}
              />
              <Chip label="취소" selected={false} onPress={() => setEventChoice(null)} />
            </View>
          </View>
        )}

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
