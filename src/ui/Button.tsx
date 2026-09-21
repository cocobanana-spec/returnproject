// 버튼 한 종류로 primary·secondary·danger 세 모양을 낸다
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
  const fg =
    variant === 'primary' ? colors.textOnAccent : variant === 'danger' ? '#FFFFFF' : colors.text;

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
          borderColor: variant === 'secondary' ? colors.border : bg,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderRadius: radius.md,
          paddingVertical: size === 'sm' ? space.sm : space.lg,
          paddingHorizontal: space.lg,
          opacity: off || pressed ? 0.55 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontSize: size === 'sm' ? font.caption : font.body, fontWeight: '600' }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
