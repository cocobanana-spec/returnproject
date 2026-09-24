// 홈(S01) — 올해 요약 카드 2개, 다가오는 행사 3개, 최근 기록 10건, 기록 FAB
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { DatePrecision } from '../../../src/domain/constants.ts';
import { directionLabel, entrySubtitle } from '../../../src/domain/entry.ts';
import { eventTypeLabel } from '../../../src/domain/event.ts';
import { formatWon, formatWonShort } from '../../../src/domain/money.ts';
import { formatEventDate, todayISO } from '../../../src/domain/title.ts';
import { useLedger, useLedgerId } from '../../../src/ledger/LedgerProvider';
import { queryKeys } from '../../../src/lib/queryKeys';
import { listRecentEntries } from '../../../src/repositories/entries';
import { listUpcomingEvents } from '../../../src/repositories/events';
import { getYearStats } from '../../../src/repositories/stats';
import { useTokens } from '../../../src/theme/tokens';
import { EmptyState } from '../../../src/ui/EmptyState';
import { LoadFailed } from '../../../src/ui/LoadFailed';

export default function HomeScreen() {
  const ledgerId = useLedgerId();
  const { current } = useLedger();
  const router = useRouter();
  const { colors, space, font, radius } = useTokens();
  const insets = useSafeAreaInsets();

  const today = todayISO();
  const year = Number(today.slice(0, 4));

  const stats = useQuery({
    queryKey: queryKeys.stats.byYear(ledgerId, year),
    queryFn: () => getYearStats(ledgerId, year),
  });

  const upcoming = useQuery({
    queryKey: queryKeys.events.upcoming(ledgerId),
    queryFn: () => listUpcomingEvents(ledgerId, today, 3),
  });

  const recent = useQuery({
    queryKey: queryKeys.entries.recent(ledgerId),
    queryFn: () => listRecentEntries(ledgerId, 10),
  });

  const given = stats.data?.givenTotal ?? 0;
  const received = stats.data?.receivedTotal ?? 0;
  const recentRows = recent.data ?? [];
  const upcomingRows = upcoming.data ?? [];
  const loading = stats.isLoading || recent.isLoading || upcoming.isLoading;
  // 조회가 실패했을 때 빈 배열을 "기록이 없다"로 읽으면 안 된다.
  // RLS·네트워크·만료 토큰은 전부 빈 결과처럼 보이는데, 그걸 온보딩 문구로 덮으면
  // 사용자가 자기 데이터가 사라진 줄 안다(context-notes §11.1의 교훈과 같은 함정).
  const failed = stats.isError || recent.isError || upcoming.isError;
  const empty =
    !loading &&
    !failed &&
    recentRows.length === 0 &&
    upcomingRows.length === 0 &&
    given === 0 &&
    received === 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + space.md,
          paddingBottom: insets.bottom + 96,
          paddingHorizontal: space.xl,
          gap: space.xl,
        }}
      >
        {/* 현재 장부 */}
        <Pressable onPress={() => router.push('/ledger')}>
          <Text style={{ color: colors.textMuted, fontSize: font.caption }}>현재 장부</Text>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: space.xs, marginTop: space.xs }}>
            <Text style={{ color: colors.text, fontSize: font.heading, fontWeight: '700' }}>
              {current?.name ?? '내 장부'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        </Pressable>

        {loading ? (
          <ActivityIndicator color={colors.textMuted} style={{ marginTop: space.xl }} />
        ) : failed ? (
          <LoadFailed
            title="장부를 불러오지 못했습니다"
            onRetry={() => {
              void stats.refetch();
              void recent.refetch();
              void upcoming.refetch();
            }}
          />
        ) : empty ? (
          <EmptyState
            title="첫 기록을 남겨 보세요"
            hint={'경조사에 낸 돈을 기록하면\n사람별로 주고받은 내역이 쌓입니다.'}
            actionLabel="기록 남기기"
            onAction={() => router.push('/record')}
          />
        ) : (
          <>
            {/* 올해 요약 */}
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <SummaryCard
                label={`${year}년 준 돈`}
                amount={given}
                tone="given"
                count={stats.data?.givenCount ?? 0}
              />
              <SummaryCard
                label={`${year}년 받은 돈`}
                amount={received}
                tone="received"
                count={stats.data?.receivedCount ?? 0}
              />
            </View>
            {(stats.data?.unconfirmedCount ?? 0) > 0 && (
              <Text style={{ color: colors.textMuted, fontSize: font.caption, marginTop: -space.md }}>
                미확정 {stats.data?.unconfirmedCount}건은 합계에서 빠져 있습니다.
              </Text>
            )}

            {/* 다가오는 행사 */}
            {upcomingRows.length > 0 && (
              <View style={{ gap: space.sm }}>
                <Text style={{ color: colors.textMuted, fontSize: font.caption }}>다가오는 행사</Text>
                {upcomingRows.map((e) => (
                  <Pressable
                    key={e.id}
                    onPress={() => router.push(`/event/${e.id}`)}
                    style={({ pressed }) => ({
                      alignItems: 'center',
                      backgroundColor: colors.bgSubtle,
                      borderRadius: radius.md,
                      flexDirection: 'row',
                      gap: space.md,
                      paddingHorizontal: space.lg,
                      paddingVertical: space.md,
                      opacity: pressed ? 0.6 : 1,
                    })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: font.body }} numberOfLines={1}>
                        {e.title}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: font.caption, marginTop: 2 }}>
                        {formatEventDate(e.date, e.date_precision as DatePrecision)} · {eventTypeLabel(e.type)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            )}

            {/* 최근 기록 */}
            <View style={{ gap: space.sm }}>
              <Text style={{ color: colors.textMuted, fontSize: font.caption }}>최근 기록</Text>
              {recentRows.length === 0 ? (
                <Text style={{ color: colors.textMuted, fontSize: font.caption }}>아직 기록이 없습니다.</Text>
              ) : (
                recentRows.map((item) => {
                  const isMine = item.event?.is_mine ?? false;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => router.push(`/entry/${item.id}`)}
                      style={({ pressed }) => ({
                        alignItems: 'center',
                        borderBottomColor: colors.border,
                        borderBottomWidth: 1,
                        flexDirection: 'row',
                        gap: space.md,
                        paddingVertical: space.md,
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: font.body }} numberOfLines={1}>
                          {item.person?.name ?? ''}
                          {item.co_person ? ` (+${item.co_person.name})` : ''}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: font.caption, marginTop: 2 }}>
                          {item.event?.title ?? ''} · {entrySubtitle(item.event)} · {directionLabel(isMine)}
                        </Text>
                      </View>
                      <Text
                        style={{
                          color:
                            item.amount === null ? colors.textMuted : isMine ? colors.received : colors.given,
                          fontSize: font.body,
                          fontWeight: '700',
                        }}
                      >
                        {formatWonShort(item.amount)}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* 기록 FAB — 어디서 스크롤하든 항상 닿는다.
          배경을 함께 깔아 목록이 버튼에 반쯤 가려 보이지 않게 한다 */}
      <View
        pointerEvents="box-none"
        style={{
          backgroundColor: colors.bg,
          bottom: 0,
          left: 0,
          paddingBottom: insets.bottom + space.lg,
          paddingHorizontal: space.xl,
          paddingTop: space.md,
          position: 'absolute',
          right: 0,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="기록 남기기"
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
      </View>
    </View>
  );
}

function SummaryCard({
  label,
  amount,
  tone,
  count,
}: {
  label: string;
  amount: number;
  tone: 'given' | 'received';
  count: number;
}) {
  const { colors, space, font, radius } = useTokens();
  return (
    <View
      style={{
        backgroundColor: colors.bgSubtle,
        borderRadius: radius.lg,
        flex: 1,
        padding: space.lg,
      }}
    >
      <Text style={{ color: colors.textMuted, fontSize: font.caption }}>{label}</Text>
      <Text
        style={{
          color: tone === 'given' ? colors.given : colors.received,
          fontSize: font.title,
          fontWeight: '700',
          marginTop: space.xs,
        }}
      >
        {formatWon(amount)}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: font.caption, marginTop: 2 }}>{count}건</Text>
    </View>
  );
}
