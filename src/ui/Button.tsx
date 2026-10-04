// 버튼 한 종류로 primary·secondary·danger 세 모양을 낸다 — Green Deck: 알약, primary 는 초록 면
import { ActivityIndicator, Pressable, Text, type ViewStyle } from 'react-native';
import { useTokens } from '../theme/tokens';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  size?: 'md' | 'sm';
  style?: ViewStyle;
};

// secondary 는 문서대로 1px #727272 선만 두고 면은 비운다
const SECONDARY_BORDER = '#727272';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  size = 'md',
  style,
}: Props) {
  const { colors, space, radius, font } = useTokens();
  const off = disabled || loading;

  const bg =
    variant === 'primary' ? colors.accent : variant === 'danger' ? colors.danger : 'transparent';
  const fg = variant === 'secondary' ? colors.text : colors.textOnAccent;

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
          borderColor: variant === 'secondary' ? SECONDARY_BORDER : bg,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderRadius: radius.pill,
          paddingVertical: size === 'sm' ? space.sm : space.lg,
          paddingHorizontal: space.xl,
          opacity: off || pressed ? 0.55 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontSize: size === 'sm' ? font.caption : font.body, fontWeight: '700' }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
