// 준돈 빠른 기록(S02)의 판단 로직. 화면에 계산을 묻어 두지 않기 위해 순수 함수로 뺀다
//
// 입력은 이름·날짜·종류·금액·메모 다섯 가지다(2026-09-24 사용자 결정). 형태·참석·공동 부조자·
// 장소는 초안에서 뺐다. 컬럼은 남아 있고 저장 시 기본값(형태는 현금)으로 들어간다.
import { parseAmountInput, type AmountUnit } from './money.ts';
import { isValidName, trimName } from './name.ts';
import { newPersonLabelRule } from './person.ts';
import type { EventType, RelationGroup } from './constants.ts';

export type QuickRecordDraft = {
  // 기존 사람을 고르면 personId, 새 사람이면 newPersonName을 쓴다. 둘 중 하나만 채워진다.
  personId: string | null;
  newPersonName: string;
  newPersonGroup: RelationGroup;
  // 같은 이름이 이미 있을 때만 쓰인다. 그때는 필수다(docs/02 §5 동명이인).
  newPersonLabel: string;
  sameNameExists: boolean;
  type: EventType | null;
  amountText: string;
  amountUnit: AmountUnit;
  date: string;
  memo: string;
};

export function emptyDraft(today: string): QuickRecordDraft {
  return {
    personId: null,
    newPersonName: '',
    newPersonGroup: 'other',
    newPersonLabel: '',
    sameNameExists: false,
    type: null,
    amountText: '',
    amountUnit: 'won',
    date: today,
    memo: '',
  };
}

export type QuickRecordPlan = {
  amount: number | null;
  personName: string | null; // 새 사람일 때만
  personLabel: string | null; // 새 사람이고 같은 이름이 있을 때만
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

  // 같은 이름이 이미 있는데 구분할 말이 없으면 나중에 두 사람을 가를 방법이 없다(S09와 같은 규칙).
  const labelRule = newPersonLabelRule(hasExisting, draft.sameNameExists, draft.newPersonLabel);
  if (labelRule.error) errors.push(labelRule.error);

  if (!draft.type) errors.push('어떤 경조사인지 골라 주세요.');

  const amount = parseAmountInput(draft.amountText, draft.amountUnit);
  if (amount === undefined) errors.push('금액은 숫자로만 넣어 주세요.');

  // 준돈은 낸 금액을 아는 상태에서 적는다. 비어 있으면 실수다(받은돈의 미확정과 다르다).
  if (amount === null) errors.push('금액을 넣어 주세요.');

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    plan: {
      amount: amount as number | null,
      personName: hasExisting ? null : trimmed,
      personLabel: labelRule.label,
    },
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
