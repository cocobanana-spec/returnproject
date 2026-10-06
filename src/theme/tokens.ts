// 색·간격·글꼴 크기 디자인 토큰 — docs/DESIGN.md 기준(올리브그린·아이보리). 화면은 useTokens()로 꺼내 쓴다
//
// 2026-10-04 처음엔 docs/green-deck-DESIGN.md 의 다크 버전을 입혔다가 사장님이 "원하는 건 라이트 그림"이라 해서
// 라이트 한 벌로 바꿨다. 밝은 회백색 바닥, 흰 카드에 옅은 그림자, 진한 초록 강조, 연두 배지가 핵심이다.
// 카드는 테두리 대신 흰 면 + 그림자(cardShadow)로 띄운다. 구분선은 옅은 회색만.
import type { TextStyle, ViewStyle } from 'react-native';

// 기준은 docs/DESIGN.md (2026-10-06). 브랜드 올리브그린, 따뜻한 아이보리 바닥, 순백 카드.
// 준 돈은 테라코타, 받은 돈은 브랜드 그린 — 둘 다 채도를 그린과 맞춘다. 쨍한 빨강은 없다.
const palette = {
  bg: '#F6F3EA',
  // 비활성 칩·입력칸·보조 면. 바닥보다 확실히 한 단계 어둡다(대비 부족 금지)
  bgSubtle: '#E9E5DA',
  card: '#FFFFFF',
  surface2: '#E9E5DA',
  border: '#DDD8CC',
  text: '#1E211C',
  textMuted: '#6E7268',
  // 부가 정보(날짜·행사명). 보조 글자보다 한 단계 더 연하다
  textFaint: '#9A9E94',
  textOnAccent: '#FFFFFF',
  accent: '#4F7942',
  // 연한 그린 면. 배지·선택된 칸
  accentSoft: '#E6EDDF',
  given: '#B5553F',
  givenSoft: '#F3E4DF',
  received: '#4F7942',
  receivedSoft: '#E6EDDF',
  danger: '#A8463A',
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
  boxShadow: '0 2px 10px rgba(30, 33, 28, 0.06)',
};

// 금액 숫자는 전부 고정폭. 자릿수가 세로로 맞아야 훑을 수 있다
export const amountText: TextStyle = { fontVariant: ['tabular-nums'] };
// 요약 카드의 큰 금액은 자간을 살짝 좁힌다
export const amountTextLarge: TextStyle = { fontVariant: ['tabular-nums'], letterSpacing: -0.5 };

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
    amountText,
    amountTextLarge,
  };
}
