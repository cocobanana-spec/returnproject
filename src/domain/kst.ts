// 한국 날짜 — 서버(0011)와 같은 기준으로 '오늘'을 정한다. 순수 함수라 앱·워커·테스트가 함께 쓴다
export function kstDay(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
}
