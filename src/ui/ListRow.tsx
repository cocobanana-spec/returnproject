// 목록 한 행 — [40pt 원형 아이콘(브랜드 틴트 바탕)] [제목 + 캡션] [우측 금액·값]. 높이 64 이상, 구분선 없음(docs/DESIGN.md)
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { amountText, useTokens } from '../theme/tokens';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  icon?: IoniconName;
  // 아이콘 원 색. 기본은 브랜드 틴트. 파괴 동작은 'danger'(연한 빨강)
  iconTone?: 'brand' | 'danger' | 'muted';
  title: string;
  caption?: string;
  // 우측 값 — 금액은 고정폭 숫자로 그린다
  value?: string;
  valueTone?: 'default' | 'muted';
  // 우측에 값 대신 넣을 것(배지·chevron 등)
  right?: ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  onTitlePress?: () => void;
  // 제목이 길 때 두 줄까지 허용(요약 카드의 '보낸 축의금·조의금' 같은 라벨)
  titleLines?: number;
};

export function ListRow({ icon, iconTone = 'brand', title, caption, value, valueTone = 'default', right, chevron = false, onPress, onTitlePress, titleLines = 1 }: Props) {
  const { colors, space, font, radius } = useTokens();
  const circleBg = iconTone === 'danger' ? colors.dangerSoft : iconTone === 'muted' ? colors.surface2 : colors.accentSoft;
  const circleFg = iconTone === 'danger' ? colors.danger : iconTone === 'muted' ? colors.textMuted : colors.accent;

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        flexDirection: 'row',
        gap: space.md,
        minHeight: 64,
        paddingHorizontal: space.xl,
        paddingVertical: space.md,
        opacity: pressed && onPress ? 0.6 : 1,
      })}
    >
      {icon && (
        <View style={{ alignItems: 'center', backgroundColor: circleBg, borderRadius: radius.pill, height: 40, justifyContent: 'center', width: 40 }}>
          <Ionicons name={icon} size={20} color={circleFg} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        {onTitlePress ? (
          <Pressable onPress={onTitlePress} hitSlop={6} style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: pressed ? 0.5 : 1 })}>
            <Text style={{ color: colors.text, fontSize: font.title, fontWeight: '700' }} numberOfLines={titleLines}>{title}</Text>
          </Pressable>
        ) : (
          <Text style={{ color: colors.text, fontSize: font.title, fontWeight: '700' }} numberOfLines={titleLines}>{title}</Text>
        )}
        {caption ? <Text style={{ color: colors.textMuted, fontSize: font.caption }} numberOfLines={1}>{caption}</Text> : null}
      </View>
      {value !== undefined && (
        <Text style={{ ...amountText, color: valueTone === 'muted' ? colors.textFaint : colors.text, fontSize: font.title, fontWeight: '700' }} numberOfLines={1}>
          {value}
        </Text>
      )}
      {right}
      {chevron && <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />}
    </Pressable>
  );
}
