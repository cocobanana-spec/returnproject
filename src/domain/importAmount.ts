// 가져오기 파일의 금액 셀을 원 단위 정수로 읽는 규칙(docs/02 §3.14)
//
// 받는 표기 — ₩100,000 · 100,000 · 100000원 · 10만 · 10만원 · 1만5천 · 15만 원 · 숫자 셀.
// 단위 없는 작은 수는 만원으로 추정하지 않는다. 추정이 틀리면 100배 오차가 조용히 들어간다.
// 대신 unitless를 돌려주어 미리보기가 "10원"으로 강조하게 한다.
import { MAX_AMOUNT_WON } from './money.ts';

export type ImportedAmount =
  | { ok: true; amount: number; unitless: boolean }
  | { ok: false; reason: 'empty' | 'unreadable' | 'negative' | 'zero' | 'too_large' };

const KOREAN_UNITS: Record<string, number> = { 억: 100_000_000, 만: 10_000, 천: 1_000, 백: 100 };

// "1만5천" · "15만" · "3천" 같은 한글 단위 표기를 원으로 접는다. 실패하면 null.
function parseKoreanUnits(text: string): number | null {
  const cleaned = text.replace(/\s/g, '');
  if (!/^[0-9.,]+[억만천백]([0-9.,]*[억만천백])*[0-9.,]*$/.test(cleaned)) return null;
  let total = 0;
  let rest = cleaned;
  const re = /([0-9.,]+)([억만천백])/g;
  let match: RegExpExecArray | null;
  let consumed = 0;
  while ((match = re.exec(cleaned)) !== null) {
    const n = Number(match[1]?.replace(/,/g, '') ?? '');
    const unit = KOREAN_UNITS[match[2] ?? ''];
    if (!Number.isFinite(n) || unit === undefined) return null;
    total += n * unit;
    consumed = re.lastIndex;
  }
  rest = cleaned.slice(consumed);
  if (rest.length > 0) {
    const tail = Number(rest.replace(/,/g, ''));
    if (!Number.isFinite(tail)) return null;
    total += tail;
  }
  return total;
}

export function parseImportedAmount(cell: string | number | null | undefined): ImportedAmount {
  if (cell === null || cell === undefined) return { ok: false, reason: 'empty' };
  let value: number;
  let unitless = false;

  if (typeof cell === 'number') {
    value = cell;
    unitless = true;
  } else {
    // 통화 기호·"원"·공백을 걷어낸 뒤 판단한다. 콤마는 천 단위 구분자로만 본다.
    const text = cell.replace(/[₩￦]/g, '').replace(/원$/u, '').replace(/원\s*$/u, '').trim();
    if (text.length === 0) return { ok: false, reason: 'empty' };
    const negative = /^-/.test(text);
    const body = text.replace(/^-/, '');
    const korean = parseKoreanUnits(body);
    if (korean !== null) {
      value = korean;
    } else {
      if (!/^[0-9]{1,3}(,[0-9]{3})*(\.[0-9]+)?$|^[0-9]+(\.[0-9]+)?$/.test(body)) {
        return { ok: false, reason: 'unreadable' };
      }
      value = Number(body.replace(/,/g, ''));
      unitless = true;
    }
    if (negative) value = -value;
  }

  if (!Number.isFinite(value)) return { ok: false, reason: 'unreadable' };
  if (!Number.isInteger(value)) {
    // 15000.0 같은 정수인 소수만 받는다. 진짜 소수는 원 단위가 아니다.
    if (Math.abs(value - Math.round(value)) > 1e-9) return { ok: false, reason: 'unreadable' };
    value = Math.round(value);
  }
  if (value < 0) return { ok: false, reason: 'negative' };
  if (value === 0) return { ok: false, reason: 'zero' };
  if (value > MAX_AMOUNT_WON) return { ok: false, reason: 'too_large' };

  // 단위 없는 작은 수(1만 미만)만 강조 대상이다. 100,000처럼 이미 원 단위로 보이는 값은 아니다.
  return { ok: true, amount: value, unitless: unitless && value < 10_000 };
}

export const AMOUNT_ERROR_LABEL: Record<Exclude<ImportedAmount, { ok: true }>['reason'], string> = {
  empty: '금액이 비어 있음',
  unreadable: '금액을 읽을 수 없음',
  negative: '음수 금액',
  zero: '0원',
  too_large: '금액이 너무 큼',
};
