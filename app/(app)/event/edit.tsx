// 행사 생성·편집(S08) — 내 행사 토글 잠금, 당사자, 날짜 정밀도, 측 라벨
//
// 기록이 하나라도 있으면 내 행사 여부를 바꿀 수 없다. 소속 기록 전체의 준돈/받은돈 방향이
// 뒤집히기 때문이며 서버 트리거가 막는다(docs/03 결정 5). 화면이 먼저 잠가 실수를 줄인다.
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  DATE_PRECISIONS,
  EVENT_TYPES,
  EVENT_TYPE_LABEL,
  type DatePrecision,
  type EventType,
} from '../../../src/domain/constants.ts';
import {
  defaultSideLabels,
  emptyEventDraft,
  isMineLocked,
  validateEvent,
  type EventDraft,
} from '../../../src/domain/event.ts';
import { autoEventTitle, formatEventDate, todayISO } from '../../../src/domain/title.ts';
import { useLedgerId } from '../../../src/ledger/LedgerProvider';
import { queryKeys } from '../../../src/lib/queryKeys';
import { createEvent, getEvent, getEventSummary, updateEvent } from '../../../src/repositories/events';
import { getPersonBalance, type PersonBalance } from '../../../src/repositories/people';
import { useTokens } from '../../../src/theme/tokens';
import { Button } from '../../../src/ui/Button';
import { Chip } from '../../../src/ui/Chip';
import { Field } from '../../../src/ui/Field';
import { PersonPicker } from '../../../src/ui/PersonPicker';
import { Screen } from '../../../src/ui/Screen';

const PRECISION_LABEL: Record<DatePrecision, string> = {
  day: '일까지',
  month: '월까지',
  year: '연도만',
};

