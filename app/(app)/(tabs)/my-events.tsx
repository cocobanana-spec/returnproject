// 내 행사 탭(S22) — 내가 주최한 결혼식·돌잔치·장례식을 카드로. 누르면 받은 돈과 초대장이 있는 행사 상세로 간다
//
// 2026-10-04 1차 피드백(docs/09 A2·A3). 받은 돈은 행사별로 묶어서 본다. 비어 있으면 가운데서 만들기로 유도한다.
// 남의 행사(준 돈)는 여기 없다. 그것은 홈의 기록 목록과 사람 원장이 맡는다.
// 2026-10-04 저녁 사용자 요청으로 줄 목록을 **카드**로 바꿨다. 행사는 몇 개 안 되므로 카드가 더 잘 읽힌다.
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useT } from '../../../src/i18n';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { eventTypeLabel } from '../../../src/domain/event.ts';
import { invitationKindForEvent } from '../../../src/domain/invitation.ts';
import { formatEventDate } from '../../../src/domain/title.ts';
import type { DatePrecision } from '../../../src/domain/constants.ts';
import { useLedgerId, withLedger } from '../../../src/ledger/LedgerProvider';
import { queryKeys } from '../../../src/lib/queryKeys';
import { listEvents, listSharedEvents, type EventRow } from '../../../src/repositories/events';
import { listInvitations } from '../../../src/repositories/invitations.ts';
import { useTokens } from '../../../src/theme/tokens';
import { EmptyState } from '../../../src/ui/EmptyState';
import { LoadFailed } from '../../../src/ui/LoadFailed';

export default function MyEventsScreen() {
  const t = useT();
  const ledgerId = useLedgerId();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, space, font, radius } = useTokens();

  const list = useInfiniteQuery({
    queryKey: queryKeys.events.list(ledgerId, { isMine: true, tab: 'my-events' }),
    queryFn: ({ pageParam }) => listEvents(ledgerId, { isMine: true, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset,
  });
  // 어느 행사에 초대장이 있고 공개 중인지. 카드에 작은 배지로 표시한다.
  const invitations = useQuery({
    queryKey: ['invitations', 'list', { ledgerId }],
    queryFn: () => listInvitations(ledgerId),
  });
  const invByEvent = new Map((invitations.data ?? []).map((i) => [i.event_id, i]));
  const rows: EventRow[] = list.data?.pages.flatMap((p) => p.rows) ?? [];
  // 남의 행사를 코드로 같이 관리하는 것(0016). 목록 아래 따로 모은다.
  const shared = useQuery({ queryKey: ['events', 'shared'], queryFn: listSharedEvents });
  const sharedRows = shared.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          gap: space.md,
          paddingHorizontal: space.xl,
          paddingTop: insets.top + space.md,
          paddingBottom: space.md,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textMuted, fontSize: font.caption }}>{t('myEvents.subtitle')}</Text>
          <Text style={{ color: colors.text, fontSize: font.heading, fontWeight: '700' }}>{t('myEvents.title')}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/event/join')} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: space.sm })}>
          <Text style={{ color: colors.textMuted, fontSize: font.caption, fontWeight: '600' }}>{t('share.joinByCode')}</Text>
        </Pressable>
        {rows.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('myEvents.createLong')}
          onPress={() => router.push('/event/edit')}
          style={({ pressed }) => ({
            alignItems: 'center',
            backgroundColor: colors.accent,
            borderRadius: radius.pill,
            flexDirection: 'row',
            gap: space.xs,
            paddingHorizontal: space.md,
            paddingVertical: space.sm,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="add" size={18} color={colors.textOnAccent} />
          <Text style={{ color: colors.textOnAccent, fontSize: font.caption, fontWeight: '700' }}>{t('myEvents.create')}</Text>
        </Pressable>
        )}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: insets.bottom + space.xxl, flexGrow: 1 }}
        ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
        }}
        ListEmptyComponent={
          list.isLoading ? (
            <ActivityIndicator color={colors.textMuted} style={{ marginTop: space.xxl }} />
          ) : list.isError ? (
            <LoadFailed title={t('myEvents.failed')} onRetry={() => void list.refetch()} />
          ) : (
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <EmptyState
                title={t('myEvents.emptyTitle')}
                hint={t('myEvents.emptyHint')}
                actionLabel={t('myEvents.createLong')}
                onAction={() => router.push('/event/edit')}
              />
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
                : t(`inv.${kind}`)
            : null;
          return (
            <EventCard
              title={item.title}
              subtitle={`${eventTypeLabel(item.type)} · ${formatEventDate(item.date, item.date_precision as DatePrecision)}`}
              badge={badge}
              badgeTone={inv?.status === 'published' ? 'accent' : 'muted'}
              onPress={() => router.push(`/event/${item.id}`)}
            />
          );
        }}
        ListFooterComponent={
          <View>
            {list.isFetchingNextPage && <ActivityIndicator color={colors.textMuted} style={{ marginVertical: space.lg }} />}
            {sharedRows.length > 0 && (
              <View style={{ marginTop: space.xl, gap: space.md }}>
                <Text style={{ color: colors.textMuted, fontSize: font.caption }}>{t('share.sectionTitle')}</Text>
                {sharedRows.map((e) => (
                  <EventCard
                    key={e.event_id}
                    title={e.title}
                    subtitle={`${eventTypeLabel(e.type)} · ${formatEventDate(e.date, e.date_precision as DatePrecision)}${e.owner_name ? ` · ${t('share.ownerOf', { name: e.owner_name })}` : ''}`}
                    badge={t('share.sharedBadge')}
                    badgeTone="muted"
                    onPress={() => router.push(withLedger(`/event/${e.event_id}`, e.ledger_id, ledgerId))}
                  />
                ))}
              </View>
            )}
          </View>
        }
      />
    </View>
  );
}

// 행사 카드 — Green Deck 라이트 카드(흰 면 + 옅은 그림자, 모서리 12, 안쪽 16, 테두리 없음). 배지는 초대장 상태나 '공동' 표시
function EventCard({
  title,
  subtitle,
  badge,
  badgeTone,
  onPress,
}: {
  title: string;
  subtitle: string;
  badge: string | null;
  badgeTone: 'accent' | 'muted';
  onPress: () => void;
}) {
  const { colors, space, font, radius, cardShadow } = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        ...cardShadow,
        opacity: pressed ? 0.7 : 1,
        borderRadius: radius.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        padding: space.lg,
      })}
    >
      <View style={{ flex: 1, gap: space.xs }}>
        <Text style={{ color: colors.text, fontSize: font.title, fontWeight: '700' }} numberOfLines={1}>
          {title}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: font.caption + 1 }} numberOfLines={1}>
          {subtitle}
        </Text>
        {badge && (
          <View style={{ flexDirection: 'row', marginTop: space.xs }}>
            <View
              style={{
                backgroundColor: badgeTone === 'accent' ? colors.accentSoft : colors.surface2,
                borderRadius: radius.pill,
                paddingHorizontal: space.sm + 2,
                paddingVertical: 3,
              }}
            >
              <Text style={{ color: badgeTone === 'accent' ? colors.accent : colors.textMuted, fontSize: font.caption - 1, fontWeight: '700' }}>
                {badge}
              </Text>
            </View>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}
