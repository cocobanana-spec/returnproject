// 통계(S11) — 연도 세그먼트, 총계와 차액, 종류별·그룹별 막대, 사람별 상위
//
// stats_by_year를 연도마다 부르지 않는다. p_year 없이 한 번 받아 도메인 함수가 연도를 뽑고
// 연도별로 접는다(docs/03 §5). 왕복을 늘리지 않는 것이 이 화면의 설계 전제다.
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { formatWon, formatWonShort } from '../../../src/domain/money.ts';
import {
  defaultYear,
  foldYearStatsFor,
  topPeopleScopeLabel,
  yearsOf,
  type Bucket,
} from '../../../src/domain/stats.ts';
import { todayISO } from '../../../src/domain/title.ts';
import { useLedgerId } from '../../../src/ledger/LedgerProvider';
import { queryKeys } from '../../../src/lib/queryKeys';
import { displayName } from '../../../src/domain/person.ts';
import { listPeopleByIds } from '../../../src/repositories/people';
import { listStatsRows, listTopPeopleByYear } from '../../../src/repositories/stats';
import { useTokens } from '../../../src/theme/tokens';
import { Chip } from '../../../src/ui/Chip';
import { EmptyState } from '../../../src/ui/EmptyState';
import { LoadFailed } from '../../../src/ui/LoadFailed';

export default function StatsScreen() {
  const ledgerId = useLedgerId();
  const router = useRouter();
  const { colors, space, font, radius } = useTokens();
  const insets = useSafeAreaInsets();

  const thisYear = Number(todayISO().slice(0, 4));
  // 사용자가 직접 고르기 전에는 데이터에 맞춰 기본 연도를 정한다.
  const [picked, setPicked] = useState<{ year: number | null } | null>(null);

  const raw = useQuery({
    queryKey: queryKeys.stats.allYears(ledgerId),
    queryFn: () => listStatsRows(ledgerId),
  });

  const rows = useMemo(() => raw.data ?? [], [raw.data]);
  const years = useMemo(() => yearsOf(rows), [rows]);
  // 고른 적이 없거나 고른 연도가 세그먼트에서 사라졌으면(기록을 다 지운 경우) 기본값으로 돌린다.
  const year =
    picked && (picked.year === null || years.includes(picked.year))
      ? picked.year
      : defaultYear(years, thisYear);
  const stats = useMemo(() => foldYearStatsFor(rows, year), [rows, year]);
  const setYear = (next: number | null) => setPicked({ year: next });

  // 사람별 상위는 전체 기간이 기본이고, 위 세그먼트의 연도로 좁힐 수 있다(2026-09-24 사용자 결정).
  const [topScope, setTopScope] = useState<'all' | 'year'>('all');
  const topYear = topScope === 'year' ? year : null;
  const topPeople = useQuery({
    queryKey: queryKeys.stats.topPeople(ledgerId, topYear),
    queryFn: () => listTopPeopleByYear(ledgerId, topYear),
    enabled: rows.length > 0,
  });

  // RPC 결과에는 구분 라벨이 없다. 상위 몇 명의 라벨만 따로 받아 붙인다.
  const topIds = (topPeople.data ?? []).map((p) => p.id);
  const topLabels = useQuery({
    queryKey: queryKeys.people.list(ledgerId, { ids: topIds }),
    queryFn: () => listPeopleByIds(ledgerId, topIds),
    enabled: topIds.length > 0,
  });
  const labelOf = new Map((topLabels.data ?? []).map((p) => [p.id as string, p.label]));

  const hasAnything = rows.length > 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        gap: space.xl,
        paddingBottom: insets.bottom + space.xxl,
        paddingHorizontal: space.xl,
        paddingTop: insets.top + space.md,
      }}
    >
      <Text style={{ color: colors.text, fontSize: font.heading, fontWeight: '700' }}>통계</Text>

      {raw.isLoading ? (
        <ActivityIndicator color={colors.textMuted} style={{ marginTop: space.xxl }} />
      ) : raw.isError ? (
        <LoadFailed title="통계를 불러오지 못했습니다" onRetry={() => void raw.refetch()} />
      ) : !hasAnything ? (
        <EmptyState
          title="아직 집계할 기록이 없습니다"
          hint={'경조사를 기록하면 연도별로\n준 돈과 받은 돈이 쌓입니다.'}
          actionLabel="기록 남기기"
          onAction={() => router.push('/record')}
        />
      ) : (
        <>
          {/* 연도 세그먼트 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Chip label="전체" selected={year === null} onPress={() => setYear(null)} />
              {years.map((y) => (
                <Chip key={y} label={`${y}년`} selected={year === y} onPress={() => setYear(y)} />
              ))}
            </View>
          </ScrollView>

          {/* 총계와 차액 */}
          <View
            style={{
              backgroundColor: colors.bgSubtle,
              borderRadius: radius.lg,
              gap: space.md,
              padding: space.lg,
            }}
          >
            <Line
              label="준 돈"
              amount={stats.givenTotal}
              count={stats.givenCount}
              color={colors.given}
            />
            <Line
              label="받은 돈"
              amount={stats.receivedTotal}
              count={stats.receivedCount}
              color={colors.received}
            />
            <View style={{ borderTopColor: colors.border, borderTopWidth: 1, paddingTop: space.md }}>
              <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
                {stats.balance >= 0 ? '더 낸 금액' : '더 받은 금액'}
              </Text>
              <Text
                style={{ color: colors.text, fontSize: font.title, fontWeight: '700', marginTop: 2 }}
              >
                {formatWon(Math.abs(stats.balance))}
              </Text>
            </View>
            {stats.unconfirmedCount > 0 && (
              <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
                미확정 {stats.unconfirmedCount}건은 합계에서 빠져 있습니다.
              </Text>
            )}
          </View>

          <Bars title="준 돈 — 경조사 종류별" buckets={stats.givenByType} color={colors.given} />
          <Bars title="준 돈 — 관계별" buckets={stats.givenByGroup} color={colors.given} />
          <Bars title="받은 돈 — 경조사 종류별" buckets={stats.receivedByType} color={colors.received} />
          <Bars title="받은 돈 — 관계별" buckets={stats.receivedByGroup} color={colors.received} />

          {/* 사람별 상위 */}
          <View style={{ gap: space.sm }}>
            <View style={{ gap: 2 }}>
              <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
                차액이 큰 사람 ({topPeopleScopeLabel(topYear)})
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: font.caption - 1 }}>
                공동 부조는 두 사람 모두에게 계산됩니다.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Chip label="전체 기간" selected={topScope === 'all'} onPress={() => setTopScope('all')} />
              {year !== null && (
                <Chip label={`${year}년만`} selected={topScope === 'year'} onPress={() => setTopScope('year')} />
              )}
            </View>
            {topPeople.isError ? (
              <LoadFailed title="사람을 불러오지 못했습니다" onRetry={() => void topPeople.refetch()} />
            ) : topPeople.isLoading ? (
              <ActivityIndicator color={colors.textMuted} style={{ marginVertical: space.md }} />
            ) : (topPeople.data ?? []).length === 0 ? (
              <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
                {topYear === null ? '아직 표시할 사람이 없습니다.' : `${topYear}년에는 기록된 사람이 없습니다.`}
              </Text>
            ) : (
              (topPeople.data ?? []).map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => router.push(`/person/${p.id}`)}
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
                  <Text style={{ color: colors.text, flex: 1, fontSize: font.body }} numberOfLines={1}>
                    {displayName({ name: p.name, label: labelOf.get(p.id) ?? null })}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
                    준 {formatWonShort(p.given_total)} · 받은 {formatWonShort(p.received_total)}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                </Pressable>
              ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function Line({
  label,
  amount,
  count,
  color,
}: {
  label: string;
  amount: number;
  count: number;
  color: string;
}) {
  const { colors, space, font } = useTokens();
  return (
    <View style={{ alignItems: 'baseline', flexDirection: 'row', gap: space.sm }}>
      <Text style={{ color: colors.textMuted, fontSize: font.caption, width: 56 }}>{label}</Text>
      <Text style={{ color, flex: 1, fontSize: font.title, fontWeight: '700' }}>
        {formatWon(amount)}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: font.caption }}>{count}건</Text>
    </View>
  );
}

