// 행사 폼(S08)과 행사 목록(S06)의 판단 로직. 화면에 계산을 묻어 두지 않기 위해 순수 함수로 뺀다
import type { DatePrecision, EventType } from './constants.ts';
import { EVENT_TYPE_LABEL } from './constants.ts';
import { coerceDateToPrecision } from './title.ts';

export type EventDraft = {
  type: EventType | null;
  isMine: boolean;
  // 남의 행사에만 있다. 내 행사는 항상 null(DB CHECK와 같은 규칙).
  hostPersonId: string | null;
  title: string;
  date: string;
  datePrecision: DatePrecision;
  place: string;
  sideALabel: string;
  sideBLabel: string;
  memo: string;
};

export function emptyEventDraft(today: string): EventDraft {
  return {
    type: null,
    isMine: true, // 행사 탭에서 새로 만드는 것은 보통 내 행사다. 남의 행사는 빠른 기록이 자동으로 만든다
    hostPersonId: null,
    title: '',
    date: today,
    datePrecision: 'day',
    place: '',
    sideALabel: '',
    sideBLabel: '',
    memo: '',
  };
}

// 결혼식은 신랑측·신부측이 기본이다. 나머지는 사용자가 직접 넣는다(docs/02 §3.1).
export function defaultSideLabels(type: EventType | null): { a: string; b: string } {
  return type === 'wedding' ? { a: '신랑측', b: '신부측' } : { a: '', b: '' };
}

export type EventPayload = {
  type: EventType;
  is_mine: boolean;
  host_person_id: string | null;
  title: string;
  date: string;
  date_precision: DatePrecision;
  place: string | null;
  side_a_label: string | null;
  side_b_label: string | null;
  memo: string | null;
};

export type EventValidation =
  | { ok: true; payload: EventPayload }
  | { ok: false; errors: string[] };

export function validateEvent(draft: EventDraft): EventValidation {
  const errors: string[] = [];

  if (!draft.type) errors.push('어떤 경조사인지 골라 주세요.');
  if (!draft.isMine && !draft.hostPersonId) {
    errors.push('남의 행사에는 당사자가 필요합니다.');
  }

  const title = draft.title.trim();
  if (title.length === 0) errors.push('행사 이름을 넣어 주세요.');
  if (title.length > 80) errors.push('행사 이름은 80자를 넘을 수 없습니다.');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) errors.push('날짜가 올바르지 않습니다.');

  const sideA = draft.sideALabel.trim();
  const sideB = draft.sideBLabel.trim();
  if (sideB.length > 0 && sideA.length === 0) {
    errors.push('측을 나누려면 첫 번째 측 이름을 먼저 넣어 주세요.');
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    payload: {
      type: draft.type as EventType,
      is_mine: draft.isMine,
      // 내 행사는 당사자를 갖지 않는다. 폼에 남아 있어도 저장할 때 버린다.
      host_person_id: draft.isMine ? null : draft.hostPersonId,
      title,
      date: coerceDateToPrecision(draft.date, draft.datePrecision),
      date_precision: draft.datePrecision,
      place: draft.place.trim() || null,
      // 측 라벨은 내 행사에만 붙는다(DB CHECK와 같은 규칙).
      side_a_label: draft.isMine ? sideA || null : null,
      side_b_label: draft.isMine ? sideB || null : null,
      memo: draft.memo.trim() || null,
    },
  };
}

// 기록이 하나라도 있으면 내 행사 여부를 바꿀 수 없다. 서버 트리거가 막지만 화면이 먼저 잠근다.
export function isMineLocked(entryCount: number): boolean {
  return entryCount > 0;
}

export type YearGroup<T> = { year: string; events: T[] };

// 목록을 연도 헤더로 묶는다. 입력은 이미 날짜 내림차순으로 정렬돼 있다고 본다.
export function groupEventsByYear<T extends { date: string }>(events: T[]): YearGroup<T>[] {
  const groups: YearGroup<T>[] = [];
  for (const event of events) {
    const year = event.date.slice(0, 4);
    const last = groups[groups.length - 1];
    if (last && last.year === year) last.events.push(event);
    else groups.push({ year, events: [event] });
  }
  return groups;
}

// 행사 목록 한 줄의 부제. "결혼식 · 2025.05.18" 형태.
export function eventTypeLabel(type: string): string {
  return EVENT_TYPE_LABEL[type as EventType] ?? type;
}

// 받은돈 기록의 기본 행사. 명부는 **이미 치른** 행사에 넣는 일이 대부분이다.
// 그래서 오늘까지의 행사 중 가장 최근 것을 먼저 고른다. 미래 날짜를 고르면 예정 행사에
// 명부 200건이 들어간다(이 앱은 예정 행사를 1급으로 다룬다 — docs/02 §5).
// 지난 행사가 하나도 없을 때만 가장 가까운 미래 행사를 고른다. 같은 날이면 먼저 온 것이다.
export function pickDefaultEvent<T extends { date: string }>(events: T[], today: string): T | null {
  if (events.length === 0) return null;
  const past = events.filter((e) => e.date <= today);
  if (past.length > 0) {
    let best = past[0] as T;
    for (const e of past.slice(1)) if (e.date > best.date) best = e;
    return best;
  }
  let soonest = events[0] as T;
  for (const e of events.slice(1)) if (e.date < soonest.date) soonest = e;
  return soonest;
}
