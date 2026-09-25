// 통계(S11) — 전체·준돈·받은돈 탭, 연도·종류 필터와 정렬, 종류별·관계별·사람별·행사별
//
// 2026-09-25 개편. 홈 받은돈 탭이 평평한 목록이 되면서 행사별 구분이 이 화면으로 옮겨왔다.
// stats_by_year는 p_year 없이 한 번만 받아 도메인 함수가 연도·종류로 거르고 접는다.
// 행사별은 event_totals RPC 한 번으로 받는다. 화면에는 계산을 두지 않는다.
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { EVENT_TYPE_LABEL, type EventType } from '../../../src/domain/constants.ts';
import { formatWon, formatWonShort } from '../../../src/domain/money.ts';
import { displayName } from '../../../src/domain/person.ts';
import {
  BUCKET_SORT_LABEL,
  EVENT_SORT_LABEL,
  STATS_DIRECTION_LABEL,
  bucketsFor,
  defaultYear,
  filterEventTotals,
  filterStatsRows,
  foldYearStats,
  sortBuckets,
  sortEventTotals,
  topPeopleScopeLabel,
  typesOf,
  yearsOf,
  type Bucket,
  type BucketSort,
  type EventSort,
  type StatsDirection,
} from '../../../src/domain/stats.ts';
import { formatEventDate, todayISO } from '../../../src/domain/title.ts';
import { useLedgerId } from '../../../src/ledger/LedgerProvider';
import { queryKeys } from '../../../src/lib/queryKeys';
import { listPeopleByIds } from '../../../src/repositories/people';
import { listEventTotals, listStatsRows, listTopPeopleByYear } from '../../../src/repositories/stats';
import { useTokens } from '../../../src/theme/tokens';
import { Chip } from '../../../src/ui/Chip';
import { EmptyState } from '../../../src/ui/EmptyState';
import { LoadFailed } from '../../../src/ui/LoadFailed';

const DIRECTIONS: StatsDirection[] = ['all', 'given', 'received'];
const BUCKET_SORTS: BucketSort[] = ['amount', 'count'];
const EVENT_SORTS: EventSort[] = ['date', 'amount', 'count'];

