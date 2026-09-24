// 금액은 언제나 원 단위 정수 하나로만 다룬다. 만원 단위 변환은 입력 컴포넌트 경계에서만 일어난다

export const AMOUNT_PRESETS_WON = [50_000, 100_000, 200_000, 300_000, 500_000] as const;

export const MAX_AMOUNT_WON = 1_000_000_000; // 10억. 오타로 0을 더 치는 것을 막는 상한

export type AmountUnit = 'won' | 'manwon';

// 입력 문자열을 원 단위 정수로 바꾼다.
// 빈 문자열은 null(미확정)이다. 숫자가 아니거나 범위를 벗어나면 undefined(입력 오류)다.
export function parseAmountInput(
  raw: string,
  unit: AmountUnit = 'won',
): number | null | undefined {
  const cleaned = raw.replace(/[,\s]/g, '');
  if (cleaned === '') return null;
  if (!/^\d+$/.test(cleaned)) return undefined;

  const base = Number(cleaned);
  if (!Number.isSafeInteger(base)) return undefined;

  const won = unit === 'manwon' ? base * 10_000 : base;
  if (won < 0 || won > MAX_AMOUNT_WON) return undefined;
  return won;
}

export function formatWon(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '미확정';
  return `${amount.toLocaleString('ko-KR')}원`;
}

// 목록에서 쓰는 짧은 표기. 만원 단위로 딱 떨어지면 "10만원"으로 줄인다.
export function formatWonShort(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '미확정';
  if (amount === 0) return '0원';
  if (amount % 10_000 === 0) return `${(amount / 10_000).toLocaleString('ko-KR')}만원`;
  return `${amount.toLocaleString('ko-KR')}원`;
}

export function formatBalance(balance: number): { text: string; direction: 'given' | 'received' | 'even' } {
  if (balance === 0) return { text: '수지 0원', direction: 'even' };
  if (balance > 0) return { text: `${balance.toLocaleString('ko-KR')}원 더 줌`, direction: 'given' };
  return { text: `${Math.abs(balance).toLocaleString('ko-KR')}원 더 받음`, direction: 'received' };
}
