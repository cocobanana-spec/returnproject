// 내 행사 탭(S22) — 행사마다 카드(종류 아이콘 원 + 제목 + 종류·날짜 + 상태 배지). 떠 있는 '만들기' 캡슐, 보조 '코드로 참여'
//
// 2026-10-04 1차 피드백(docs/09 A2·A3). 받은 돈은 행사별로 묶어서 본다. 남의 행사(준 돈)는 여기 없다.
// 2026-10-06 리뉴얼 3단계(docs/DESIGN.md). 빈 상태는 가운데 큰 아이콘 + "아직 행사가 없어요".
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useT } from '../../../src/i18n';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { eventTypeLabel } from '../../../src/domain/event.ts';
import { eventTypeIcon } from '../../../src/domain/eventIcon.ts';
import { invitationKindForEvent } from '../../../src/domain/invitation.ts';
import { formatEventDate } from '../../../src/domain/title.ts';
import type { DatePrecision } from '../../../src/domain/constants.ts';
import { useLedgerId, withLedger } from '../../../src/ledger/LedgerProvider';
import { queryKeys } from '../../../src/lib/queryKeys';
import { listEvents, listSharedEvents, type EventRow } from '../../../src/repositories/events';
import { listInvitations } from '../../../src/repositories/invitations.ts';
import { useTokens } from '../../../src/theme/tokens';
import { Button } from '../../../src/ui/Button';
import { Card } from '../../../src/ui/Card';
import { EmptyState } from '../../../src/ui/EmptyState';
import { ListRow } from '../../../src/ui/ListRow';
import { LoadFailed } from '../../../src/ui/LoadFailed';
import { SectionHeader } from '../../../src/ui/SectionHeader';

const FAB_HEIGHT = 56;
const FAB_GAP = 16;

