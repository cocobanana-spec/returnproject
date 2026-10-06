// 버튼 — primary 는 떠 있는 캡슐(iOS 26 리퀴드 글라스, 그 밖에는 브랜드 면), secondary 는 연회색 면, danger 는 연한 빨강 면
//
// docs/DESIGN.md 1단계. 글라스는 iOS 26 에서만 OS 가 그린다(expo-glass-effect). 안드로이드·웹·옛 iOS 는
// 같은 모양의 불투명 캡슐이다 — 직접 블러·반투명을 만들지 않는다(레이어 규칙).
// `floating` 은 화면의 떠 있는 primary(기록하기) 하나에만 준다 — 그것만 글라스다.
import { ActivityIndicator, Platform, Pressable, Text, View, type ViewStyle } from 'react-native';
import { useTokens } from '../theme/tokens';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  size?: 'md' | 'sm';
  // 떠 있는 primary(기록하기)에만. iOS 26 에서 글라스 + interactive 가 된다. 콘텐츠 안의 primary 는 불투명 면이다(레이어 규칙)
  floating?: boolean;
  style?: ViewStyle;
};

// 글라스 모듈은 네이티브 전용이라 웹 번들에서 require 하지 않는다
type GlassModule = typeof import('expo-glass-effect');
let glass: GlassModule | null = null;
function loadGlass(): GlassModule | null {
  if (Platform.OS !== 'ios') return null;
  if (!glass) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    glass = require('expo-glass-effect') as GlassModule;
  }
  return glass;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  size = 'md',
  floating = false,
  style,
}: Props) {
  const { colors, space, radius, font } = useTokens();
  const off = disabled || loading;
  const g = variant === 'primary' && floating ? loadGlass() : null;
  const useGlass = !!g && g.isLiquidGlassAvailable();

  const bg = variant === 'primary' ? colors.accent : variant === 'danger' ? colors.dangerSoft : colors.surface2;
  const fg = variant === 'primary' ? colors.textOnAccent : variant === 'danger' ? colors.danger : colors.text;
  const height = size === 'sm' ? 40 : 56;

  const inner = loading ? (
    <ActivityIndicator color={fg} />
  ) : (
    <Text style={{ color: fg, fontSize: size === 'sm' ? font.body : 17, fontWeight: '700' }}>{label}</Text>
  );

  // 글라스 캡슐 — 면은 OS 가 그리고(tint = 브랜드), 우리는 글자만 올린다
  if (useGlass && g) {
    const { GlassView } = g;
    return (
      <Pressable accessibilityRole="button" disabled={off} onPress={onPress} style={({ pressed }) => ({ opacity: off ? 0.55 : pressed ? 0.85 : 1 })}>
        <GlassView
          glassEffectStyle="regular"
          tintColor={colors.accent}
          isInteractive
          style={[{ alignItems: 'center', borderRadius: radius.pill, height, justifyContent: 'center', paddingHorizontal: space.xl }, style]}
        >
          {inner}
        </GlassView>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        {
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bg,
          borderRadius: variant === 'primary' ? radius.pill : radius.md,
          height,
          paddingHorizontal: space.xl,
          opacity: off || pressed ? 0.55 : 1,
        },
        style,
      ]}
    >
      <View>{inner}</View>
    </Pressable>
  );
}
