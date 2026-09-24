// 행사 목록(S06) — 전체·내 행사·남의 행사 세그먼트와 연도 헤더
//
// 하단 탭에서 빠지고 더보기 안으로 들어왔다(2026-09-24). 받은돈은 행사에 속해야만 기록되므로
// 이 화면이 사라지면 내 행사 명부 입력(S09)으로 가는 길이 끊긴다. 그래서 지우지 않는다.
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { eventTypeLabel, groupEventsByYear } from '../../src/domain/event.ts';
import { formatEventDate } from '../../src/domain/title.ts';
import type { DatePrecision } from '../../src/domain/constants.ts';
import { useLedgerId } from '../../src/ledger/LedgerProvider';
import { queryKeys } from '../../src/lib/queryKeys';
import { listEvents, type EventRow } from '../../src/repositories/events';
import { useTokens } from '../../src/theme/tokens';
import { Chip } from '../../src/ui/Chip';
import { EmptyState } from '../../src/ui/EmptyState';
import { LoadFailed } from '../../src/ui/LoadFailed';
import { Screen } from '../../src/ui/Screen';

type Filter = { key: string; label: string; isMine: boolean | null };
const FILTERS: Filter[] = [
  { key: 'all', label: '전체', isMine: null },
  { key: 'mine', label: '내 행사', isMine: true },
  { key: 'others', label: '남의 행사', isMine: false },
];

type Row = { kind: 'year'; year: string } | { kind: 'event'; event: EventRow };

export default function EventsScreen() {
  const ledgerId = useLedgerId();
  const router = useRouter();
  const { colors, space, font, radius } = useTokens();
  const [filter, setFilter] = useState<Filter>(FILTERS[0] as Filter);

  // 목록은 서버 기본 1000건에서 조용히 잘린다. 스크롤에 맞춰 이어서 받는다.
  const query = useInfiniteQuery({
    queryKey: queryKeys.events.list(ledgerId, { isMine: filter.isMine }),
    queryFn: ({ pageParam }) => listEvents(ledgerId, { isMine: filter.isMine, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset,
  });

  const rows = useMemo<Row[]>(() => {
    const events = (query.data?.pages ?? []).flatMap((p) => p.rows);
    const out: Row[] = [];
    for (const group of groupEventsByYear(events)) {
      out.push({ kind: 'year', year: group.year });
      for (const event of group.events) out.push({ kind: 'event', event });
    }
    return out;
  }, [query.data]);

  return (
    <Screen padded={false} edges={{ top: false }}>
      <View style={{ gap: space.md, paddingHorizontal: space.xl, paddingTop: space.md }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/event/edit')}
            style={({ pressed }) => ({
              alignItems: 'center',
              backgroundColor: colors.bgSubtle,
              borderRadius: radius.pill,
              flexDirection: 'row',
              gap: space.xs,
              paddingHorizontal: space.md,
              paddingVertical: space.sm,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Ionicons name="add" size={16} color={colors.text} />
            <Text style={{ color: colors.text, fontSize: font.caption, fontWeight: '600' }}>
              내 행사
            </Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} selected={filter.key === f.key} onPress={() => setFilter(f)} />
          ))}
        </View>
      </View>

      {query.isLoading ? (
        <ActivityIndicator color={colors.textMuted} style={{ marginTop: space.xxl }} />
      ) : query.isError ? (
        // 조회 실패를 "행사가 아직 없습니다"로 덮으면 300건 있는 사용자에게 데이터가 사라진 것처럼 보인다.
        <LoadFailed title="행사를 불러오지 못했습니다" onRetry={() => void query.refetch()} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => (item.kind === 'year' ? `y${item.year}` : item.event.id)}
          contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: space.xxl }}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          ListEmptyComponent={
            <EmptyState
              title={filter.isMine === true ? '내 행사가 아직 없습니다' : '행사가 아직 없습니다'}
              hint={
                filter.isMine === true
                  ? '결혼식·돌잔치처럼 내가 치른 행사를 만들면 받은 돈을 정리할 수 있습니다.'
                  : '준돈을 기록하면 남의 행사가 자동으로 만들어집니다.'
              }
              actionLabel={filter.isMine === false ? undefined : '내 행사 만들기'}
              onAction={filter.isMine === false ? undefined : () => router.push('/event/edit')}
            />
          }
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <ActivityIndicator color={colors.textMuted} style={{ marginVertical: space.lg }} />
            ) : null
          }
          renderItem={({ item }) => {
            if (item.kind === 'year') {
              return (
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: font.caption,
                    fontWeight: '700',
                    marginTop: space.lg,
                    marginBottom: space.xs,
                  }}
                >
                  {item.year}년
                </Text>
              );
            }
            const e = item.event;
            return (
              <Pressable
                onPress={() => router.push(`/event/${e.id}`)}
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
                  <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '600' }} numberOfLines={1}>
                    {e.title}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: font.caption, marginTop: 2 }}>
                    {formatEventDate(e.date, e.date_precision as DatePrecision)} · {eventTypeLabel(e.type)}
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: e.is_mine ? colors.received : colors.bgSubtle,
                    borderRadius: radius.sm,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}
                >
                  <Text
                    style={{
                      color: e.is_mine ? '#FFFFFF' : colors.textMuted,
                      fontSize: font.caption - 2,
                      fontWeight: '600',
                    }}
                  >
                    {e.is_mine ? '내 행사' : '준돈'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}
