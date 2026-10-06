// 홈(S01) — 순 잔액(주인공) + 보낸·받은 요약 카드 + 최근 기록 카드. 떠 있는 '기록하기' 캡슐(iOS 26 글라스)
//
// 2026-10-06 리뉴얼 2단계(docs/DESIGN.md). 토스처럼 로고·이름은 없고, 검색은 네이티브 툴바((home)/_layout). 요약 카드의
// 두 행(보낸/받은)이 곧 방향 탭이다(docs/09 A1) — 누르면 아래 최근 기록이 그 방향으로 바뀐다. 금액 색은 이 카드에서만 쓴다.
// 목록은 Card 안의 ListRow 로, 이름을 누르면 사람 원장, 행을 누르면 기록 상세다.
//
// 총액은 **전체 기간**이다. 올해로 묶으면 2020년 결혼식 축의금처럼 예전 기록이 통째로 빠져 "총액 0원"으로 보인다
// (2026-09-26 사용자 보고). 연도별로 보는 곳은 통계 탭이다.
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useT } from '../../../../src/i18n';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_DIRECTION, entryRowName, entryRowSubtitle, isMineOf, upcomingHint, type Direction } from '../../../../src/domain/home.ts';
import { eventTypeIcon } from '../../../../src/domain/eventIcon.ts';
import { formatWon, formatWonShort } from '../../../../src/domain/money.ts';
import { todayISO } from '../../../../src/domain/title.ts';
import { useLedgerId } from '../../../../src/ledger/LedgerProvider';
import { queryKeys } from '../../../../src/lib/queryKeys';
import { listEntriesByDirection, type EntryWithContext } from '../../../../src/repositories/entries';
import { listUpcomingEvents } from '../../../../src/repositories/events';
import { getYearStats } from '../../../../src/repositories/stats';
import { amountText, amountTextLarge, useTokens } from '../../../../src/theme/tokens';
import { Button } from '../../../../src/ui/Button';
import { Card } from '../../../../src/ui/Card';
import { EmptyState } from '../../../../src/ui/EmptyState';
import { ListRow } from '../../../../src/ui/ListRow';
import { LoadFailed } from '../../../../src/ui/LoadFailed';
import { SectionHeader } from '../../../../src/ui/SectionHeader';

// 떠 있는 버튼 높이 + 탭바 위 간격. iOS 네이티브 탭은 안전 영역(insets.bottom)에 탭바 높이가 들어 있고,
// 웹 JS 탭은 화면을 나눠 쓰므로(겹치지 않음) 간격만 준다(2026-10-06 웹에서 버튼이 너무 위에 떠 보인 문제)
const FAB_HEIGHT = 56;
const FAB_GAP = 16;

