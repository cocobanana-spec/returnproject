// 선택 가능한 칩. 행사 종류·금액 프리셋·관계 그룹·필터에 두루 쓴다
import { Pressable, Text } from 'react-native';
import { useTokens } from '../theme/tokens';

type Props = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  tone?: 'default' | 'accent';
};

export function Chip({ label, selected = false, onPress, tone = 'default' }: Props) {
  const { colors, space, radius, font } = useTokens();
  const activeBg = tone === 'accent' ? colors.given : colors.accent;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: selected ? activeBg : colors.bgSubtle,
        borderColor: selected ? activeBg : colors.border,
        borderWidth: 1,
        borderRadius: radius.pill,
        // iOS 최소 터치 영역 44pt. 빠른 기록의 주 조작 수단이라 작으면 안 된다.
        justifyContent: 'center',
        minHeight: 44,
        paddingVertical: space.sm,
        paddingHorizontal: space.lg,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text
        style={{
          color: selected ? colors.textOnAccent : colors.text,
          fontSize: font.caption,
          fontWeight: selected ? '700' : '500',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
