// 목록이 비었을 때의 한 줄 안내와 시작 버튼. 온보딩 화면을 두지 않는 대신 여기서 길을 알려 준다
import { Text, View } from 'react-native';
import { Button } from './Button';
import { useTokens } from '../theme/tokens';

type Props = {
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, hint, actionLabel, onAction }: Props) {
  const { colors, space, font } = useTokens();
  return (
    <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xxl }}>
      <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '600' }}>{title}</Text>
      {hint && (
        <Text style={{ color: colors.textMuted, fontSize: font.caption, textAlign: 'center', lineHeight: 20 }}>
          {hint}
        </Text>
      )}
      {actionLabel && onAction && (
        <Button label={actionLabel} onPress={onAction} size="sm" style={{ marginTop: space.sm }} />
      )}
    </View>
  );
}
