// 사람 한 줄. 목록·자동완성·병합 대상 고르기에서 같은 모양을 쓴다
import { Pressable, Text, View } from 'react-native';
import { displayName, distinguishLine, type PersonSummary } from '../domain/person.ts';
import { formatBalance } from '../domain/money.ts';
import { useTokens } from '../theme/tokens';

type Props = {
  person: PersonSummary & { id?: string | null; balance?: number | null };
  onPress?: () => void;
  showBalance?: boolean;
  right?: string;
  // 동명이인인데 라벨이 없을 때 "구분 없음" 같은 짧은 표시를 붙인다.
  flag?: string;
  // 목록 안 중복 이름 키. 구별 줄이 라벨 없는 동명이인에게 "구분 없음"을 붙일 때 쓴다.
  dupKeys?: Set<string>;
};

export function PersonRow({ person, onPress, showBalance = false, right, flag, dupKeys }: Props) {
  const { colors, space, font } = useTokens();
  const subtitle = distinguishLine(person, dupKeys);
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
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: space.xs }}>
          <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '600' }} numberOfLines={1}>
            {displayName(person)}
          </Text>
          {flag && (
            <View
              style={{
                backgroundColor: colors.bgSubtle,
                borderRadius: 6,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <Text style={{ color: colors.danger, fontSize: font.caption - 2 }}>{flag}</Text>
            </View>
          )}
        </View>
        <Text style={{ color: colors.textMuted, fontSize: font.caption, marginTop: 2 }} numberOfLines={1}>
          {subtitle}
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
