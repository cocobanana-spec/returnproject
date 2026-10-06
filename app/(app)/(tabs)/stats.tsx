// 통계(S11) — 위에 고정된 글라스 세그먼트(전체/보낸/받은), 홈과 같은 요약 카드, 종류 칩, 연도마다 카드, 차액 큰 사람 카드
//
// 2026-10-06 리뉴얼 3단계(docs/DESIGN.md). 세그먼트는 네비게이션 레이어라 iOS 26 에서 글라스 캡슐이고 스크롤해도
// 맨 위에 붙어 있다(안드로이드·웹은 흰 캡슐). 금액 색은 요약 카드에서만, 목록 금액은 회색.
// 2026-10-04: 연도 칩 줄은 없다(전체 기간 고정). 연도 카드 머리를 누르면 접힌다.
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { EVENT_TYPE_LABEL, type EventType } from '../../../src/domain/constants.ts';
import { eventTypeIcon } from '../../../src/domain/eventIcon.ts';
import { formatBalance, formatWon } from '../../../src/domain/money.ts';
import { displayName } from '../../../src/domain/person.ts';
import {
  STATS_DIRECTION_LABEL,
  filterEventTotals,
  topPeopleScopeLabel,
  filterStatsRows,
  foldYearStats,
  groupEventTotalsByYear,
  sortEventTotals,
  typesOf,
  type Bucket,
  type StatsDirection,
} from '../../../src/domain/stats.ts';
import { formatEventDate } from '../../../src/domain/title.ts';
import { useLedgerId } from '../../../src/ledger/LedgerProvider';
import { isWeb } from '../../../src/lib/platform.ts';
import { queryKeys } from '../../../src/lib/queryKeys';
import { listPeopleByIds } from '../../../src/repositories/people';
import { listEventTotals, listStatsRows, listTopPeopleByYear } from '../../../src/repositories/stats';
import { amountText, useTokens } from '../../../src/theme/tokens';
import { Card } from '../../../src/ui/Card';
import { Chip } from '../../../src/ui/Chip';
import { EmptyState } from '../../../src/ui/EmptyState';
import { ListRow } from '../../../src/ui/ListRow';
import { LoadFailed } from '../../../src/ui/LoadFailed';
import { SectionHeader } from '../../../src/ui/SectionHeader';

const DIRECTIONS: StatsDirection[] = ['all', 'given', 'received'];
const SEGMENT_HEIGHT = 44;
const WEB_TAB_BAR = 64;

// 글라스 모듈은 네이티브 전용이라 웹 번들에서 require 하지 않는다
type GlassModule = typeof import('expo-glass-effect');
let glass: GlassModule | null = null;
function loadGlass(): GlassModule | null {
  if (Platform.OS !== 'ios') return null;
  if (!glass) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    glass = require('expo-glass-effect') as GlassModule;
  }
  return glass;
}

