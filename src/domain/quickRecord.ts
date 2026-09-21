// 준돈 빠른 기록(S02)의 판단 로직. 화면에 계산을 묻어 두지 않기 위해 순수 함수로 뺀다
import { allowsMissingAmount, parseAmountInput, type AmountUnit } from './money.ts';
import { isValidName, trimName } from './name.ts';
import type { EventType, Method, RelationGroup } from './constants.ts';

export type QuickRecordDraft = {
  // 기존 사람을 고르면 personId, 새 사람이면 newPersonName을 쓴다. 둘 중 하나만 채워진다.
  personId: string | null;
  newPersonName: string;
  newPersonGroup: RelationGroup;
  type: EventType | null;
  amountText: string;
  amountUnit: AmountUnit;
  date: string;
  method: Method;
  coPersonId: string | null;
  attended: boolean | null;
  // 장소는 행사에 속한다. 새 행사를 만들 때만 쓰이고 기존 행사에 붙일 때는 무시된다.
  place: string;
  memo: string;
};

export function emptyDraft(today: string): QuickRecordDraft {
  return {
    personId: null,
    newPersonName: '',
    newPersonGroup: 'other',
    type: null,
    amountText: '',
    amountUnit: 'won',
    date: today,
    method: 'cash',
    coPersonId: null,
    attended: null,
    place: '',
    memo: '',
  };
}

export type QuickRecordPlan = {
  amount: number | null;
  personName: string | null; // 새 사람일 때만
};

export type ValidationResult =
  | { ok: true; plan: QuickRecordPlan }
  | { ok: false; errors: string[] };

export function validateQuickRecord(draft: QuickRecordDraft): ValidationResult {
  const errors: string[] = [];

  const hasExisting = Boolean(draft.personId);
  const trimmed = trimName(draft.newPersonName);
  if (!hasExisting && !isValidName(trimmed)) {
    errors.push('누구에게 냈는지 이름을 넣어 주세요.');
  }

  if (!draft.type) errors.push('어떤 경조사인지 골라 주세요.');

  const amount = parseAmountInput(draft.amountText, draft.amountUnit);
  if (amount === undefined) errors.push('금액은 숫자로만 넣어 주세요.');

  if (amount === null && !allowsMissingAmount(draft.method)) {
    // 현금·이체인데 금액이 비면 실수일 가능성이 높다. 화환·선물·없음은 비어도 자연스럽다.
    errors.push('금액을 넣거나 부조 형태를 바꿔 주세요.');
  }

  if (draft.coPersonId && draft.personId && draft.coPersonId === draft.personId) {
    errors.push('공동 부조자는 본인과 다른 사람이어야 합니다.');
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    plan: { amount: amount as number | null, personName: hasExisting ? null : trimmed },
  };
}

// ±7일 안에 여러 후보가 있으면 날짜가 가장 가까운 것을 고른다. 같으면 이른 쪽.
export function pickClosestEvent<T extends { date: string }>(
  candidates: T[],
  target: string,
): T | null {
  if (candidates.length === 0) return null;
  const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
  const t = day(target);
  let best = candidates[0] as T;
  let bestGap = Math.abs(day(best.date) - t);
  for (const candidate of candidates.slice(1)) {
    const gap = Math.abs(day(candidate.date) - t);
    if (gap < bestGap || (gap === bestGap && day(candidate.date) < day(best.date))) {
      best = candidate;
      bestGap = gap;
    }
  }
  return best;
}

export type CreatedRefs = {
  personId: string | null; // 이번 저장에서 새로 만든 사람
  eventId: string | null; // 이번 저장에서 새로 만든 행사
  entryId: string;
};

export type UndoStep = { kind: 'person' | 'event' | 'entry'; id: string };

// 실행 취소는 가장 바깥 것 하나만 지우면 된다.
// - 사람을 새로 만들었으면 delete_person RPC 하나로 끝난다. 기록은 FK CASCADE로,
//   그 사람이 당사자이던 행사는 RPC 본문의 정리 단계가 지운다(0003_rpc_ledger_guard.sql).
//   행사의 host_person_id는 on delete set null이므로 FK만으로는 행사가 사라지지 않는다.
// - 행사만 새로 만들었으면 행사를 지우면 기록이 FK CASCADE로 딸려 간다.
export function undoPlan(created: CreatedRefs): UndoStep {
  if (created.personId) return { kind: 'person', id: created.personId };
  if (created.eventId) return { kind: 'event', id: created.eventId };
  return { kind: 'entry', id: created.entryId };
}
