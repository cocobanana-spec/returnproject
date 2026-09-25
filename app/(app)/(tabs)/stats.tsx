// 통계(S11) — 방향 탭과 연도만 항상 보이고, 숫자는 같은 열에 맞춰 눈으로 훑게 한다
//
// 2026-09-25 2차. 빌드 10에서 "가독성이 너무 떨어진다"는 피드백을 받아 **덜어냈다.**
// 뺀 것 — 막대 정렬 칩(금액순 고정), 행사별 정렬 칩(최신순 고정), 항상 펼쳐 있던 종류 필터(접었다),
// '전체' 탭의 막대 블록 4개(방향이 정해져야 뜻이 있어 준돈·받은돈 탭으로 옮겼다).
// 남긴 것 — 방향 탭, 연도 칩, 총계, 종류별·관계별 막대, 행사별, 사람별.
// 숫자는 tabular-nums 고정폭으로 건수 열·금액 열을 맞춘다. 자릿수가 들쭉날쭉하면 훑을 수 없다.
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { EVENT_TYPE_LABEL, type EventType } from '../../../src/domain/constants.ts';
import { formatBalance, formatWon } from '../../../src/domain/money.ts';
import { displayName } from '../../../src/domain/person.ts';
import {
  STATS_DIRECTION_LABEL,
  defaultYear,
  filterEventTotals,
  topPeopleScopeLabel,
  filterStatsRows,
  foldYearStats,
  sortEventTotals,
  typesOf,
  yearsOf,
  type Bucket,
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

// 숫자 열의 너비. 금액은 "1,000,000원"까지, 건수는 "999건"까지 들어간다.
const COUNT_WIDTH = 52;
// 최소폭이다. 고정폭으로 두면 억 단위 금액이 두 줄로 접혀 열이 깨진다.
// 평소에는 이 폭으로 나란히 서고, 넘칠 때만 한 줄을 유지한 채 글자가 줄어든다.
const AMOUNT_MIN_WIDTH = 112;

export default function StatsScreen() {
  const ledgerId = useLedgerId();
  const router = useRouter();
  const { colors, space, font, radius } = useTokens();
  const insets = useSafeAreaInsets();

  const thisYear = Number(todayISO().slice(0, 4));
  const [direction, setDirection] = useState<StatsDirection>('all');
  const [picked, setPicked] = useState<{ year: number | null } | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [typeOpen, setTypeOpen] = useState(false);

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
  const year =
    picked && (picked.year === null || years.includes(picked.year))
      ? picked.year
      : defaultYear(years, thisYear);
  const types = useMemo(() => typesOf(rows), [rows]);

  const filtered = useMemo(() => filterStatsRows(rows, year, type), [rows, year, type]);
  const stats = useMemo(() => foldYearStats(filtered), [filtered]);

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
    return sortEventTotals(filterEventTotals(byYear, direction, type));
  }, [events.data, year, direction, type]);

  const unconfirmed =
    direction === 'given'
      ? stats.givenUnconfirmed
      : direction === 'received'
        ? stats.receivedUnconfirmed
        : stats.unconfirmedCount;

  const hasAnything = rows.length > 0 || (events.data?.length ?? 0) > 0;
  const showGiven = direction !== 'received';
  const showReceived = direction !== 'given';
  // 막대는 방향이 정해져야 뜻이 있다. '전체' 탭에서는 총계·행사별·사람별만 보여 준다.
  const showBars = direction !== 'all';
  const byType = direction === 'given' ? stats.givenByType : stats.receivedByType;
  const byGroup = direction === 'given' ? stats.givenByGroup : stats.receivedByGroup;
  const tone = direction === 'received' ? colors.received : colors.given;

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

      <View style={{ borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row' }}>
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
          {/* 항상 보이는 조작은 연도 하나뿐이다 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Chip label="전체 기간" selected={year === null} onPress={() => setPicked({ year: null })} />
              {years.map((y) => (
                <Chip key={y} label={`${y}년`} selected={year === y} onPress={() => setPicked({ year: y })} />
              ))}
            </View>
          </ScrollView>

          {/* 총계 */}
          <View
            style={{
              backgroundColor: colors.bgSubtle,
              borderRadius: radius.lg,
              gap: space.sm,
              padding: space.lg,
            }}
          >
            {showGiven && (
              <NumberRow
                label="준 돈"
                count={stats.givenCount}
                amount={stats.givenTotal}
                color={colors.given}
                strong
              />
            )}
            {showReceived && (
              <NumberRow
                label="받은 돈"
                count={stats.receivedCount}
                amount={stats.receivedTotal}
                color={colors.received}
                strong
              />
            )}
            {direction === 'all' && (
              <View
                style={{
                  alignItems: 'center',
                  borderTopColor: colors.border,
                  borderTopWidth: 1,
                  flexDirection: 'row',
                  marginTop: space.xs,
                  paddingTop: space.md,
                }}
              >
                <Text style={{ color: colors.textMuted, flex: 1, fontSize: font.caption }}>
                  {stats.balance >= 0 ? '더 낸 금액' : '더 받은 금액'}
                </Text>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: font.body,
                    fontVariant: ['tabular-nums'],
                    fontWeight: '700',
                    marginLeft: space.sm,
                    minWidth: AMOUNT_MIN_WIDTH,
                    textAlign: 'right',
                  }}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  numberOfLines={1}
                >
                  {formatWon(Math.abs(stats.balance))}
                </Text>
              </View>
            )}
            {unconfirmed > 0 && (
              <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
                미확정 {unconfirmed}건은 합계에서 빠져 있습니다.
              </Text>
            )}
          </View>

          {/* 종류 필터는 접어 둔다. 기본값(전체)으로 대부분 충분하다 */}
          <View style={{ gap: space.sm }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setTypeOpen((prev) => !prev)}
              style={({ pressed }) => ({
                alignItems: 'center',
                flexDirection: 'row',
                gap: space.xs,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Ionicons
                name={typeOpen ? 'chevron-down' : 'chevron-forward'}
                size={14}
                color={colors.textMuted}
              />
              <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
                {type === null
                  ? '경조사 종류 고르기'
                  : `${EVENT_TYPE_LABEL[type as EventType] ?? type}만 보는 중`}
              </Text>
              {type !== null && (
                <Pressable onPress={() => setType(null)} hitSlop={8}>
                  <Text style={{ color: colors.given, fontSize: font.caption }}>지우기</Text>
                </Pressable>
              )}
            </Pressable>
            {typeOpen && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Chip label="전체" selected={type === null} onPress={() => setType(null)} />
                  {types.map((t) => (
                    <Chip
                      key={t}
                      label={EVENT_TYPE_LABEL[t as EventType] ?? t}
                      selected={type === t}
                      onPress={() => setType(type === t ? null : t)}
                    />
                  ))}
                </View>
              </ScrollView>
            )}
          </View>

          {showBars && <Bars title="경조사 종류별" buckets={byType} color={tone} />}
          {showBars && <Bars title="관계별" buckets={byGroup} color={tone} />}

          {/* 행사별 — 홈에서 뺀 행사별 구분이 여기 있다. 최신순 고정 */}
          <Section title="행사별">
            {events.isError ? (
              <LoadFailed title="행사를 불러오지 못했습니다" onRetry={() => void events.refetch()} />
            ) : events.isLoading ? (
              <ActivityIndicator color={colors.textMuted} style={{ marginVertical: space.md }} />
            ) : eventRows.length === 0 ? (
              <Empty text="조건에 맞는 행사가 없습니다." />
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
                    paddingVertical: space.md,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <View style={{ flex: 1, paddingRight: space.sm }}>
                    <Text style={{ color: colors.text, fontSize: font.body }} numberOfLines={1}>
                      {e.title}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: font.caption, marginTop: 2 }}>
                      {formatEventDate(e.event_date, 'day')}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontSize: font.caption,
                      fontVariant: ['tabular-nums'],
                      textAlign: 'right',
                      width: COUNT_WIDTH,
                    }}
                  >
                    {e.cnt}건
                  </Text>
                  <Text
                    style={{
                      color: e.is_mine ? colors.received : colors.given,
                      fontSize: font.body,
                      fontVariant: ['tabular-nums'],
                      fontWeight: '600',
                      marginLeft: space.sm,
                      minWidth: AMOUNT_MIN_WIDTH,
                      textAlign: 'right',
                    }}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    numberOfLines={1}
                  >
                    {formatWon(e.total)}
                  </Text>
                </Pressable>
              ))
            )}
          </Section>

          {/* 사람별 — 숫자를 하나만 보여 준다(차액). 두 숫자를 한 줄에 적으면 훑기 어렵다 */}
          <Section title="차액이 큰 사람">
            {topPeople.isError ? (
              <LoadFailed title="사람을 불러오지 못했습니다" onRetry={() => void topPeople.refetch()} />
            ) : topPeople.isLoading ? (
              <ActivityIndicator color={colors.textMuted} style={{ marginVertical: space.md }} />
            ) : (topPeople.data ?? []).length === 0 ? (
              <Empty text={year === null ? '아직 표시할 사람이 없습니다.' : `${year}년에는 기록된 사람이 없습니다.`} />
            ) : (
              (topPeople.data ?? []).map((p) => {
                const balance = formatBalance(p.balance);
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => router.push(`/person/${p.id}`)}
                    style={({ pressed }) => ({
                      alignItems: 'center',
                      borderBottomColor: colors.border,
                      borderBottomWidth: 1,
                      flexDirection: 'row',
                      paddingVertical: space.md,
                      opacity: pressed ? 0.6 : 1,
                    })}
                  >
                    <Text
                      style={{ color: colors.text, flex: 1, fontSize: font.body, paddingRight: space.sm }}
                      numberOfLines={1}
                    >
                      {displayName({ name: p.name, label: labelOf.get(p.id) ?? null })}
                    </Text>
                    <Text
                      style={{
                        color:
                          balance.direction === 'given'
                            ? colors.given
                            : balance.direction === 'received'
                              ? colors.received
                              : colors.textMuted,
                        fontSize: font.caption,
                        fontVariant: ['tabular-nums'],
                        fontWeight: '600',
                        textAlign: 'right',
                      }}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                      numberOfLines={1}
                    >
                      {balance.text}
                    </Text>
                  </Pressable>
                );
              })
            )}
            <Text style={{ color: colors.textMuted, fontSize: font.caption - 1, marginTop: space.xs }}>
              {topPeopleScopeLabel(year)} 기준입니다. 공동 부조는 두 사람 모두에게 계산됩니다.
              {type !== null ? ' 경조사 종류 필터는 여기에 적용되지 않습니다.' : ''}
            </Text>
          </Section>
        </>
      )}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors, space, font } = useTokens();
  return (
    <View style={{ gap: space.xs }}>
      <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '700' }}>{title}</Text>
      {children}
    </View>
  );
}

