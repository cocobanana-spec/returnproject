// 섹션 제목 — 카드 바깥, 카드 위 12pt. 우측에 "더보기" 같은 글자 버튼을 둘 수 있다(docs/DESIGN.md)
import { Pressable, Text, View } from 'react-native';
import { useTokens } from '../theme/tokens';

type Props = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function SectionHeader({ title, actionLabel, onAction }: Props) {
  const { colors, space, font } = useTokens();
  return (
    <View style={{ alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.md }}>
      <Text style={{ color: colors.text, fontSize: font.title, fontWeight: '700' }}>{title}</Text>
      {actionLabel && onAction && (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
          <Text style={{ color: colors.textMuted, fontSize: font.body, fontWeight: '500' }}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
