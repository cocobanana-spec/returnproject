// 홈 화면(S01)의 방향 탭 정의와 목록 행 조립 규칙
//
// 홈은 준돈·받은돈 두 탭으로 나뉜다. 방향은 기록에 컬럼이 없고 소속 행사의 is_mine에서
// 파생되므로(docs/03 결정 5), "탭 = is_mine 값"이라는 대응을 여기 한 곳에만 둔다.
// 화면이 직접 boolean을 다루면 준돈/받은돈이 뒤집히는 실수가 조용히 난다.
import type { DatePrecision } from './constants.ts';
import { displayName } from './person.ts';
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

// 목록 한 행에 보일 이름 조각. 공동 부조는 한 건이 두 사람에게 걸리므로 조각이 둘이 된다.
// 각 조각이 자기 원장으로 가야 해서(2026-09-24 사용자 결정) 문자열이 아니라 id를 함께 돌려준다.
// 화면이 "김철수 (+이영희)"를 다시 쪼개 파싱하는 일이 없어야 한다.
export type NamePart = { id: string | null; name: string; co: boolean };

// 이름에는 구분 라벨이 붙는다("김철수 · 회사"). 동명이인이 목록에서 같은 글자로 보이면 안 된다.
export function entryRowNames(
  person: { id?: string | null; name?: string | null; label?: string | null } | null,
  coPerson: { id?: string | null; name?: string | null; label?: string | null } | null,
): NamePart[] {
  const parts: NamePart[] = [{ id: person?.id ?? null, name: displayName(person), co: false }];
  if (coPerson?.name) parts.push({ id: coPerson.id ?? null, name: displayName(coPerson), co: true });
  return parts;
}

// 접근성 라벨이나 한 줄 표시가 필요할 때만 문자열로 합친다.
export function entryRowName(
  person: { id?: string | null; name?: string | null; label?: string | null } | null,
  coPerson: { id?: string | null; name?: string | null; label?: string | null } | null,
): string {
  return entryRowNames(person, coPerson)
    .map((part) => (part.co ? `(+${part.name})` : part.name))
    .join(' ');
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
