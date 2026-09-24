// 더보기 탭(S13) — 이번 차수에는 장부로 가는 입구와 로그아웃만 둔다
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLedger } from '../../../src/ledger/LedgerProvider';
import { useTokens } from '../../../src/theme/tokens';
import { Screen } from '../../../src/ui/Screen';

function Row({ icon, label, hint, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  onPress: () => void;
}) {
  const { colors, space, font } = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        flexDirection: 'row',
        gap: space.md,
        paddingVertical: space.lg,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon} size={20} color={colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: font.body }}>{label}</Text>
        {hint && (
          <Text style={{ color: colors.textMuted, fontSize: font.caption, marginTop: 2 }}>{hint}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export default function MoreScreen() {
  const router = useRouter();
  const { current, ledgers } = useLedger();
  const { colors, space, font } = useTokens();

  return (
    <Screen scroll>
      <Text style={{ color: colors.text, fontSize: font.heading, fontWeight: '700', marginBottom: space.lg }}>
        더보기
      </Text>

      <Row
        icon="book-outline"
        label="장부"
        hint={`${current?.name ?? '내 장부'}${ledgers.length > 1 ? ` 외 ${ledgers.length - 1}권` : ''}`}
        onPress={() => router.push('/ledger')}
      />
      <Row
        icon="person-circle-outline"
        label="계정"
        hint="로그아웃, 계정 삭제"
        onPress={() => router.push('/account')}
      />

      <Text
        style={{ color: colors.textMuted, fontSize: font.caption, marginTop: space.xl, lineHeight: 20 }}
      >
        통계·기록 검색·데이터 내보내기는 다음 단계(P1)에서 들어옵니다.
      </Text>
    </Screen>
  );
}