function Empty({ text }: { text: string }) {
  const { colors, space, font } = useTokens();
  return (
    <Text style={{ color: colors.textMuted, fontSize: font.caption, paddingVertical: space.sm }}>
      {text}
    </Text>
  );
}

// 이름·건수·금액이 각각 같은 열에 놓인다. 금액은 고정폭 숫자라 자릿수가 세로로 맞는다.
function NumberRow({
  label,
  count,
  amount,
  color,
  strong = false,
}: {
  label: string;
  count: number;
  amount: number;
  color: string;
  strong?: boolean;
}) {
  const { colors, space, font } = useTokens();
  return (
    <View style={{ alignItems: 'center', flexDirection: 'row' }}>
      <Text
        style={{ color: colors.textMuted, flex: 1, fontSize: font.caption, paddingRight: space.sm }}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: font.caption,
          fontVariant: ['tabular-nums'],
          textAlign: 'right',
          width: COUNT_WIDTH,
        }}
        numberOfLines={1}
      >
        {count}건
      </Text>
      <Text
        style={{
          color,
          fontSize: strong ? font.title : font.body,
          fontVariant: ['tabular-nums'],
          fontWeight: '700',
          marginLeft: space.sm,
          minWidth: AMOUNT_MIN_WIDTH,
          textAlign: 'right',
        }}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        numberOfLines={1}
      >
        {formatWon(amount)}
      </Text>
    </View>
  );
}

// 막대 길이는 그 블록 안에서 가장 큰 금액을 기준으로 잡는다. 정렬은 언제나 금액 내림차순이라
// (foldYearStats가 그렇게 접는다) 길이와 순서가 어긋나지 않는다.
// 금액이 0인 항목(전부 미확정)은 막대를 그리지 않는다. 짧은 막대는 "조금 있다"로 읽힌다.
function Bars({ title, buckets, color }: { title: string; buckets: Bucket[]; color: string }) {
  const { colors, space, radius } = useTokens();
  if (buckets.length === 0) return null;
  const max = Math.max(...buckets.map((b) => b.total), 1);

  return (
    <Section title={title}>
      {buckets.map((b) => (
        <View key={b.key} style={{ gap: 4, paddingVertical: space.xs }}>
          <NumberRow label={b.label} count={b.cnt} amount={b.total} color={colors.text} />
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
    </Section>
  );
}
