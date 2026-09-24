// 홈 화면(S01)의 방향 탭 정의와 목록 행 조립 규칙
//
// 홈은 준돈·받은돈 두 탭으로 나뉜다. 방향은 기록에 컬럼이 없고 소속 행사의 is_mine에서
// 파생되므로(docs/03 결정 5), "탭 = is_mine 값"이라는 대응을 여기 한 곳에만 둔다.
// 화면이 직접 boolean을 다루면 준돈/받은돈이 뒤집히는 실수가 조용히 난다.
import type { DatePrecision } from './constants.ts';
import { formatEventDate } from './title.ts';

export type Direction = 'given' | 'received';

export const DIRECTIONS: Direction[] = ['given', 'received'];

export const DIRECTION_LABEL: Record<Direction, string> = {
  given: '준 돈',
  received: '받은 돈',
};

// 기본 탭은 준돈이다. 경조사 장부는 내가 낸 돈을 훨씬 자주 들춰 본다.
export const DEFAULT_DIRECTION: Direction = 'given';

export function isMineOf(direction: Direction): boolean {
  return direction === 'received';
}

export function directionOf(isMine: boolean): Direction {
  return isMine ? 'received' : 'given';
}

// 목록 한 행의 부제. 행사 이름과 날짜를 한 줄로 합친다.
// 행사 정보가 없으면(조인 실패·삭제 중) 날짜만이라도 남긴다. 빈 문자열을 돌려주면
// 행의 높이가 튀면서 목록이 들썩인다.
export function entryRowSubtitle(event: {
  title?: string | null;
  date?: string | null;
  date_precision?: string | null;
} | null): string {
  if (!event) return '행사 정보 없음';
  const date = event.date
    ? formatEventDate(event.date, (event.date_precision ?? 'day') as DatePrecision)
    : '';
  const title = event.title ?? '';
  return [title, date].filter((part) => part.length > 0).join(' · ');
}

// 대표자와 공동 부조자를 한 이름으로 합친다. 공동 부조는 한 건이 두 사람에게 걸린다.
export function entryRowName(
  person: { name?: string | null } | null,
  coPerson: { name?: string | null } | null,
): string {
  const base = person?.name ?? '(이름 없음)';
  return coPerson?.name ? `${base} (+${coPerson.name})` : base;
}

// 목록 상단 띠에 쓸 다가오는 행사 문구. 알림을 넣지 않기로 한 결정 9의 대체물이라
// "며칠 남았는지"까지 적어야 알림 노릇을 한다.
export function daysUntil(today: string, date: string): number {
  const a = Date.parse(`${today}T00:00:00Z`);
  const b = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

export function upcomingHint(today: string, date: string): string {
  const days = daysUntil(today, date);
  if (days <= 0) return '오늘';
  if (days === 1) return '내일';
  return `${days}일 뒤`;
}

// 홈 상단 합계의 보조 문구.
//
// stats_by_year의 cnt는 미확정을 **포함**하고 total은 **제외**한다(0001_init.sql의 집계 정의).
// 건수 바로 뒤에 "미확정 N건 제외"를 붙이면 사용자는 그 건수가 이미 뺀 값이라고 읽는다.
// 무엇에서 빠졌는지를 분명히 적는다.
export function totalCaption(year: number, count: number, unconfirmed: number): string {
  const base = `${year}년 ${count}건`;
  if (unconfirmed <= 0) return base;
  return `${base} · 미확정 ${unconfirmed}건은 합계에서 빠짐`;
}
