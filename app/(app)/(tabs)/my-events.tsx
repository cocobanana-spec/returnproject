// 내 행사 탭(S22) — 내가 주최한 결혼식·돌잔치·장례식 목록. 누르면 받은 돈과 초대장이 있는 행사 상세로 간다
//
// 2026-10-04 1차 피드백(docs/09 A2·A3). 받은 돈은 행사별로 묶어서 본다. 비어 있으면 가운데서 만들기로 유도한다.
// 남의 행사(준 돈)는 여기 없다. 그것은 홈의 기록 목록과 사람 원장이 맡는다.
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { eventTypeLabel } from '../../../src/domain/event.ts';
import { invitationKindForEvent, KIND_LABEL } from '../../../src/domain/invitation.ts';
import { formatEventDate } from '../../../src/domain/title.ts';
import type { DatePrecision } from '../../../src/domain/constants.ts';
import { useLedgerId } from '../../../src/ledger/LedgerProvider';
import { queryKeys } from '../../../src/lib/queryKeys';
import { listEvents, type EventRow } from '../../../src/repositories/events';
import { listInvitations } from '../../../src/repositories/invitations.ts';
import { useTokens } from '../../../src/theme/tokens';
import { EmptyState } from '../../../src/ui/EmptyState';
import { LoadFailed } from '../../../src/ui/LoadFailed';

export default function MyEventsScreen() {
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
  // 어느 행사에 초대장이 있고 공개 중인지. 목록 줄에 작게 표시한다.
  const invitations = useQuery({
    queryKey: ['invitations', 'list', { ledgerId }],
    queryFn: () => listInvitations(ledgerId),
  });
  const invByEvent = new Map((invitations.data ?? []).map((i) => [i.event_id, i]));
  const rows: EventRow[] = list.data?.pages.flatMap((p) => p.rows) ?? [];

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
          <Text style={{ color: colors.textMuted, fontSize: font.caption }}>받은 돈을 행사별로</Text>
          <Text style={{ color: colors.text, fontSize: font.heading, fontWeight: '700' }}>내 행사</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="내 행사 만들기"
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
          <Text style={{ color: colors.textOnAccent, fontSize: font.caption, fontWeight: '700' }}>만들기</Text>
        </Pressable>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: insets.bottom + space.xxl, flexGrow: 1 }}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
        }}
        ListEmptyComponent={
          list.isLoading ? (
            <ActivityIndicator color={colors.textMuted} style={{ marginTop: space.xxl }} />
          ) : list.isError ? (
            <LoadFailed title="행사를 불러오지 못했습니다" onRetry={() => void list.refetch()} />
          ) : (
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <EmptyState
                title="내 행사가 아직 없습니다"
                hint={'결혼식·돌잔치·장례식을 만들면\n받은 돈을 행사별로 모아 보고 초대장도 만들 수 있습니다.'}
                actionLabel="+ 내 행사 만들기"
                onAction={() => router.push('/event/edit')}
              />
            </View>
          )
        }
        renderItem={({ item }) => {
          const inv = invByEvent.get(item.id);
          const kind = invitationKindForEvent(item.type);
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/event/${item.id}`)}
              style={({ pressed }) => ({
                borderBottomColor: colors.border,
                borderBottomWidth: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                paddingVertical: space.md,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '600' }} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
                  {eventTypeLabel(item.type)} · {formatEventDate(item.date, item.date_precision as DatePrecision)}
                </Text>
              </View>
              {kind && (
                <Text
                  style={{
                    color: inv?.status === 'published' ? colors.received : colors.textMuted,
                    fontSize: font.caption,
                  }}
                >
                  {inv?.status === 'published' ? `${KIND_LABEL[kind]} 공개 중` : inv ? `${KIND_LABEL[kind]} 초안` : KIND_LABEL[kind]}
                </Text>
              )}
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          );
        }}
        ListFooterComponent={
          list.isFetchingNextPage ? <ActivityIndicator color={colors.textMuted} style={{ marginVertical: space.lg }} /> : null
        }
      />
    </View>
  );
}
