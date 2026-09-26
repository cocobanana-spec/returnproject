// 장부 초기화의 확인 규칙(2026-09-26). 되돌릴 수 없으므로 확인을 가볍게 만들지 않는다
//
// 사용자는 이미 한 번 데이터를 잃었다(context-notes §14.6). "정말요?" 한 번으로는 부족하다.
// **장부 이름을 그대로 입력해야** 초기화 버튼이 켜진다. 손가락이 미끄러져서는 지울 수 없는 무게다.
export type LedgerContents = { people: number; events: number; entries: number };

// 앞뒤 공백만 눌러 준다. 가운데 공백까지 무시하면 "내 장부"와 "내장부"가 같아져
// 확인의 무게가 사라진다.
export function canResetLedger(ledgerName: string | null | undefined, typed: string): boolean {
  const name = (ledgerName ?? '').trim();
  if (name.length === 0) return false;
  return typed.trim() === name;
}

// 다이얼로그에 실제 숫자를 보여 준다. "전부 지웁니다"보다 "137명·3건·260건"이 훨씬 무겁다.
export function resetWarningLine(counts: LedgerContents): string {
  return `사람 ${counts.people}명 · 행사 ${counts.events}건 · 기록 ${counts.entries}건이 사라집니다.`;
}

export function isEmptyLedger(counts: LedgerContents): boolean {
  return counts.people === 0 && counts.events === 0 && counts.entries === 0;
}

// 초기화 뒤 사용자에게 보여 줄 문구. 실제로 지운 건수를 그대로 읽는다.
export function resetDoneLine(counts: LedgerContents): string {
  if (isEmptyLedger(counts)) return '지울 것이 없었습니다.';
  return `사람 ${counts.people}명 · 행사 ${counts.events}건 · 기록 ${counts.entries}건을 지웠습니다.`;
}