export default function EventEditScreen() {
  const ledgerId = useLedgerId();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, space, font, radius } = useTokens();
  // next=receive — 만들고 나서 명부 입력으로 돌아간다. 명부 입력에서 "행사가 없어서"
  // 흐름이 끊기지 않게 하는 길이다(2026-09-26 사용자 요청). 새 행사의 기본값은 이미 내 행사다.
  const { id, next } = useLocalSearchParams<{ id?: string; next?: string }>();
  const editing = Boolean(id);

  const [draft, setDraft] = useState<EventDraft>(() => emptyEventDraft(todayISO()));
  const [host, setHost] = useState<PersonBalance | null>(null);
  const [showDate, setShowDate] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  // 사용자가 제목을 직접 고쳤으면 자동 생성이 덮어쓰지 않는다.
  const titleTouched = useRef(false);
  // 측 라벨도 마찬가지다. 직접 고친 뒤에는 종류를 바꿔도 건드리지 않는다.
  const sideTouched = useRef(false);

  const existing = useQuery({
    queryKey: queryKeys.events.detail(ledgerId, id ?? ''),
    queryFn: () => getEvent(ledgerId, id as string),
    enabled: editing,
  });

  // 기록이 있는지 — 내 행사 토글을 잠글지 판단한다.
  const summary = useQuery({
    queryKey: queryKeys.events.summary(ledgerId, id ?? ''),
    queryFn: () => getEventSummary(ledgerId, id as string),
    enabled: editing,
  });
  const entryCount = summary.data?.cnt ?? 0;
  // 집계가 도착하기 전에는 "기록 0건"이 아니라 "모른다"이다. 모르는 동안은 잠가 둔다.
  // 서버 트리거가 최종적으로 막지만, 그 사이 측 라벨이 폼에서 지워지는 부작용이 남는다.
  const lockUnknown = editing && !summary.isSuccess;
  // 명부 입력에서 만들러 온 행사는 내 행사여야 한다. 남의 행사를 만들어 돌아가면 거기서
  // 저장한 기록이 전부 준돈으로 집계된다(2026-09-26 QA). 토글을 잠근다.
  const forReceive = next === 'receive' && !editing;
  const locked = forReceive || (editing && (lockUnknown || isMineLocked(entryCount)));

  const hostQuery = useQuery({
    queryKey: queryKeys.people.balance(ledgerId, existing.data?.host_person_id ?? ''),
    queryFn: () => getPersonBalance(ledgerId, existing.data?.host_person_id as string),
    enabled: Boolean(existing.data?.host_person_id),
  });

  // 서버 값으로 폼을 채우는 것은 한 번뿐이다. 두 번째부터는 사용자가 친 값을 덮지 않는다.
  const filled = useRef(false);
  useEffect(() => {
    const e = existing.data;
    if (!e || filled.current) return;
    filled.current = true;
    titleTouched.current = true;
    sideTouched.current = true;
    setDraft({
      type: e.type as EventType,
      isMine: e.is_mine,
      hostPersonId: e.host_person_id,
      title: e.title,
      date: e.date,
      datePrecision: e.date_precision as DatePrecision,
      place: e.place ?? '',
      sideALabel: e.side_a_label ?? '',
      sideBLabel: e.side_b_label ?? '',
      memo: e.memo ?? '',
    });
  }, [existing.data]);

  // 서버에서 온 당사자도 한 번만 반영한다. 재조회가 사용자가 방금 비운 칩을 되살리면
  // 화면에는 사람이 보이는데 저장은 "당사자가 필요합니다"로 실패한다.
  const hostFilled = useRef(false);
  useEffect(() => {
    if (hostFilled.current || !hostQuery.data) return;
    hostFilled.current = true;
    setHost(hostQuery.data);
  }, [hostQuery.data]);

  function patch(next: Partial<EventDraft>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  // 종류·당사자·날짜가 정해지면 제목을 만들어 준다. 사용자가 손대면 그때부터 건드리지 않는다.
  function autoTitle(next: Partial<EventDraft>, nextHost?: PersonBalance | null) {
    const merged = { ...draft, ...next };
    if (titleTouched.current || !merged.type) return;
    const name = (nextHost === undefined ? host : nextHost)?.name ?? '';
    patch({
      ...next,
      title: autoEventTitle({
        type: merged.type,
        isMine: merged.isMine,
        hostName: name,
        date: merged.date,
      }),
    });
  }

  // 응답이 유실된 뒤 사용자가 "만들기"를 다시 누르면 같은 행사가 두 건 생긴다(S02와 같은 방어).
  const createdEventId = useRef<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const result = validateEvent(draft);
      if (!result.ok) throw new Error(result.errors.join('\n'));
      if (editing) return updateEvent(ledgerId, id as string, result.payload);
      if (createdEventId.current) {
        return updateEvent(ledgerId, createdEventId.current, result.payload);
      }
      const made = await createEvent(ledgerId, result.payload);
      createdEventId.current = made.id;
      return made;
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      void queryClient.invalidateQueries({ queryKey: ['entries'] });
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
      if (editing) router.back();
      else if (next === 'receive') router.replace(`/event/receive?id=${saved.id}`);
      else router.replace(`/event/${saved.id}`);
    },
    onError: (e: Error) => setErrors(e.message.split('\n')),
  });

  function onSave() {
    setErrors([]);
    const result = validateEvent(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    save.mutate();
  }

  return (
    <Screen scroll edges={{ top: false }}>
      <View style={{ gap: space.lg }}>
        {/* 종류 */}
        <View style={{ gap: space.sm }}>
          <Text style={{ color: colors.textMuted, fontSize: font.caption }}>어떤 경조사인가요</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {EVENT_TYPES.map((t) => (
              <Chip
                key={t}
                label={EVENT_TYPE_LABEL[t]}
                selected={draft.type === t}
                onPress={() => {
                  const labels = defaultSideLabels(t);
                  const next: Partial<EventDraft> = { type: t };
                  // 측 라벨을 사용자가 직접 안 건드렸으면 종류의 기본값을 따라가게 한다.
                  // 결혼식에서 돌잔치로 바꿨는데 신랑측·신부측이 남으면 안 된다.
                  if (!sideTouched.current && draft.isMine) {
                    next.sideALabel = labels.a;
                    next.sideBLabel = labels.b;
                  }
                  autoTitle(next);
                  patch(next);
                }}
              />
            ))}
          </View>
        </View>

        {/* 내 행사 토글 */}
        <View style={{ gap: space.sm }}>
          <Text style={{ color: colors.textMuted, fontSize: font.caption }}>누구의 행사인가요</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Chip
              label="내 행사 (받은돈)"
              selected={draft.isMine}
              onPress={() => {
                if (locked) return;
                autoTitle({ isMine: true });
                patch({ isMine: true, hostPersonId: null });
                setHost(null);
              }}
            />
            <Chip
              label="남의 행사 (준돈)"
              selected={!draft.isMine}
              onPress={() => {
                if (locked) return;
                autoTitle({ isMine: false });
                patch({ isMine: false, sideALabel: '', sideBLabel: '' });
              }}
            />
          </View>
          {locked && (
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: space.xs }}>
              <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, fontSize: font.caption, flex: 1 }}>
                {forReceive
                  ? '명부에 넣을 행사라 내 행사로 고정됩니다.'
                  : lockUnknown
                    ? '기록 수를 확인하는 동안은 바꿀 수 없습니다.'
                    : `기록 ${entryCount}건이 있어 바꿀 수 없습니다. 바꾸려면 기록을 먼저 지워야 합니다.`}
              </Text>
            </View>
          )}
        </View>

        {/* 남의 행사면 당사자 */}
        {!draft.isMine && (
          <PersonPicker
            ledgerId={ledgerId}
            label="당사자 (누구의 경조사인가요)"
            picked={host}
            onPick={(p) => {
              setHost(p);
              autoTitle({ hostPersonId: p.id as string }, p);
              patch({ hostPersonId: p.id as string });
            }}
            onClear={() => {
              setHost(null);
              patch({ hostPersonId: null });
            }}
          />
        )}

        <Field
          label="행사 이름"
          value={draft.title}
          onChangeText={(next) => {
            titleTouched.current = true;
            patch({ title: next });
          }}
          maxLength={80}
          placeholder="내 결혼식"
        />

        {/* 날짜와 정밀도 */}
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
              {formatEventDate(draft.date, draft.datePrecision)}
            </Text>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {DATE_PRECISIONS.map((p) => (
              <Chip
                key={p}
                label={PRECISION_LABEL[p]}
                selected={draft.datePrecision === p}
                onPress={() => patch({ datePrecision: p })}
              />
            ))}
          </View>
          <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
            정확한 날짜를 모르면 월이나 연도까지만 남길 수 있습니다.
          </Text>
        </View>

        {showDate && (
          <DateTimePicker
            value={new Date(`${draft.date}T00:00:00`)}
            mode="date"
            display="inline"
            themeVariant={colors.bg === '#FFFFFF' ? 'light' : 'dark'}
            onChange={(_e, date) => {
              if (!date) return;
              const y = date.getFullYear();
              const m = String(date.getMonth() + 1).padStart(2, '0');
              const d = String(date.getDate()).padStart(2, '0');
              const next = `${y}-${m}-${d}`;
              autoTitle({ date: next });
              patch({ date: next });
            }}
          />
        )}

        <Field
          label="장소"
          value={draft.place}
          onChangeText={(next) => patch({ place: next })}
          maxLength={100}
          placeholder="○○웨딩홀"
        />

        {/* 측 라벨은 내 행사에만 */}
        {draft.isMine && (
          <View style={{ gap: space.sm }}>
            <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
              측 구분 (양가로 나눠 정산할 때)
            </Text>
            <Field
              value={draft.sideALabel}
              onChangeText={(next) => {
                sideTouched.current = true;
                patch({ sideALabel: next });
              }}
              maxLength={20}
              placeholder="신랑측"
            />
            <Field
              value={draft.sideBLabel}
              onChangeText={(next) => {
                sideTouched.current = true;
                patch({ sideBLabel: next });
              }}
              maxLength={20}
              placeholder="신부측"
            />
            <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
              비워 두면 측을 나누지 않습니다.
            </Text>
          </View>
        )}

        <Field
          label="메모"
          value={draft.memo}
          onChangeText={(next) => patch({ memo: next })}
          maxLength={500}
          multiline
        />

        {errors.map((e) => (
          <Text key={e} style={{ color: colors.danger, fontSize: font.caption }}>
            {e}
          </Text>
        ))}

        <Button
          label={editing ? '저장' : '만들기'}
          onPress={onSave}
          loading={save.isPending}
          disabled={save.isPending}
        />
      </View>
    </Screen>
  );
}
