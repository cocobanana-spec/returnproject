// 색·간격·글꼴 크기 디자인 토큰 — Green Deck(docs/green-deck-DESIGN.md) 한 벌. 화면은 useTokens()로 꺼내 쓴다
//
// 2026-10-04 사용자 요청으로 Green Deck 을 입혔다. 다크 고정이다(문서: "dark-first, 흰 바탕은 어디에도").
// 높낮이는 그림자가 아니라 면 밝기다 — #121212(바닥) < #181818(카드) < #282828(입력칸·칩·메뉴).
// 테두리로 상자를 만들지 않는다. 구분선(#282828)만 허용.

// 준 돈(나간 돈)은 주황, 받은 돈(들어온 돈)은 초록. 문서의 primary·warning 을 그대로 쓴다.
const palette = {
  bg: '#121212',
  bgSubtle: '#181818',
  card: '#181818',
  // 입력칸·칩·펼침 메뉴. 카드보다 한 단계 밝다
  surface2: '#282828',
  border: '#282828',
  text: '#FFFFFF',
  textMuted: '#A7A7A7',
  textOnAccent: '#FFFFFF',
  accent: '#1DB954',
  given: '#F59B23',
  received: '#1DB954',
  danger: '#E22134',
  // 하단 탭 바(문서의 내비게이션 면)
  nav: '#000000',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

// 4 입력칸·작은 섬네일, 8 카드, 12 큰 그림, 알약은 버튼·칩
export const radius = { sm: 4, md: 8, lg: 12, pill: 9999 } as const;

export const font = {
  caption: 12,
  body: 15,
  title: 18,
  heading: 22,
  display: 28,
} as const;

export type Colors = typeof palette;

export const colors = palette;

export function useTokens() {
  return {
    colors: palette,
    isDark: true,
    space,
    radius,
    font,
  };
}
