// 기록 한 줄을 화면에 어떻게 보여 줄지 정하는 순수 함수들
// 방향은 컬럼이 아니라 소속 행사의 is_mine에서 파생된다(docs/03 결정 5)
import { EVENT_TYPE_LABEL, type DatePrecision, type EventType } from './constants.ts';
import { parseAmountInput } from './money.ts';
import { formatEventDate } from './title.ts';

export type EntryLineInput = {
  coPersonId?: string | null;
  personId: string;
  event: { title: string; type: string; is_mine: boolean; date: string; date_precision: string } | null;
};

export function directionLabel(isMine: boolean): string {
  return isMine ? '받은돈' : '준돈';
}

// 원장에서 이 기록이 "공동 부조"로 잡힌 것인지. 대표자가 아니라 공동 부조자 자리에 있으면 참이다.
export function isCoEntryFor(entry: EntryLineInput, personId: string): boolean {
  return entry.coPersonId === personId && entry.personId !== personId;
}

// "2025.05.18 · 결혼식" 형태의 부제. 행사가 없으면 빈 문자열.
export function entrySubtitle(event: EntryLineInput['event']): string {
  if (!event) return '';
  const date = formatEventDate(event.date, event.date_precision as DatePrecision);
  const type = EVENT_TYPE_LABEL[event.type as EventType] ?? '';
  return type ? `${date} · ${type}` : date;
}

// 기록 편집(S10)의 금액 규칙. 준돈은 어디서든 금액 필수, 받은돈은 빈 금액이 미확정으로 통과한다
// (2026-09-25 결정). 방향은 소속 행사의 is_mine에서 온다.
export type AmountCheck = { ok: true; amount: number | null } | { ok: false; error: string };

export function validateEntryAmount(amountText: string, isMine: boolean): AmountCheck {
  const amount = parseAmountInput(amountText);
  if (amount === undefined) return { ok: false, error: '금액은 숫자로만 넣어 주세요.' };
  if (amount === null && !isMine) return { ok: false, error: '준 돈은 금액이 필요합니다.' };
  return { ok: true, amount };
}

export function amountFieldLabel(isMine: boolean): string {
  return isMine ? '금액 (비워 두면 미확정)' : '금액';
}
