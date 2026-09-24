// 받은돈 연속 입력(S09)의 판단 로직. 명부 수백 명을 쉬지 않고 넣는 것이 목표다(docs/02 §3.3)
//
// 입력은 이름·금액·메모다(2026-09-24 사용자 결정). 날짜와 종류는 행사의 것을 쓴다.
// 측·형태·공동 부조자는 초안에서 뺐다. 컬럼은 남아 있고 저장 시 기본값으로 들어간다.
import { parseAmountInput, type AmountUnit } from './money.ts';
import { isValidName, trimName } from './name.ts';
import type { RelationGroup } from './constants.ts';

export type ReceivingDraft = {
  personId: string | null;
  newPersonName: string;
  newPersonGroup: RelationGroup;
  amountText: string;
  amountUnit: AmountUnit;
  memo: string;
};

export function emptyReceivingDraft(): ReceivingDraft {
  return {
    personId: null,
    newPersonName: '',
    newPersonGroup: 'other',
    amountText: '',
    amountUnit: 'won',
    memo: '',
  };
}

export type ReceivingPlan = { amount: number | null; personName: string | null };

export type ReceivingValidation =
  | { ok: true; plan: ReceivingPlan }
  | { ok: false; errors: string[] };

// 빠른 기록과 달리 금액이 비어도 통과한다. 봉투를 아직 안 세어 본 경우가 흔하기 때문이다.
// 비어 있으면 미확정(null)으로 저장되고 합계에서 빠진다(docs/02 §3.3).
export function validateReceiving(draft: ReceivingDraft): ReceivingValidation {
  const errors: string[] = [];

  const hasExisting = Boolean(draft.personId);
  const trimmed = trimName(draft.newPersonName);
  if (!hasExisting && !isValidName(trimmed)) {
    errors.push('이름을 넣어 주세요.');
  }

  const amount = parseAmountInput(draft.amountText, draft.amountUnit);
  if (amount === undefined) errors.push('금액은 숫자로만 넣어 주세요.');

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    plan: { amount: amount as number | null, personName: hasExisting ? null : trimmed },
  };
}

// "저장 후 다음" — 관계 그룹과 금액 단위는 직전 값을 유지하고 나머지는 비운다.
// 명부는 같은 그룹이 뭉쳐 있어서 이게 속도를 만든다(docs/02 §3.3).
// 금액 단위(원/만원)까지 유지하는 것은 의도다. 만원으로 넣기 시작하면 끝까지 만원으로 넣는다.
export function carryOver(draft: ReceivingDraft): ReceivingDraft {
  return {
    ...emptyReceivingDraft(),
    newPersonGroup: draft.newPersonGroup,
    amountUnit: draft.amountUnit,
  };
}
