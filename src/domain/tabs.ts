// 마지막으로 보던 하단 탭을 기억하고 되살릴 때 쓰는 판정(2026-09-26 사용자 요청)
//
// 저장된 값은 기기에 오래 남는다. 탭 구성이 바뀌면 없는 탭이 저장돼 있을 수 있으므로
// 되살리기 전에 반드시 아는 탭인지 확인한다. 모르면 홈이다.
export const TAB_ROUTES = ['/', '/records', '/stats', '/more'] as const;
export type TabRoute = (typeof TAB_ROUTES)[number];

export const DEFAULT_TAB: TabRoute = '/';

// 현재 경로가 어느 탭인지. 탭 안에서 더 깊이 들어간 화면(/person/x)은 탭이 아니므로 null이다.
export function tabRouteFromPath(path: string): TabRoute | null {
  const clean = path.split('?')[0] ?? path;
  const trimmed = clean.length > 1 && clean.endsWith('/') ? clean.slice(0, -1) : clean;
  return (TAB_ROUTES as readonly string[]).includes(trimmed) ? (trimmed as TabRoute) : null;
}

// 저장된 값으로 되살릴 탭. 값이 없거나 더 이상 없는 탭이면 홈으로 보낸다.
export function restoredTabRoute(stored: string | null | undefined): TabRoute {
  if (!stored) return DEFAULT_TAB;
  return (TAB_ROUTES as readonly string[]).includes(stored) ? (stored as TabRoute) : DEFAULT_TAB;
}
