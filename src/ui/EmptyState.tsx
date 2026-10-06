// 목록이 비었을 때 — 가운데 큰 아이콘 + 한 줄 제목 + 안내 한 줄 + (있으면) 시작 버튼. 온보딩 화면 대신 여기서 길을 알려 준다
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Text, View } from 'react-native';
import { Button } from './Button';
import { useTokens } from '../theme/tokens';

type Props = {
  title: string;
  hint?: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, hint, icon, actionLabel, onAction }: Props) {
  const { colors, space, font, radius } = useTokens();
  return (
    <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xxl }}>
      {icon && (
        <View style={{ alignItems: 'center', backgroundColor: colors.accentSoft, borderRadius: radius.pill, height: 72, justifyContent: 'center', marginBottom: space.xs, width: 72 }}>
          <Ionicons name={icon} size={34} color={colors.accent} />
        </View>
      )}
      <Text style={{ color: colors.text, fontSize: font.title, fontWeight: '700' }}>{title}</Text>
      {hint && (
        <Text style={{ color: colors.textMuted, fontSize: font.body, fontWeight: '500', lineHeight: 22, textAlign: 'center' }}>
          {hint}
        </Text>
      )}
      {actionLabel && onAction && (
        <Button label={actionLabel} onPress={onAction} size="sm" style={{ marginTop: space.sm }} />
      )}
    </View>
  );
}