export default function StatsScreen() {
  const ledgerId = useLedgerId();
  const router = useRouter();
  const { colors, space, font } = useTokens();
  const insets = useSafeAreaInsets();

  const [direction, setDirection] = useState<StatsDirection>('all');
  const [type, setType] = useState<string | null>(null);
  // 접힌 연도. 기본은 전부 펼침이라 비어 있다
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set());

  const raw = useQuery({
    queryKey: queryKeys.stats.allYears(ledgerId),
    queryFn: () => listStatsRows(ledgerId),
  });
  const events = useQuery({
    queryKey: queryKeys.stats.eventTotals(ledgerId),
    queryFn: () => listEventTotals(ledgerId),
  });

  const rows = useMemo(() => raw.data ?? [], [raw.data]);
  // 전체 기간 고정. 연도는 아래 연도 카드가 나눈다
  const year = null;
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

  const yearGroups = useMemo(
    () => groupEventTotalsByYear(sortEventTotals(filterEventTotals(events.data ?? [], direction, type))),
    [events.data, direction, type],
  );

  const unconfirmed =
    direction === 'given' ? stats.givenUnconfirmed : direction === 'received' ? stats.receivedUnconfirmed : stats.unconfirmedCount;

  const hasAnything = rows.length > 0 || (events.data?.length ?? 0) > 0;
  const showGiven = direction !== 'received';
  const showReceived = direction !== 'given';
  // 막대는 방향이 정해져야 뜻이 있다. '전체'에서는 요약·연도별·사람별만 보여 준다.
  const showBars = direction !== 'all';
  const byType = direction === 'given' ? stats.givenByType : stats.receivedByType;
  const byGroup = direction === 'given' ? stats.givenByGroup : stats.receivedByGroup;
  const net = stats.receivedTotal - stats.givenTotal;
  const netLine = net > 0 ? '받은 게 더 많아요' : net < 0 ? '보낸 게 더 많아요' : '보낸 만큼 받았어요';

  const topPad = insets.top + space.sm + SEGMENT_HEIGHT + space.lg;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: space.xxl, paddingBottom: insets.bottom + (isWeb ? WEB_TAB_BAR : 0) + space.xxl, paddingHorizontal: space.xl, paddingTop: topPad }}
      >
        <Text style={{ color: colors.text, fontSize: font.heading, fontWeight: '700' }}>통계</Text>

        {raw.isLoading ? (
          <ActivityIndicator color={colors.textMuted} style={{ marginTop: space.xxl }} />
        ) : raw.isError ? (
          <LoadFailed title="통계를 불러오지 못했어요" onRetry={() => void raw.refetch()} />
        ) : !hasAnything ? (
          <Card>
            <EmptyState icon="stats-chart" title="아직 집계할 기록이 없어요" hint={'경조사를 기록하면 연도별로\n보낸 돈과 받은 돈이 쌓여요.'} actionLabel="첫 기록 남기기" onAction={() => router.push('/record')} />
          </Card>
        ) : (
          <>
            {/* 요약 — 홈과 같은 구조. 금액 색은 여기서만 */}
            <Card padded={false}>
              {showGiven && (
                <ListRow
                  title="보낸 축의금·조의금"
                  caption={`${stats.givenCount}건`}
                  right={<Text style={{ ...amountText, color: colors.given, fontSize: font.title, fontWeight: '700' }}>{formatWon(stats.givenTotal)}</Text>}
                />
              )}
              {showReceived && (
                <ListRow
                  title="받은 축의금·조의금"
                  caption={`${stats.receivedCount}건`}
                  right={<Text style={{ ...amountText, color: colors.received, fontSize: font.title, fontWeight: '700' }}>{formatWon(stats.receivedTotal)}</Text>}
                />
              )}
              {direction === 'all' && (
                <View style={{ borderTopColor: colors.border, borderTopWidth: 1, marginHorizontal: space.xl }}>
                  <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.lg }}>
                    <Text style={{ color: colors.textMuted, fontSize: font.body, fontWeight: '500' }}>{netLine}</Text>
                    <Text style={{ ...amountText, color: colors.text, fontSize: font.title, fontWeight: '700' }}>{formatWon(Math.abs(net))}</Text>
                  </View>
                </View>
              )}
              {unconfirmed > 0 && (
                <Text style={{ color: colors.textFaint, fontSize: font.caption, paddingBottom: space.lg, paddingHorizontal: space.xl }}>
                  미확정 {unconfirmed}건은 합계에서 빠져 있어요.
                </Text>
              )}
            </Card>

            {/* 경조사 종류 — 접지 않고 바로 보인다 */}
            <View style={{ gap: space.md }}>
              <Text style={{ color: colors.textMuted, fontSize: font.caption }}>경조사 종류</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.xl }} contentContainerStyle={{ paddingHorizontal: space.xl }}>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Chip label="전체" selected={type === null} onPress={() => setType(null)} />
                  {types.map((k) => (
                    <Chip key={k} label={EVENT_TYPE_LABEL[k as EventType] ?? k} selected={type === k} onPress={() => setType(type === k ? null : k)} />
                  ))}
                </View>
              </ScrollView>
            </View>

            {showBars && <Bars title="경조사 종류별" buckets={byType} />}
            {showBars && <Bars title="관계별" buckets={byGroup} />}

            {/* 연도마다 카드 — 머리 = 연도 + 우측 합계. 누르면 접힌다. 묶음 안은 최신순 */}
            {events.isError ? (
              <LoadFailed title="행사를 불러오지 못했어요" onRetry={() => void events.refetch()} />
            ) : events.isLoading ? (
              <ActivityIndicator color={colors.textMuted} />
            ) : yearGroups.length === 0 ? (
              <Card>
                <Text style={{ color: colors.textMuted, fontSize: font.body }}>조건에 맞는 행사가 없어요.</Text>
              </Card>
            ) : (
              <View style={{ gap: space.md }}>
                {yearGroups.map((g) => {
                  const open = !collapsed.has(g.year);
                  return (
                    <Card key={g.year} padded={false}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ expanded: open }}
                        onPress={() =>
                          setCollapsed((prev) => {
                            const next = new Set(prev);
                            if (next.has(g.year)) next.delete(g.year);
                            else next.add(g.year);
                            return next;
                          })
                        }
                        style={({ pressed }) => ({ alignItems: 'center', flexDirection: 'row', gap: space.sm, padding: space.xl, opacity: pressed ? 0.6 : 1 })}
                      >
                        <Text style={{ color: colors.text, fontSize: font.title, fontWeight: '700' }}>{g.year}년</Text>
                        <Text style={{ color: colors.textFaint, flex: 1, fontSize: font.caption, fontVariant: ['tabular-nums'] }}>{g.rows.length}개 행사 · {g.cnt}건</Text>
                        <Text style={{ ...amountText, color: colors.text, fontSize: font.title, fontWeight: '700' }} numberOfLines={1}>{formatWon(g.total)}</Text>
                        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textFaint} />
                      </Pressable>
                      {open &&
                        g.rows.map((e) => (
                          <ListRow
                            key={e.event_id}
                            icon={eventTypeIcon(e.type)}
                            iconTone="muted"
                            title={e.title}
                            caption={`${formatEventDate(e.event_date, 'day')} · ${e.cnt}건`}
                            value={formatWon(e.total)}
                            onPress={() => router.push(`/event/${e.event_id}`)}
                          />
                        ))}
                      {open && <View style={{ height: space.sm }} />}
                    </Card>
                  );
                })}
              </View>
            )}

            {/* 사람별 — 숫자를 하나만 보여 준다(차액). 두 숫자를 한 줄에 적으면 훑기 어렵다 */}
            <View>
              <SectionHeader title="차액이 큰 사람" />
              <Card padded={false}>
                {topPeople.isError ? (
                  <View style={{ padding: space.xl }}>
                    <LoadFailed title="사람을 불러오지 못했어요" onRetry={() => void topPeople.refetch()} />
                  </View>
                ) : topPeople.isLoading ? (
                  <ActivityIndicator color={colors.textMuted} style={{ marginVertical: space.lg }} />
                ) : (topPeople.data ?? []).length === 0 ? (
                  <Text style={{ color: colors.textMuted, fontSize: font.body, padding: space.xl }}>아직 표시할 사람이 없어요.</Text>
                ) : (
                  (topPeople.data ?? []).map((p) => {
                    const balance = formatBalance(p.balance);
                    return (
                      <ListRow
                        key={p.id}
                        icon="person"
                        iconTone="muted"
                        title={displayName({ name: p.name, label: labelOf.get(p.id) ?? null })}
                        value={balance.text}
                        valueTone={balance.direction === 'even' ? 'muted' : 'default'}
                        onPress={() => router.push(`/person/${p.id}`)}
                      />
                    );
                  })
                )}
              </Card>
              <Text style={{ color: colors.textFaint, fontSize: font.caption, lineHeight: 20, marginTop: space.md }}>
                {topPeopleScopeLabel(year)} 기준이에요. 공동 부조는 두 사람 모두에게 계산돼요.
                {type !== null ? ' 경조사 종류 필터는 여기에 적용되지 않아요.' : ''}
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* 고정 세그먼트 — 네비게이션 레이어. iOS 26 은 글라스 캡슐, 그 밖은 흰 캡슐 */}
      <View pointerEvents="box-none" style={{ left: space.xl, position: 'absolute', right: space.xl, top: insets.top + space.sm }}>
        <Segment value={direction} onChange={setDirection} />
      </View>
    </View>
  );
}