export default function StatsScreen() {
  const ledgerId = useLedgerId();
  const router = useRouter();
  const { colors, space, font, radius } = useTokens();
  const insets = useSafeAreaInsets();

  const thisYear = Number(todayISO().slice(0, 4));
  const [direction, setDirection] = useState<StatsDirection>('all');
  const [picked, setPicked] = useState<{ year: number | null } | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [bucketSort, setBucketSort] = useState<BucketSort>('amount');
  const [eventSort, setEventSort] = useState<EventSort>('date');

  const raw = useQuery({
    queryKey: queryKeys.stats.allYears(ledgerId),
    queryFn: () => listStatsRows(ledgerId),
  });
  const events = useQuery({
    queryKey: queryKeys.stats.eventTotals(ledgerId),
    queryFn: () => listEventTotals(ledgerId),
  });

  const rows = useMemo(() => raw.data ?? [], [raw.data]);
  const years = useMemo(() => yearsOf(rows), [rows]);
  // 고른 적이 없거나 고른 연도가 사라졌으면 기본값으로 돌린다.
  const year =
    picked && (picked.year === null || years.includes(picked.year))
      ? picked.year
      : defaultYear(years, thisYear);
  const types = useMemo(() => typesOf(rows), [rows]);

  const filtered = useMemo(() => filterStatsRows(rows, year, type), [rows, year, type]);
  const stats = useMemo(() => foldYearStats(filtered), [filtered]);

  // 사람별 상위 — 연도 필터를 그대로 따른다(종류 필터는 RPC에 없어 적용하지 않는다).
  const topPeople = useQuery({
    queryKey: queryKeys.stats.topPeople(ledgerId, year),
    queryFn: () => listTopPeopleByYear(ledgerId, year),
    enabled: rows.length > 0,
  });
  const topIds = (topPeople.data ?? []).map((p) => p.id);
  const topLabels = useQuery({
    queryKey: queryKeys.people.list(ledgerId, { ids: topIds }),
    queryFn: () => listPeopleByIds(ledgerId, topIds),
    enabled: topIds.length > 0,
  });
  const labelOf = new Map((topLabels.data ?? []).map((p) => [p.id as string, p.label]));

  const eventRows = useMemo(() => {
    const all = events.data ?? [];
    const byYear = year === null ? all : all.filter((e) => Number(e.event_date.slice(0, 4)) === year);
    return sortEventTotals(filterEventTotals(byYear, direction, type), eventSort);
  }, [events.data, year, direction, type, eventSort]);

  const unconfirmed =
    direction === 'given'
      ? stats.givenUnconfirmed
      : direction === 'received'
        ? stats.receivedUnconfirmed
        : stats.unconfirmedCount;

  // 기록이 0건인 예정 행사만 있는 장부도 행사별 블록은 보여 줘야 한다(0006이 left join인 이유).
  const hasAnything = rows.length > 0 || (events.data?.length ?? 0) > 0;
  const showGiven = direction !== 'received';
  const showReceived = direction !== 'given';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        gap: space.lg,
        paddingBottom: insets.bottom + space.xxl,
        paddingHorizontal: space.xl,
        paddingTop: insets.top + space.md,
      }}
    >
      <Text style={{ color: colors.text, fontSize: font.heading, fontWeight: '700' }}>통계</Text>

      {/* 방향 탭 */}
      <View
        style={{
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
          flexDirection: 'row',
        }}
      >
        {DIRECTIONS.map((d) => {
          const selected = direction === d;
          return (
            <Pressable
              key={d}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setDirection(d)}
              style={{
                alignItems: 'center',
                borderBottomColor: selected ? colors.text : 'transparent',
                borderBottomWidth: 2,
                flex: 1,
                paddingBottom: space.md,
              }}
            >
              <Text
                style={{
                  color: selected ? colors.text : colors.textMuted,
                  fontSize: font.body,
                  fontWeight: selected ? '700' : '500',
                }}
              >
                {STATS_DIRECTION_LABEL[d]}
              </Text>
            </Pressable>
          );
        })}
      </View>

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
          {/* 연도 필터 */}
          <FilterRow label="연도">
            <Chip label="전체" selected={year === null} onPress={() => setPicked({ year: null })} />
            {years.map((y) => (
              <Chip key={y} label={`${y}년`} selected={year === y} onPress={() => setPicked({ year: y })} />
            ))}
          </FilterRow>

          {/* 종류 필터 */}
          <FilterRow label="경조사 종류">
            <Chip label="전체" selected={type === null} onPress={() => setType(null)} />
            {types.map((t) => (
              <Chip
                key={t}
                label={EVENT_TYPE_LABEL[t as EventType] ?? t}
                selected={type === t}
                onPress={() => setType(type === t ? null : t)}
              />
            ))}
          </FilterRow>

          {/* 총계 */}
          <View
            style={{
              backgroundColor: colors.bgSubtle,
              borderRadius: radius.lg,
              gap: space.md,
              padding: space.lg,
            }}
          >
            {showGiven && (
              <Line label="준 돈" amount={stats.givenTotal} count={stats.givenCount} color={colors.given} />
            )}
            {showReceived && (
              <Line
                label="받은 돈"
                amount={stats.receivedTotal}
                count={stats.receivedCount}
                color={colors.received}
              />
            )}
            {direction === 'all' && (
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
            )}
            {/* 방향 탭이 고른 쪽의 미확정만 센다. 양방향 합을 찍으면 준돈 탭에서
                있지도 않은 준돈 미확정을 찾아 헤매게 된다(§18.1의 교훈과 같은 함정) */}
            {unconfirmed > 0 && (
              <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
                미확정 {unconfirmed}건은 합계에서 빠져 있습니다.
              </Text>
            )}
          </View>

          {/* 막대 정렬 */}
          <FilterRow label="정렬">
            {BUCKET_SORTS.map((s) => (
              <Chip
                key={s}
                label={BUCKET_SORT_LABEL[s]}
                selected={bucketSort === s}
                onPress={() => setBucketSort(s)}
              />
            ))}
          </FilterRow>

          {bucketsFor(stats, direction, 'type').map((b) => (
            <Bars
              key={b.label}
              title={b.label}
              buckets={sortBuckets(b.buckets, bucketSort)}
              metric={bucketSort}
              color={b.tone === 'given' ? colors.given : colors.received}
            />
          ))}
          {bucketsFor(stats, direction, 'group').map((b) => (
            <Bars
              key={b.label}
              title={b.label}
              buckets={sortBuckets(b.buckets, bucketSort)}
              metric={bucketSort}
              color={b.tone === 'given' ? colors.given : colors.received}
            />
          ))}

          {/* 행사별 — 홈에서 뺀 행사별 구분이 여기 있다 */}
          <View style={{ gap: space.sm }}>
            <View style={{ gap: 2 }}>
              <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
                행사별 ({[
                  topPeopleScopeLabel(year),
                  STATS_DIRECTION_LABEL[direction],
                  type === null ? null : (EVENT_TYPE_LABEL[type as EventType] ?? type),
                ]
                  .filter(Boolean)
                  .join(' · ')})
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: font.caption - 1 }}>
                행을 누르면 그 행사의 기록으로 갑니다.
              </Text>
            </View>
            <FilterRow label="">
              {EVENT_SORTS.map((s) => (
                <Chip
                  key={s}
                  label={EVENT_SORT_LABEL[s]}
                  selected={eventSort === s}
                  onPress={() => setEventSort(s)}
                />
              ))}
            </FilterRow>
            {events.isError ? (
              <LoadFailed title="행사를 불러오지 못했습니다" onRetry={() => void events.refetch()} />
            ) : events.isLoading ? (
              <ActivityIndicator color={colors.textMuted} style={{ marginVertical: space.md }} />
            ) : eventRows.length === 0 ? (
              <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
                조건에 맞는 행사가 없습니다.
              </Text>
            ) : (
              eventRows.map((e) => (
                <Pressable
                  key={e.event_id}
                  onPress={() => router.push(`/event/${e.event_id}`)}
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
                      {e.title}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: font.caption, marginTop: 2 }}>
                      {formatEventDate(e.event_date, 'day')} · {EVENT_TYPE_LABEL[e.type as EventType] ?? e.type} ·{' '}
                      {e.cnt}건{e.unconfirmed > 0 ? ` (미확정 ${e.unconfirmed})` : ''}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: e.is_mine ? colors.received : colors.given,
                      fontSize: font.body,
                      fontWeight: '700',
                    }}
                  >
                    {formatWonShort(e.total)}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                </Pressable>
              ))
            )}
          </View>

          {/* 사람별 상위 */}
          <View style={{ gap: space.sm }}>
            <View style={{ gap: 2 }}>
              <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
                차액이 큰 사람 ({topPeopleScopeLabel(year)})
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: font.caption - 1 }}>
                공동 부조는 두 사람 모두에게 계산됩니다.
                {type !== null ? ' 경조사 종류 필터는 이 블록에 적용되지 않습니다.' : ''}
              </Text>
            </View>
            {topPeople.isError ? (
              <LoadFailed title="사람을 불러오지 못했습니다" onRetry={() => void topPeople.refetch()} />
            ) : topPeople.isLoading ? (
              <ActivityIndicator color={colors.textMuted} style={{ marginVertical: space.md }} />
            ) : (topPeople.data ?? []).length === 0 ? (
              <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
                {year === null ? '아직 표시할 사람이 없습니다.' : `${year}년에는 기록된 사람이 없습니다.`}
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

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors, space, font } = useTokens();
  return (
    <View style={{ gap: space.xs }}>
      {label.length > 0 && (
        <Text style={{ color: colors.textMuted, fontSize: font.caption }}>{label}</Text>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: space.sm }}>{children}</View>
      </ScrollView>
    </View>
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
// 준돈 막대와 받은돈 막대의 길이를 서로 비교하면 안 된다. 금액·건수는 옆에 그대로 적는다.
// 값이 0인 항목(전부 미확정)은 막대를 그리지 않는다. 짧은 막대는 "조금 있다"로 읽힌다.
function Bars({
  title,
  buckets,
  color,
  metric,
}: {
  title: string;
  buckets: Bucket[];
  color: string;
  metric: BucketSort;
}) {
  const { colors, space, font, radius } = useTokens();
  if (buckets.length === 0) return null;
  // 막대 길이의 기준은 정렬 기준과 같아야 한다. 어긋나면 위 항목의 막대가 더 짧아 보인다.
  const value = (b: Bucket) => (metric === 'count' ? b.cnt : b.total);
  const max = Math.max(...buckets.map(value), 1);

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
                width: value(b) === 0 ? 0 : `${Math.max(2, Math.round((value(b) / max) * 100))}%`,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
