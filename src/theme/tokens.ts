// 색·간격·글꼴 크기 디자인 토큰. 라이트/다크 두 벌만 두고 화면은 useTokens()로 꺼내 쓴다
import { useColorScheme } from 'react-native';

const palette = {
  // 준돈(내가 낸 돈)은 차분한 파랑, 받은돈은 따뜻한 주황으로 구분한다
  given: '#2563EB',
  givenDark: '#60A5FA',
  received: '#D97706',
  receivedDark: '#FBBF24',
  danger: '#DC2626',
  dangerDark: '#F87171',
};

const light = {
  bg: '#FFFFFF',
  bgSubtle: '#F5F5F4',
  card: '#FFFFFF',
  border: '#E7E5E4',
  text: '#1C1917',
  textMuted: '#78716C',
  textOnAccent: '#FFFFFF',
  accent: '#1C1917',
  given: palette.given,
  received: palette.received,
  danger: palette.danger,
};

const dark: typeof light = {
  bg: '#1C1917',
  bgSubtle: '#292524',
  card: '#292524',
  border: '#44403C',
  text: '#FAFAF9',
  textMuted: '#A8A29E',
  textOnAccent: '#1C1917',
  accent: '#FAFAF9',
  given: palette.givenDark,
  received: palette.receivedDark,
  danger: palette.dangerDark,
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

export const font = {
  caption: 12,
  body: 15,
  title: 18,
  heading: 22,
  display: 28,
} as const;

export type Colors = typeof light;

export const colors = { light, dark } as const;

export function useTokens() {
  const scheme = useColorScheme();
  return {
    colors: scheme === 'dark' ? dark : light,
    isDark: scheme === 'dark',
    space,
    radius,
    font,
  };
}