export default function HomeScreen() {
  const t = useT();
  const ledgerId = useLedgerId();
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
  const stats = useQuery({
    queryKey: queryKeys.stats.byYear(ledgerId, null),
    queryFn: () => getYearStats(ledgerId, null),
  });
  // 다가오는 행사는 알림을 넣지 않기로 한 결정 9의 대체물이라 보낸 돈 쪽에만 둔다.
  const upcoming = useQuery({
    queryKey: queryKeys.events.upcoming(ledgerId),
    queryFn: () => listUpcomingEvents(ledgerId, today, 3),
    enabled: direction === 'given',
  });

  const rows = (list.data?.pages ?? []).flatMap((page) => page.rows);
  const upcomingRows = direction === 'given' ? (upcoming.data ?? []) : [];
  // 받은 돈은 행사에 속한다. 받은 돈 쪽의 기록 버튼은 명부 입력(S09)으로 보낸다(2026-09-25 버그 수정).
  const recordHref = direction === 'given' ? '/record' : '/event/receive';
  const recordLabel = direction === 'given' ? t('home.recordGiven') : t('home.recordReceived');
  const unconfirmed = direction === 'given' ? (stats.data?.givenUnconfirmed ?? 0) : (stats.data?.receivedUnconfirmed ?? 0);

  const given = stats.data?.givenTotal ?? 0;
  const received = stats.data?.receivedTotal ?? 0;
  const net = received - given;
  const netLine = net > 0 ? t('home.netMore') : net < 0 ? t('home.netLess') : t('home.netEven');

  const bottomPad = insets.bottom + FAB_GAP + FAB_HEIGHT + space.xl;

  const header = (
    <View style={{ gap: space.xxl, paddingBottom: space.md }}>
      {/* 주인공 — 순 잔액 */}
      <View style={{ gap: space.xs, paddingTop: space.md }}>
        <Text style={{ color: colors.textMuted, fontSize: font.caption }}>{t('home.hero')}</Text>
        <Text style={{ ...amountTextLarge, color: colors.text, fontSize: font.display, fontWeight: '800' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {stats.isSuccess ? `${net < 0 ? '−' : ''}${formatWon(Math.abs(net))}` : '—'}
        </Text>
        {stats.isSuccess && <Text style={{ color: colors.textMuted, fontSize: font.body, fontWeight: '500' }}>{netLine}</Text>}
        {stats.isError && <Text style={{ color: colors.textFaint, fontSize: font.caption }}>{t('home.statsFailed')}</Text>}
      </View>

      {/* 보낸 / 받은 — 두 행이 방향 탭이다. 금액 색은 여기서만.
          라벨 위·금액 아래로 쌓는다 — 한 줄에 두면 좁은 폰에서 "보낸 축의금·조의\n금"처럼 라벨이 낱말 중간에서 꺾인다(2026-10-06 웹) */}
      <Card padded={false}>
        {(['given', 'received'] as const).map((d) => {
          const selected = direction === d;
          const amount = d === 'given' ? given : received;
          return (
            <Pressable
              key={d}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setDirection(d)}
              style={({ pressed }) => ({ alignItems: 'center', flexDirection: 'row', gap: space.md, minHeight: 64, paddingHorizontal: space.xl, paddingVertical: space.md, opacity: pressed ? 0.6 : 1 })}
            >
              <View style={{ alignItems: 'center', backgroundColor: selected ? colors.accentSoft : colors.surface2, borderRadius: radius.pill, height: 40, justifyContent: 'center', width: 40 }}>
                <Ionicons name={d === 'given' ? 'arrow-up' : 'arrow-down'} size={20} color={selected ? colors.accent : colors.textMuted} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: colors.textMuted, fontSize: font.caption, fontWeight: '500' }} numberOfLines={1}>
                  {t(d === 'given' ? 'home.sentLabel' : 'home.receivedLabel')}
                </Text>
                <Text style={{ ...amountText, color: d === 'given' ? colors.given : colors.received, fontSize: font.heading, fontWeight: '800' }} numberOfLines={1}>
                  {stats.isSuccess ? formatWon(amount) : '—'}
                </Text>
              </View>
              {selected && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
            </Pressable>
          );
        })}
      </Card>

      {/* 다가오는 행사 — 보낸 돈 쪽에만 */}
      {upcomingRows.length > 0 && (
        <View>
          <SectionHeader title={t('home.upcoming')} />
          <Card padded={false}>
            {upcomingRows.map((e) => (
              <ListRow key={e.id} icon={eventTypeIcon(e.type)} title={e.title} caption={upcomingHint(today, e.date)} chevron onPress={() => router.push(`/event/${e.id}`)} />
            ))}
          </Card>
        </View>
      )}

      <View>
        <SectionHeader title={`${t('home.recent')} · ${t(direction === 'given' ? 'home.given' : 'home.received')}`} />
        {stats.isSuccess && unconfirmed > 0 && (
          <Text style={{ color: colors.textFaint, fontSize: font.caption, marginBottom: space.sm }}>{t('home.unconfirmedExcluded', { n: unconfirmed })}</Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        // iOS 는 투명 헤더 밑으로 지나가므로 OS 가 위 여백을 준다. 나머지는 직접 준다
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: bottomPad, paddingHorizontal: space.xl, paddingTop: Platform.OS === 'ios' ? 0 : space.md }}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
        }}
        ListHeaderComponent={header}
        // 목록은 카드 안에 들어간다 — 첫 줄 위, 마지막 줄 아래에 카드 모서리를 그린다
        ListEmptyComponent={
          list.isLoading ? (
            <ActivityIndicator color={colors.textMuted} style={{ marginTop: space.xxl }} />
          ) : list.isError ? (
            // 조회 실패를 "기록 없음"으로 덮으면 사용자가 기록이 사라진 줄 안다.
            <LoadFailed title={t('home.listFailed')} onRetry={() => void list.refetch()} />
          ) : (
            <Card>
              <EmptyState
                title={t(direction === 'given' ? 'home.emptyGivenTitle' : 'home.emptyReceivedTitle')}
                hint={t(direction === 'given' ? 'home.emptyGivenHint' : 'home.emptyReceivedHint')}
                actionLabel={t(direction === 'given' ? 'home.firstRecord' : 'home.firstGuest')}
                onAction={() => router.push(recordHref)}
              />
            </Card>
          )
        }
        renderItem={({ item, index }) => <EntryRow item={item} first={index === 0} last={index === rows.length - 1} />}
        ListFooterComponent={
          list.isFetchingNextPage ? (
            <ActivityIndicator color={colors.textMuted} style={{ marginVertical: space.lg }} />
          ) : list.isError && rows.length > 0 ? (
            // 목록이 비어 있지 않으면 ListEmptyComponent가 안 그려진다. 이어받기 실패를 알릴 자리가 여기밖에 없다.
            <LoadFailed title={t('home.nextFailed')} onRetry={() => void list.fetchNextPage()} />
          ) : null
        }
      />

      {/* 떠 있는 기록하기 — 네비게이션 레이어. 탭바 위 16pt. 글라스는 Button 이 iOS 26 에서만 켠다 */}
      {rows.length > 0 && (
        <View pointerEvents="box-none" style={{ alignItems: 'center', bottom: insets.bottom + FAB_GAP, left: space.xl, position: 'absolute', right: space.xl }}>
          <Button label={recordLabel} onPress={() => router.push(recordHref)} floating style={{ minWidth: 200, paddingHorizontal: space.xxl }} />
        </View>
      )}
    </View>
  );
}

// 기록 한 줄 — 카드 안의 ListRow. 이름은 사람 원장, 행은 기록 상세로 간다.
// FlatList 라 카드를 통째로 감쌀 수 없어 첫 줄·마지막 줄에 모서리를 준다.
function EntryRow({ item, first, last }: { item: EntryWithContext; first: boolean; last: boolean }) {
  const router = useRouter();
  const { colors, radius } = useTokens();
  const personId = item.person?.id ?? null;
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderTopLeftRadius: first ? radius.lg : 0,
        borderTopRightRadius: first ? radius.lg : 0,
        borderBottomLeftRadius: last ? radius.lg : 0,
        borderBottomRightRadius: last ? radius.lg : 0,
      }}
    >
      <ListRow
        icon={eventTypeIcon(item.event?.type)}
        title={entryRowName(item.person, item.co_person)}
        caption={entryRowSubtitle(item.event)}
        value={formatWonShort(item.amount)}
        valueTone={item.amount === null ? 'muted' : 'default'}
        onPress={() => router.push(`/entry/${item.id}`)}
        onTitlePress={personId ? () => router.push(`/person/${personId}`) : undefined}
      />
    </View>
  );
}
