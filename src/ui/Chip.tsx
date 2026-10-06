// 선택 가능한 칩 — 선택하면 진한 글자색 면에 흰 글자, 아니면 연회색 면에 보조 글자색. 브랜드 색은 안 쓴다(docs/DESIGN.md)
import { Pressable, Text } from 'react-native';
import { useTokens } from '../theme/tokens';

type Props = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  // 'accent' 는 브랜드 틴트 면 + 브랜드 글자(상태 배지 같은 곳). 선택 칩에는 쓰지 않는다
  tone?: 'default' | 'accent';
};

export function Chip({ label, selected = false, onPress, tone = 'default' }: Props) {
  const { colors, space, radius, font } = useTokens();
  const bg = tone === 'accent' ? colors.accentSoft : selected ? colors.text : colors.surface2;
  const fg = tone === 'accent' ? colors.accent : selected ? colors.textOnAccent : colors.textMuted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: bg,
        borderRadius: radius.pill,
        // iOS 최소 터치 영역 44pt. 빠른 기록의 주 조작 수단이라 작으면 안 된다.
        justifyContent: 'center',
        minHeight: 44,
        paddingVertical: space.sm,
        paddingHorizontal: space.lg,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ color: fg, fontSize: font.body, fontWeight: selected ? '700' : '500' }}>{label}</Text>
    </Pressable>
  );
}
