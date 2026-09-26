// 홈(S01) — 준 돈 총액과 받은 돈 총액 두 숫자만 크게 보여 주는 대시보드
//
// 2026-09-26 사용자 요청 — "홈탭에 대시보드 형태로 준돈 얼마, 받은돈 얼마 2개 항목을 딱 표기해줘".
// 목록은 기록 탭으로 옮겼다. 여기에 욕심내서 무엇을 더 붙이면 "딱 2개"라는 요청이 깨진다.
// 총액은 **전체 기간**이다. 올해로 묶으면 2020년 결혼식 축의금이 통째로 빠져 0원으로 보인다.
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatWon } from '../../../src/domain/money.ts';
import { useLedger, useLedgerId } from '../../../src/ledger/LedgerProvider';
import { queryKeys } from '../../../src/lib/queryKeys';
import { getYearStats } from '../../../src/repositories/stats';
import { useTokens } from '../../../src/theme/tokens';
import { LoadFailed } from '../../../src/ui/LoadFailed';
import { Screen } from '../../../src/ui/Screen';

export default function HomeScreen() {
  const ledgerId = useLedgerId();
  const { current } = useLedger();
  const router = useRouter();
  const { colors, space, font, radius } = useTokens();

  const stats = useQuery({
    queryKey: queryKeys.stats.byYear(ledgerId, null),
    queryFn: () => getYearStats(ledgerId, null),
  });

  if (stats.isError) {
    return (
      <Screen>
        <LoadFailed title="총액을 불러오지 못했습니다" onRetry={() => void stats.refetch()} />
      </Screen>
    );
  }

  const d = stats.data;

  return (
    <Screen scroll>
      <View style={{ gap: space.lg, paddingTop: space.xl }}>
        <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
          {current?.name ?? '장부'} · 전체 기간
        </Text>

        <Total
          label="준 돈"
          amount={d?.givenTotal ?? 0}
          count={d?.givenCount ?? 0}
          color={colors.given}
          loading={stats.isLoading}
          onPress={() => router.push('/records')}
        />
        <Total
          label="받은 돈"
          amount={d?.receivedTotal ?? 0}
          count={d?.receivedCount ?? 0}
          color={colors.received}
          loading={stats.isLoading}
          onPress={() => router.push('/records')}
        />

        {(d?.unconfirmedCount ?? 0) > 0 && (
          <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
            미확정 {d?.unconfirmedCount}건은 합계에서 빠져 있습니다.
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/records')}
          style={({ pressed }) => ({
            alignItems: 'center',
            borderColor: colors.border,
            borderRadius: radius.lg,
            borderWidth: 1,
            flexDirection: 'row',
            gap: space.sm,
            justifyContent: 'center',
            paddingVertical: space.md,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Ionicons name="list-outline" size={18} color={colors.text} />
          <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '600' }}>기록 보기</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function Total({
  label,
  amount,
  count,
  color,
  loading,
  onPress,
}: {
  label: string;
  amount: number;
  count: number;
  color: string;
  loading: boolean;
  onPress: () => void;
}) {
  const { colors, space, font, radius } = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${formatWon(amount)}`}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: colors.bgSubtle,
        borderRadius: radius.lg,
        gap: space.xs,
        padding: space.xl,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ color: colors.textMuted, fontSize: font.body }}>{label}</Text>
      {loading ? (
        <ActivityIndicator color={colors.textMuted} style={{ alignSelf: 'flex-start' }} />
      ) : (
        <Text
          style={{
            color,
            fontSize: font.display ?? font.title + 12,
            fontVariant: ['tabular-nums'],
            fontWeight: '800',
          }}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          numberOfLines={1}
        >
          {formatWon(amount)}
        </Text>
      )}
      <Text style={{ color: colors.textMuted, fontSize: font.caption }}>{count}건</Text>
    </Pressable>
  );
}