export default function MyEventsScreen() {
  const t = useT();
  const ledgerId = useLedgerId();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, space, font } = useTokens();

  const list = useInfiniteQuery({
    queryKey: queryKeys.events.list(ledgerId, { isMine: true, tab: 'my-events' }),
    queryFn: ({ pageParam }) => listEvents(ledgerId, { isMine: true, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset,
  });
  // 어느 행사에 초대장이 있고 공개 중인지. 카드에 배지로 표시한다.
  const invitations = useQuery({
    queryKey: ['invitations', 'list', { ledgerId }],
    queryFn: () => listInvitations(ledgerId),
  });
  const invByEvent = new Map((invitations.data ?? []).map((i) => [i.event_id, i]));
  const rows: EventRow[] = list.data?.pages.flatMap((p) => p.rows) ?? [];
  // 남의 행사를 코드로 같이 관리하는 것(0016). 목록 아래 따로 모은다.
  const shared = useQuery({ queryKey: ['events', 'shared'], queryFn: listSharedEvents });
  const sharedRows = shared.data ?? [];

  const bottomPad = insets.bottom + FAB_GAP + FAB_HEIGHT + space.xl;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={rows}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: bottomPad, paddingTop: insets.top + space.md, flexGrow: 1 }}
        ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={{ alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.lg }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textMuted, fontSize: font.caption }}>{t('myEvents.subtitle')}</Text>
              <Text style={{ color: colors.text, fontSize: font.heading, fontWeight: '700' }}>{t('myEvents.title')}</Text>
            </View>
            <Button label={t('share.joinByCode')} variant="secondary" size="sm" onPress={() => router.push('/event/join')} />
          </View>
        }
        ListEmptyComponent={
          list.isLoading ? (
            <ActivityIndicator color={colors.textMuted} style={{ marginTop: space.xxl }} />
          ) : list.isError ? (
            <LoadFailed title={t('myEvents.failed')} onRetry={() => void list.refetch()} />
          ) : (
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <EmptyState icon="calendar" title={t('myEvents.emptyTitle')} hint={t('myEvents.emptyHint')} />
            </View>
          )
        }
        renderItem={({ item }) => {
          const inv = invByEvent.get(item.id);
          const kind = invitationKindForEvent(item.type);
          const badge = kind
            ? inv?.status === 'published'
              ? t('myEvents.published', { kind: t(`inv.${kind}`) })
              : inv
                ? t('myEvents.draft', { kind: t(`inv.${kind}`) })
                : null
            : null;
          return (
            <EventCard
              icon={eventTypeIcon(item.type)}
              title={item.title}
              caption={`${eventTypeLabel(item.type)} · ${formatEventDate(item.date, item.date_precision as DatePrecision)}`}
              badge={badge}
              badgeTone={inv?.status === 'published' ? 'accent' : 'muted'}
              onPress={() => router.push(`/event/${item.id}`)}
            />
          );
        }}
        ListFooterComponent={
          <View>
            {list.isFetchingNextPage && <ActivityIndicator color={colors.textMuted} style={{ marginVertical: space.lg }} />}
            {/* 행사가 한두 개면 아래가 휑하다 — 짧은 안내로 빈 공간을 받친다 */}
            {!list.isLoading && rows.length > 0 && rows.length < 3 && sharedRows.length === 0 && (
              <Text style={{ color: colors.textFaint, fontSize: font.caption, lineHeight: 20, marginTop: space.lg, textAlign: 'center' }}>
                {t('myEvents.fewHint')}
              </Text>
            )}
            {sharedRows.length > 0 && (
              <View style={{ marginTop: space.xxl }}>
                <SectionHeader title={t('share.sectionTitle')} />
                <View style={{ gap: space.md }}>
                  {sharedRows.map((e) => (
                    <EventCard
                      key={e.event_id}
                      icon={eventTypeIcon(e.type)}
                      title={e.title}
                      caption={`${eventTypeLabel(e.type)} · ${formatEventDate(e.date, e.date_precision as DatePrecision)}${e.owner_name ? ` · ${t('share.ownerOf', { name: e.owner_name })}` : ''}`}
                      badge={t('share.sharedBadge')}
                      badgeTone="muted"
                      onPress={() => router.push(withLedger(`/event/${e.event_id}`, e.ledger_id, ledgerId))}
                    />
                  ))}
                </View>
              </View>
            )}
          </View>
        }
      />

      {/* 떠 있는 만들기 — primary 글라스 캡슐(iOS 26). 탭바 위 16pt */}
      <View pointerEvents="box-none" style={{ alignItems: 'center', bottom: insets.bottom + FAB_GAP, left: space.xl, position: 'absolute', right: space.xl }}>
        <Button label={t('myEvents.createLong')} onPress={() => router.push('/event/edit')} floating style={{ minWidth: 200, paddingHorizontal: space.xxl }} />
      </View>
    </View>
  );
}

// 행사 카드 — 종류 아이콘 원 + 제목·캡션 + 상태 배지(브랜드 틴트 칩). 누르면 상세
function EventCard({
  icon,
  title,
  caption,
  badge,
  badgeTone,
  onPress,
}: {
  icon: ReturnType<typeof eventTypeIcon>;
  title: string;
  caption: string;
  badge: string | null;
  badgeTone: 'accent' | 'muted';
  onPress: () => void;
}) {
  const { colors, space, font, radius } = useTokens();
  return (
    <Card padded={false}>
      <ListRow icon={icon} title={title} caption={caption} chevron onPress={onPress} />
      {badge && (
        <View style={{ flexDirection: 'row', paddingBottom: space.lg, paddingHorizontal: space.xl, marginTop: -space.xs }}>
          <View style={{ backgroundColor: badgeTone === 'accent' ? colors.accentSoft : colors.surface2, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 5 }}>
            <Text style={{ color: badgeTone === 'accent' ? colors.accent : colors.textMuted, fontSize: font.caption, fontWeight: '700' }}>{badge}</Text>
          </View>
        </View>
      )}
      {/* chevron 아이콘 색을 맞추려고 Ionicons 를 쓰는 ListRow 와 같은 패키지를 참조한다 */}
      {false && <Ionicons name="chevron-forward" />}
    </Card>
  );
}
