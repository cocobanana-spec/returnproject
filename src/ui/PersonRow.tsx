// 사람 한 줄 — 카드 안 행(사람 아이콘 원 + 이름·구별 줄 + 우측 차액). 목록·자동완성·병합 대상 고르기에서 같은 모양을 쓴다
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { displayName, distinguishLine, type PersonSummary } from '../domain/person.ts';
import { formatBalance } from '../domain/money.ts';
import { amountText, useTokens } from '../theme/tokens';

type Props = {
  person: PersonSummary & { id?: string | null; balance?: number | null };
  onPress?: () => void;
  showBalance?: boolean;
  right?: string;
  // 동명이인인데 라벨이 없을 때 "구분 없음" 같은 짧은 표시를 붙인다.
  flag?: string;
  // 카드 안 행이 아닌 곳(자동완성 목록 등)에서는 좌우 여백을 뺀다
  compact?: boolean;
};

export function PersonRow({ person, onPress, showBalance = false, right, flag, compact = false }: Props) {
  const { colors, space, font, radius } = useTokens();
  // 목록에서는 "구분 없음"을 배지(flag)로 그린다. 구별 줄 끝에 붙이면 한 줄 잘림에 묻힌다.
  const subtitle = distinguishLine(person);
  const balance = person.balance ?? 0;
  const formatted = formatBalance(balance);

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        flexDirection: 'row',
        gap: space.md,
        minHeight: compact ? 52 : 64,
        paddingHorizontal: compact ? 0 : space.xl,
        paddingVertical: space.md,
        opacity: pressed && onPress ? 0.6 : 1,
      })}
    >
      {!compact && (
        <View style={{ alignItems: 'center', backgroundColor: colors.surface2, borderRadius: radius.pill, height: 40, justifyContent: 'center', width: 40 }}>
          <Ionicons name="person" size={20} color={colors.textMuted} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: space.xs }}>
          <Text style={{ color: colors.text, fontSize: compact ? font.body : font.title, fontWeight: '700' }} numberOfLines={1}>
            {displayName(person)}
          </Text>
          {flag && (
            <View style={{ backgroundColor: colors.dangerSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ color: colors.danger, fontSize: font.caption - 1, fontWeight: '600' }}>{flag}</Text>
            </View>
          )}
        </View>
        {subtitle ? (
          <Text style={{ color: colors.textMuted, fontSize: font.caption, marginTop: 2 }} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right !== undefined ? (
        <Text style={{ color: colors.textMuted, fontSize: font.caption }}>{right}</Text>
      ) : showBalance && (person.entry_count ?? 0) > 0 ? (
        <Text style={{ ...amountText, color: formatted.direction === 'even' ? colors.textFaint : colors.text, fontSize: font.body, fontWeight: '700' }}>
          {formatted.text}
        </Text>
      ) : null}
    </Pressable>
  );
}