// 세그먼트 — 밑줄 없이, 선택 항목만 진한 글자 bold, 나머지 연한 글자
function Segment({ value, onChange }: { value: StatsDirection; onChange: (d: StatsDirection) => void }) {
  const { colors, space, font, radius } = useTokens();
  const g = loadGlass();
  const useGlass = !!g && g.isLiquidGlassAvailable();
  const items = DIRECTIONS.map((d) => {
    const selected = value === d;
    return (
      <Pressable key={d} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onChange(d)} style={({ pressed }) => ({ alignItems: 'center', flex: 1, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
        <Text style={{ color: selected ? colors.text : colors.textFaint, fontSize: font.body, fontWeight: selected ? '700' : '500' }}>{STATS_DIRECTION_LABEL[d]}</Text>
      </Pressable>
    );
  });
  const inner = { alignItems: 'center' as const, borderRadius: radius.pill, flexDirection: 'row' as const, height: SEGMENT_HEIGHT, paddingHorizontal: space.sm };
  if (useGlass && g) {
    const { GlassView } = g;
    return <GlassView glassEffectStyle="regular" style={inner}>{items}</GlassView>;
  }
  return <View style={{ ...inner, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }}>{items}</View>;
}

// 막대 길이는 그 블록 안에서 가장 큰 금액을 기준으로 잡는다. 정렬은 언제나 금액 내림차순이라
// (foldYearStats가 그렇게 접는다) 길이와 순서가 어긋나지 않는다. 금액 0(전부 미확정)은 막대를 그리지 않는다.
function Bars({ title, buckets }: { title: string; buckets: Bucket[] }) {
  const { colors, space, font, radius } = useTokens();
  if (buckets.length === 0) return null;
  const max = Math.max(...buckets.map((b) => b.total), 1);
  return (
    <View>
      <SectionHeader title={title} />
      <Card style={{ gap: space.lg }}>
        {buckets.map((b) => (
          <View key={b.key} style={{ gap: space.sm }}>
            <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '500' }}>
                {b.label} <Text style={{ color: colors.textFaint, fontSize: font.caption }}>{b.cnt}건</Text>
              </Text>
              <Text style={{ ...amountText, color: colors.text, fontSize: font.body, fontWeight: '700' }}>{formatWon(b.total)}</Text>
            </View>
            <View style={{ backgroundColor: colors.surface2, borderRadius: radius.sm, height: 8 }}>
              <View style={{ backgroundColor: colors.accent, borderRadius: radius.sm, height: 8, width: b.total === 0 ? 0 : `${Math.max(2, Math.round((b.total / max) * 100))}%` }} />
            </View>
          </View>
        ))}
      </Card>
    </View>
  );
}
