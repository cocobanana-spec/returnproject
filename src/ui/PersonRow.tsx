// 사람 한 줄. 목록·자동완성·병합 대상 고르기에서 같은 모양을 쓴다
import { Pressable, Text, View } from 'react-native';
import { balanceHint, personSubtitle, type PersonSummary } from '../domain/person.ts';
import { formatBalance } from '../domain/money.ts';
import { useTokens } from '../theme/tokens';

type Props = {
  person: PersonSummary & { id?: string | null; balance?: number | null };
  onPress?: () => void;
  showBalance?: boolean;
  right?: string;
};

export function PersonRow({ person, onPress, showBalance = false, right }: Props) {
  const { colors, space, font } = useTokens();
  const subtitle = personSubtitle(person);
  const hint = balanceHint(person);
  const balance = person.balance ?? 0;
  const formatted = formatBalance(balance);

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        flexDirection: 'row',
        gap: space.md,
        paddingVertical: space.md,
        opacity: pressed && onPress ? 0.6 : 1,
      })}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '600' }} numberOfLines={1}>
          {person.name ?? ''}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: font.caption, marginTop: 2 }} numberOfLines={1}>
          {[subtitle, hint].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {right !== undefined ? (
        <Text style={{ color: colors.textMuted, fontSize: font.caption }}>{right}</Text>
      ) : showBalance && (person.entry_count ?? 0) > 0 ? (
        <Text
          style={{
            color:
              formatted.direction === 'given'
                ? colors.given
                : formatted.direction === 'received'
                  ? colors.received
                  : colors.textMuted,
            fontSize: font.caption,
            fontWeight: '600',
          }}
        >
          {formatted.text}
        </Text>
      ) : null}
    </Pressable>
  );
}