// 막대 길이는 그 블록 안에서 가장 큰 값을 기준으로 잡는다. 블록끼리는 축이 다르므로
// 준돈 막대와 받은돈 막대의 길이를 서로 비교하면 안 된다. 금액은 옆에 그대로 적는다.
// 합계가 0인 항목(전부 미확정)은 막대를 그리지 않는다. 짧은 막대는 "조금 있다"로 읽힌다.
function Bars({ title, buckets, color }: { title: string; buckets: Bucket[]; color: string }) {
  const { colors, space, font, radius } = useTokens();
  if (buckets.length === 0) return null;
  const max = Math.max(...buckets.map((b) => b.total), 1);

  return (
    <View style={{ gap: space.sm }}>
      <Text style={{ color: colors.textMuted, fontSize: font.caption }}>{title}</Text>
      {buckets.map((b) => (
        <View key={b.key} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.text, fontSize: font.caption }}>
              {b.label} · {b.cnt}건
            </Text>
            <Text style={{ color: colors.text, fontSize: font.caption, fontWeight: '600' }}>
              {formatWon(b.total)}
            </Text>
          </View>
          <View style={{ backgroundColor: colors.bgSubtle, borderRadius: radius.sm, height: 6 }}>
            <View
              style={{
                backgroundColor: color,
                borderRadius: radius.sm,
                height: 6,
                width: b.total === 0 ? 0 : `${Math.max(2, Math.round((b.total / max) * 100))}%`,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
