// 홈(S01) — 준돈·받은돈 상단 탭. 각 탭은 최신순 기록 목록이고 하단에 기록 FAB가 있다
//
// 사람 탭을 없앴기 때문에 이 목록의 사람 이름이 사람 원장(S04)으로 가는 주 진입로다.
// 이 동선이 끊기면 이 앱의 핵심인 "사람별 수지"에 도달할 방법이 사라진다.
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  DEFAULT_DIRECTION,
  DIRECTIONS,
  DIRECTION_LABEL,
  entryRowSubtitle,
  isMineOf,
  upcomingHint,
  type Direction,
} from '../../../src/domain/home.ts';
import { formatWon, formatWonShort } from '../../../src/domain/money.ts';
import { todayISO } from '../../../src/domain/title.ts';
import { useLedger, useLedgerId } from '../../../src/ledger/LedgerProvider';
import { queryKeys } from '../../../src/lib/queryKeys';
import { listEntriesByDirection, type EntryWithContext } from '../../../src/repositories/entries';
import { listUpcomingEvents } from '../../../src/repositories/events';
import { getYearStats } from '../../../src/repositories/stats';
import { useTokens } from '../../../src/theme/tokens';
import { EmptyState } from '../../../src/ui/EmptyState';
import { EntryNames } from '../../../src/ui/EntryNames';
import { LoadFailed } from '../../../src/ui/LoadFailed';

