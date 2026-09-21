// 홈(S01) — 이번 차수에는 현재 장부와 기록 시작점만 둔다. 요약 카드와 최근 기록은 2차에서 채운다
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLedger } from '../../../src/ledger/LedgerProvider';
import { Screen } from '../../../src/ui/Screen';
import { useTokens } from '../../../src/theme/tokens';

export default function HomeScreen() {
  const { current } = useLedger();
  const { colors, space, font, radius } = useTokens();
  const router = useRouter();

  return (
    <Screen>
      <View style={{ flex: 1 }}>
        <Pressable onPress={() => router.push('/ledger')}>
          <Text style={{ color: colors.textMuted, fontSize: font.caption }}>현재 장부</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs }}>
            <Text style={{ color: colors.text, fontSize: font.heading, fontWeight: '700' }}>
              {current?.name ?? '내 장부'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        </Pressable>

        <View
          style={{
            marginTop: space.xl,
            padding: space.lg,
            backgroundColor: colors.bgSubtle,
            borderRadius: radius.lg,
          }}
        >
          <Text style={{ color: colors.textMuted, fontSize: font.caption, lineHeight: 20 }}>
            올해 요약과 최근 기록은 다음 차수에서 들어옵니다.{'\n'}
            지금은 아래 버튼으로 준돈을 기록하고 사람 탭에서 원장을 볼 수 있습니다.
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/record')}
        style={({ pressed }) => ({
          alignItems: 'center',
          backgroundColor: colors.accent,
          borderRadius: radius.pill,
          flexDirection: 'row',
          gap: space.sm,
          justifyContent: 'center',
          paddingVertical: space.lg,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Ionicons name="add" size={20} color={colors.textOnAccent} />
        <Text style={{ color: colors.textOnAccent, fontSize: font.body, fontWeight: '700' }}>기록</Text>
      </Pressable>
    </Screen>
  );
}
