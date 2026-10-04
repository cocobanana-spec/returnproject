// 색·간격·글꼴 크기 디자인 토큰 — Green Deck **라이트**(사장님이 보여 준 그림 기준). 화면은 useTokens()로 꺼내 쓴다
//
// 2026-10-04 처음엔 docs/green-deck-DESIGN.md 의 다크 버전을 입혔다가 사장님이 "원하는 건 라이트 그림"이라 해서
// 라이트 한 벌로 바꿨다. 밝은 회백색 바닥, 흰 카드에 옅은 그림자, 진한 초록 강조, 연두 배지가 핵심이다.
// 카드는 테두리 대신 흰 면 + 그림자(cardShadow)로 띄운다. 구분선은 옅은 회색만.
import type { ViewStyle } from 'react-native';

// 준 돈(나간 돈)은 그림의 음수 색(붉은 기), 받은 돈(들어온 돈)은 초록. 배지 바탕은 각각의 옅은 색
const palette = {
  bg: '#F6F7F5',
  // 입력칸·칩·검색 바처럼 바닥보다 조금 어두운 면
  bgSubtle: '#EEF0EC',
  card: '#FFFFFF',
  surface2: '#EEF0EC',
  border: '#E4E7E1',
  text: '#141615',
  textMuted: '#6B7069',
  textOnAccent: '#FFFFFF',
  accent: '#2E7D32',
  // 연두 배지·선택된 칸 바탕
  accentSoft: '#E6F4E7',
  given: '#C62828',
  givenSoft: '#FBEAEA',
  received: '#2E7D32',
  receivedSoft: '#E6F4E7',
  danger: '#C62828',
  // 하단 탭 바
  nav: '#FFFFFF',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

// 8 입력칸·작은 배지, 12 카드·버튼, 16 큰 카드, 알약은 칩
export const radius = { sm: 8, md: 12, lg: 16, pill: 9999 } as const;

export const font = {
  caption: 12,
  body: 15,
  title: 18,
  heading: 22,
  display: 28,
} as const;

// 흰 카드를 바닥에서 띄우는 그림자. boxShadow 는 RN 0.76+ 에서 네이티브·웹 모두 먹는다
export const cardShadow: ViewStyle = {
  backgroundColor: palette.card,
  boxShadow: '0 2px 10px rgba(20, 22, 21, 0.06)',
};

export type Colors = typeof palette;

export const colors = palette;

export function useTokens() {
  return {
    colors: palette,
    isDark: false,
    space,
    radius,
    font,
    cardShadow,
  };
}