export default function HomeScreen() {
  const ledgerId = useLedgerId();
  const { current } = useLedger();
  const router = useRouter();
  const { colors, space, font, radius } = useTokens();
  const insets = useSafeAreaInsets();

  const [direction, setDirection] = useState<Direction>(DEFAULT_DIRECTION);
  const isMine = isMineOf(direction);

  const today = todayISO();

  // 목록은 서버 기본 1000행에서 조용히 잘린다. 스크롤에 맞춰 이어서 받는다.
  const list = useInfiniteQuery({
    queryKey: queryKeys.entries.byDirection(ledgerId, direction),
    queryFn: ({ pageParam }) => listEntriesByDirection(ledgerId, isMine, { offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset,
  });

  // 총액은 **전체 기간**이다. 올해로 묶으면 2020년 결혼식 축의금처럼 예전 기록이 통째로 빠져
  // "총액 0원"으로 보인다(2026-09-26 사용자 보고. 받은돈 1,988만원이 전부 2020년 행사였다).
  // 연도별로 보는 곳은 통계 탭이다.
  const stats = useQuery({
    queryKey: queryKeys.stats.byYear(ledgerId, null),
    queryFn: () => getYearStats(ledgerId, null),
  });

  // 다가오는 행사는 알림을 넣지 않기로 한 결정 9의 대체물이라 준돈 탭에만 띠로 남긴다.
  const upcoming = useQuery({
    queryKey: queryKeys.events.upcoming(ledgerId),
    queryFn: () => listUpcomingEvents(ledgerId, today, 3),
    enabled: direction === 'given',
  });

  const rows = (list.data?.pages ?? []).flatMap((page) => page.rows);
  const total = direction === 'given' ? (stats.data?.givenTotal ?? 0) : (stats.data?.receivedTotal ?? 0);
  const tone = direction === 'given' ? colors.given : colors.received;
  const upcomingRows = direction === 'given' ? (upcoming.data ?? []) : [];
  // 받은돈은 행사에 속한다. 받은돈 탭의 기록 버튼은 명부 입력(S09)으로 보낸다(2026-09-25 버그 수정).
  const recordHref = direction === 'given' ? '/record' : '/event/receive';
  const recordLabel = direction === 'given' ? '기록 남기기' : '명부 입력하기';
  const unconfirmed =
    direction === 'given'
      ? (stats.data?.givenUnconfirmed ?? 0)
      : (stats.data?.receivedUnconfirmed ?? 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* 머리 — 장부 이름과 검색 */}
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          gap: space.md,
          paddingHorizontal: space.xl,
          paddingTop: insets.top + space.md,
        }}
      >
        <Pressable onPress={() => router.push('/ledger')} style={{ flex: 1 }}>
          <Text style={{ color: colors.textMuted, fontSize: font.caption }}>현재 장부</Text>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: space.xs }}>
            <Text style={{ color: colors.text, fontSize: font.heading, fontWeight: '700' }} numberOfLines={1}>
              {current?.name ?? '내 장부'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="사람 검색"
          onPress={() => router.push('/search')}
          style={({ pressed }) => ({
            alignItems: 'center',
            backgroundColor: colors.bgSubtle,
            borderRadius: radius.pill,
            height: 40,
            justifyContent: 'center',
            width: 40,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Ionicons name="search" size={20} color={colors.text} />
        </Pressable>
      </View>

      {/* 방향 탭 */}
      <View
        style={{
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
          flexDirection: 'row',
          marginTop: space.lg,
          paddingHorizontal: space.xl,
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
                {DIRECTION_LABEL[d]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 96,
          paddingHorizontal: space.xl,
          paddingTop: space.md,
        }}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={{ gap: space.md, paddingBottom: space.md }}>
            {/* 올해 합계 — 카드 두 장 대신 지금 보는 방향 한 줄만 남긴다 */}
            <View style={{ alignItems: 'baseline', flexDirection: 'row', gap: space.sm }}>
              <Text style={{ color: tone, fontSize: font.display, fontWeight: '700' }}>
                {stats.isSuccess ? formatWon(total) : '—'}
              </Text>
              {/* 사용자 요청(2026-09-25) — 연도·건수 표기를 빼고 총액만 남긴다 */}
              {!stats.isSuccess && (
                <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
                  {stats.isError ? '합계를 불러오지 못했습니다' : '합계를 세는 중입니다'}
                </Text>
              )}
              {/* 연도·건수 표기는 뺐지만(사용자 요청) 총액이 왜 적은지는 남겨야 한다 */}
              {stats.isSuccess && unconfirmed > 0 && (
                <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
                  미확정 {unconfirmed}건 제외
                </Text>
              )}
            </View>

            {/* 다가오는 행사 띠 */}
            {upcomingRows.map((e) => (
              <Pressable
                key={e.id}
                onPress={() => router.push(`/event/${e.id}`)}
                style={({ pressed }) => ({
                  alignItems: 'center',
                  backgroundColor: colors.bgSubtle,
                  borderRadius: radius.md,
                  flexDirection: 'row',
                  gap: space.sm,
                  paddingHorizontal: space.md,
                  paddingVertical: space.sm,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                <Text style={{ color: colors.text, flex: 1, fontSize: font.caption }} numberOfLines={1}>
                  {e.title}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
                  {upcomingHint(today, e.date)}
                </Text>
              </Pressable>
            ))}
          </View>
        }
        ListEmptyComponent={
          list.isLoading ? (
            <ActivityIndicator color={colors.textMuted} style={{ marginTop: space.xxl }} />
          ) : list.isError ? (
            // 조회 실패를 "기록 없음"으로 덮으면 사용자가 기록이 사라진 줄 안다.
            <LoadFailed title="기록을 불러오지 못했습니다" onRetry={() => void list.refetch()} />
          ) : direction === 'given' ? (
            <EmptyState
              title="첫 기록을 남겨 보세요"
              hint={'경조사에 낸 돈을 기록하면\n사람별로 주고받은 내역이 쌓입니다.'}
              actionLabel={recordLabel}
              onAction={() => router.push(recordHref)}
            />
          ) : (
            <EmptyState
              title="받은 기록이 아직 없습니다"
              hint={'결혼식·돌잔치 같은 내 행사를 만들면\n명부를 한 번에 입력할 수 있습니다.'}
              actionLabel={recordLabel}
              onAction={() => router.push(recordHref)}
            />
          )
        }
        ListFooterComponent={
          list.isFetchingNextPage ? (
            <ActivityIndicator color={colors.textMuted} style={{ marginVertical: space.lg }} />
          ) : list.isError && rows.length > 0 ? (
            // 목록이 비어 있지 않으면 ListEmptyComponent가 안 그려진다. 이어받기 실패를
            // 알릴 자리가 여기밖에 없다.
            <LoadFailed title="다음 기록을 불러오지 못했습니다" onRetry={() => void list.fetchNextPage()} />
          ) : null
        }
        renderItem={({ item }) => <EntryRow item={item} />}
      />

      {/* 기록 FAB — 사용자가 좋다고 한 부분이라 위치를 그대로 둔다 */}
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
          accessibilityLabel={recordLabel}
          onPress={() => router.push(recordHref)}
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

// 한 행에 사람·행사·날짜·금액이 모두 보여야 한다.
// 이름 영역과 나머지를 따로 누르게 해서 이름은 사람 원장, 나머지는 기록 상세로 보낸다.
function EntryRow({ item }: { item: EntryWithContext }) {
  const router = useRouter();
  const { colors, space, font } = useTokens();
  const isMine = item.event?.is_mine ?? false;

  return (
    <View
      style={{
        alignItems: 'center',
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        flexDirection: 'row',
        gap: space.md,
        paddingVertical: space.md,
      }}
    >
      <View style={{ flex: 1 }}>
        <EntryNames person={item.person} coPerson={item.co_person} />
        <Pressable
          onPress={() => router.push(`/entry/${item.id}`)}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <Text style={{ color: colors.textMuted, fontSize: font.caption, marginTop: 2 }} numberOfLines={1}>
            {entryRowSubtitle(item.event)}
          </Text>
        </Pressable>
      </View>
      <Pressable
        onPress={() => router.push(`/entry/${item.id}`)}
        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
      >
        <Text
          style={{
            color: item.amount === null ? colors.textMuted : isMine ? colors.received : colors.given,
            fontSize: font.body,
            fontWeight: '700',
          }}
        >
          {formatWonShort(item.amount)}
        </Text>
      </Pressable>
    </View>
  );
}
