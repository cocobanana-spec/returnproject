// 색·간격·글꼴 크기 디자인 토큰 — docs/DESIGN.md 기준(토스 스타일 콘텐츠 + 리퀴드 글라스 내비). 화면은 useTokens()로 꺼내 쓴다
//
// 2026-10-06 리뉴얼 1단계. 연회색 바닥 위에 순백 카드, 그림자 없음(바닥 대비로만 띄운다). 글자는 크고 굵고
// 숫자는 더 크고 굵다. 브랜드 색은 BRAND 하나로 관리한다(앱 아이콘 초록 #00DC64).
// 네비게이션 레이어(탭바·툴바·떠 있는 버튼)는 OS 글라스가 그리고, 여기 토큰은 콘텐츠 레이어 것이다.
import type { TextStyle, ViewStyle } from 'react-native';

// 2026-10-08 사장님 결정 — 앱 아이콘의 초록(#00DC64)에 맞춘다(그 전엔 블루 #3182F6). 바꾸려면 이 두 줄만
const BRAND = '#00DC64';
// 브랜드 10% 틴트 — 아이콘 배경·상태 배지. 흰 바탕에 섞은 값
const BRAND_LIGHT = '#E6FBEF';

const palette = {
  bg: '#F2F4F6',
  // 카드 안의 하위 영역·비활성 칩·입력칸
  bgSubtle: '#F9FAFB',
  card: '#FFFFFF',
  surface2: '#F9FAFB',
  // 구분선 — 꼭 필요할 때만, 카드 안에서만
  border: '#E5E8EB',
  text: '#191F28',
  textMuted: '#6B7684',
  textFaint: '#8B95A1',
  textOnAccent: '#FFFFFF',
  accent: BRAND,
  // 채운 버튼 바탕 — 아이콘 초록보다 한 톤 진하게. 흰 글자가 또렷하게 읽힌다(2026-10-08)
  accentStrong: '#00B853',
  accentSoft: BRAND_LIGHT,
  // 준 돈 — 요약에서만 쓴다. 목록 금액은 text
  given: '#F04452',
  givenSoft: '#FDECEE',
  received: BRAND,
  receivedSoft: BRAND_LIGHT,
  danger: '#F04452',
  dangerSoft: '#FDECEE',
  // 하단 탭 바(웹 JS 탭 전용. 네이티브는 OS 가 그린다)
  nav: '#FFFFFF',
};

// 화면 좌우 여백 20(xl), 카드 사이 12(md), 섹션 사이 32(xxl), 카드 안쪽 20(xl)
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 32 } as const;

// 입력칸 12, 버튼 16, 카드 20, 칩·캡슐은 완전 둥글게
export const radius = { sm: 12, md: 16, lg: 20, pill: 9999 } as const;

// display 32 주인공 숫자 / heading 24 화면 제목 / title 18 카드·목록 제목 / body 15 / caption 13
// (이름은 그대로 두고 값만 맞췄다 — 화면 파일에서 heading 은 화면 제목, title 은 카드 제목으로 써 왔다)
export const font = {
  caption: 13,
  body: 15,
  title: 18,
  heading: 24,
  display: 32,
} as const;

// 카드 — 흰 면, 모서리 20, 그림자 없음. 이름은 예전 그대로 두어 화면 파일을 건드리지 않는다
export const cardShadow: ViewStyle = {
  backgroundColor: palette.card,
  borderRadius: radius.lg,
};

// 금액 숫자는 전부 고정폭. 자릿수가 세로로 맞아야 훑을 수 있다
export const amountText: TextStyle = { fontVariant: ['tabular-nums'], letterSpacing: -0.5 };
// 주인공 숫자(display)
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
