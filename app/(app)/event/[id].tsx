// 행사 상세(S07) — 내 행사는 정산(측별·형태별·미확정·답례 진행), 남의 행사는 기록 확인
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DatePrecision, Side } from '../../../src/domain/constants.ts';
import { directionLabel } from '../../../src/domain/entry.ts';
import { eventTypeLabel } from '../../../src/domain/event.ts';
import { formatWon, formatWonShort } from '../../../src/domain/money.ts';
import { formatEventDate } from '../../../src/domain/title.ts';
import { useLedgerId } from '../../../src/ledger/LedgerProvider';
import { queryKeys } from '../../../src/lib/queryKeys';
import { listEntriesByEvent } from '../../../src/repositories/entries';
import { deleteEvent, getEvent, getEventSummary } from '../../../src/repositories/events';
import { useTokens } from '../../../src/theme/tokens';
import { Button } from '../../../src/ui/Button';
import { Chip } from '../../../src/ui/Chip';
import { EmptyState } from '../../../src/ui/EmptyState';
import { LoadFailed } from '../../../src/ui/LoadFailed';
import { Screen } from '../../../src/ui/Screen';

export default function EventDetailScreen() {
  const ledgerId = useLedgerId();
  const router = useRouter();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { colors, space, font, radius } = useTokens();
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = id as string;

  const [sideFilter, setSideFilter] = useState<Side | null>(null);
  const [unconfirmedOnly, setUnconfirmedOnly] = useState(false);

  const event = useQuery({
    queryKey: queryKeys.events.detail(ledgerId, eventId),
    queryFn: () => getEvent(ledgerId, eventId),
  });

  const summary = useQuery({
    queryKey: queryKeys.events.summary(ledgerId, eventId),
    queryFn: () => getEventSummary(ledgerId, eventId),
  });

  // 명부는 330명까지 간다(docs/02 §4.5). 한 페이지로 받으면 100건에서 조용히 잘린다.
  const entries = useInfiniteQuery({
    queryKey: queryKeys.entries.byEvent(ledgerId, eventId, { side: sideFilter, unconfirmedOnly }),
    queryFn: ({ pageParam }) =>
      listEntriesByEvent(ledgerId, eventId, { side: sideFilter, unconfirmedOnly, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset,
  });

  const e = event.data;

  useLayoutEffect(() => {
    navigation.setOptions({ title: e?.title ?? '' });
  }, [navigation, e?.title]);

  const remove = useMutation({
    mutationFn: () => deleteEvent(ledgerId, eventId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      void queryClient.invalidateQueries({ queryKey: ['entries'] });
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
      router.back();
    },
    onError: (err: Error) => Alert.alert('삭제하지 못했습니다', err.message),
  });

  if (event.isLoading) {
    return (
      <Screen edges={{ top: false }}>
        <ActivityIndicator color={colors.textMuted} />
      </Screen>
    );
  }

  // 네트워크·토큰 문제도 빈 결과처럼 보인다. "이미 삭제되었다"고 단정하면 안 된다.
  if (event.isError) {
    return (
      <Screen edges={{ top: false }}>
        <LoadFailed title="행사를 불러오지 못했습니다" onRetry={() => void event.refetch()} />
      </Screen>
    );
  }

  if (!e) {
    return (
      <Screen edges={{ top: false }}>
        <EmptyState title="행사를 찾을 수 없습니다" hint="이미 삭제되었거나 다른 장부의 행사입니다." />
      </Screen>
    );
  }

  const s = summary.data;
  const summaryReady = summary.isSuccess;
  const hasSides = Boolean(e.side_a_label);
  const rows = (entries.data?.pages ?? []).flatMap((page) => page.rows);
  const sideLabel = (side: Side | null) =>
    side === 'a' ? (e.side_a_label ?? '측 A') : side === 'b' ? (e.side_b_label ?? '측 B') : '측 미지정';

  function confirmDelete() {
    // 집계가 아직 안 왔거나 실패했으면 "기록 0건"으로 단정하면 안 된다. 330건짜리 행사를
    // 빈 행사처럼 지우게 된다. 모르면 모른다고 적는다.
    const body = !summaryReady
      ? '이 행사의 기록 수를 확인하지 못했습니다. 소속 기록이 있다면 함께 삭제됩니다. 사람은 남습니다. 되돌릴 수 없습니다.'
      : (s?.cnt ?? 0) > 0
        ? `기록 ${s?.cnt}건도 함께 삭제됩니다. 사람은 남습니다. 되돌릴 수 없습니다.`
        : '되돌릴 수 없습니다.';
    Alert.alert(
      `${e?.title ?? '이 행사'} 삭제`,
      body,
      [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: () => remove.mutate() },
      ],
    );
  }

  return (
    <Screen padded={false} edges={{ top: false }}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: space.xl,
          paddingTop: space.md,
          paddingBottom: space.xxl,
        }}
        ListHeaderComponent={
          <View style={{ gap: space.lg, paddingBottom: space.md }}>
            <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
              {formatEventDate(e.date, e.date_precision as DatePrecision)} · {eventTypeLabel(e.type)}
              {e.place ? ` · ${e.place}` : ''}
            </Text>

            {/* 정산 카드 */}
            <View
              style={{
                backgroundColor: colors.bgSubtle,
                borderRadius: radius.lg,
                gap: space.md,
                padding: space.lg,
              }}
            >
              <View>
                <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
                  {e.is_mine ? '받은 돈' : '내가 낸 돈'}
                </Text>
                <Text
                  style={{
                    color: summaryReady
                      ? e.is_mine
                        ? colors.received
                        : colors.given
                      : colors.textMuted,
                    fontSize: font.display,
                    fontWeight: '700',
                    marginTop: 2,
                  }}
                >
                  {summaryReady ? formatWon(s?.total ?? 0) : '—'}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: font.caption, marginTop: 4 }}>
                  {/* 집계를 못 받았는데 "0건 0원"을 찍으면 입력이 날아간 줄 안다 */}
                  {summaryReady
                    ? `${s?.cnt ?? 0}건${(s?.unconfirmed ?? 0) > 0 ? ` · 미확정 ${s?.unconfirmed}건은 합계에서 빠짐` : ''}`
                    : summary.isError
                      ? '합계를 불러오지 못했습니다'
                      : '합계를 세는 중입니다'}
                </Text>
              </View>

              {/* 측별 — 측 라벨이 있을 때만 */}
              {hasSides && (s?.bySide.length ?? 0) > 0 && (
                <View style={{ borderTopColor: colors.border, borderTopWidth: 1, paddingTop: space.md, gap: space.xs }}>
                  {s?.bySide.map((b) => (
                    <View key={b.side ?? 'none'} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
                        {sideLabel(b.side)} · {b.cnt}건
                      </Text>
                      <Text style={{ color: colors.text, fontSize: font.caption, fontWeight: '600' }}>
                        {formatWon(b.total)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* 형태별 */}
              {(s?.byMethod.length ?? 0) > 0 && (
                <View style={{ borderTopColor: colors.border, borderTopWidth: 1, paddingTop: space.md, gap: space.xs }}>
                  {s?.byMethod.map((m) => (
                    <View key={m.key} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
                        {m.label} · {m.cnt}건
                      </Text>
                      <Text style={{ color: colors.text, fontSize: font.caption }}>{formatWon(m.total)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* 답례 진행 — 내 행사에만 의미가 있다 */}
              {e.is_mine && (s?.cnt ?? 0) > 0 && (
                <View style={{ borderTopColor: colors.border, borderTopWidth: 1, paddingTop: space.md }}>
                  <Text style={{ color: colors.text, fontSize: font.caption }}>
                    답례 완료 {s?.returned ?? 0} / 전체 {s?.cnt ?? 0}
                  </Text>
                </View>
              )}
            </View>

            {/* 동작 */}
            {e.is_mine && (
              <Button
                label={(s?.cnt ?? 0) > 0 ? '명부 이어서 입력' : '명부 입력 시작'}
                onPress={() => router.push(`/event/receive?id=${eventId}`)}
              />
            )}
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Action icon="create-outline" label="편집" onPress={() => router.push(`/event/edit?id=${eventId}`)} />
              <Action icon="trash-outline" label="삭제" danger onPress={confirmDelete} />
            </View>

            {/* 필터 */}
            {(hasSides || (s?.unconfirmed ?? 0) > 0 || unconfirmedOnly) && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {hasSides && (
                  <>
                    <Chip label="전체" selected={sideFilter === null} onPress={() => setSideFilter(null)} />
                    <Chip label={e.side_a_label ?? '측 A'} selected={sideFilter === 'a'} onPress={() => setSideFilter('a')} />
                    {e.side_b_label && (
                      <Chip label={e.side_b_label} selected={sideFilter === 'b'} onPress={() => setSideFilter('b')} />
                    )}
                  </>
                )}
                {((s?.unconfirmed ?? 0) > 0 || unconfirmedOnly) && (
                  <Chip
                    label="미확정만"
                    selected={unconfirmedOnly}
                    onPress={() => setUnconfirmedOnly((prev) => !prev)}
                  />
                )}
              </View>
            )}

            <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
              기록 {sideFilter === null && !unconfirmedOnly && summaryReady ? (s?.cnt ?? 0) : rows.length}건
            </Text>
          </View>
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (entries.hasNextPage && !entries.isFetchingNextPage) void entries.fetchNextPage();
        }}
        ListFooterComponent={
          entries.isFetchingNextPage ? (
            <ActivityIndicator color={colors.textMuted} style={{ marginVertical: space.lg }} />
          ) : null
        }
        ListEmptyComponent={
          entries.isError ? (
            <LoadFailed title="기록을 불러오지 못했습니다" onRetry={() => void entries.refetch()} />
          ) : (
            <EmptyState
              title={unconfirmedOnly ? '미확정 기록이 없습니다' : '아직 기록이 없습니다'}
              hint={e.is_mine ? '위 버튼으로 명부를 입력해 보세요.' : '홈에서 준돈을 기록하면 여기에 쌓입니다.'}
            />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/entry/${item.id}`)}
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
              <View style={{ alignItems: 'center', flexDirection: 'row', gap: space.xs }}>
                <Text style={{ color: colors.text, fontSize: font.body }} numberOfLines={1}>
                  {item.person?.name ?? '(이름 없음)'}
                </Text>
                {item.co_person && (
                  <Text style={{ color: colors.textMuted, fontSize: font.caption }}>
                    +{item.co_person.name}
                  </Text>
                )}
              </View>
              <Text style={{ color: colors.textMuted, fontSize: font.caption, marginTop: 2 }}>
                {[
                  item.side ? sideLabel(item.side as Side) : null,
                  item.returned_at ? '답례 완료' : null,
                  directionLabel(e.is_mine),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <Text
              style={{
                color: item.amount === null ? colors.textMuted : e.is_mine ? colors.received : colors.given,
                fontSize: font.body,
                fontWeight: '700',
              }}
            >
              {formatWonShort(item.amount)}
            </Text>
          </Pressable>
        )}
      />
    </Screen>
  );
}

function Action({
  icon,
  label,
  onPress,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const { colors, space, font, radius } = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        borderColor: colors.border,
        borderRadius: radius.md,
        borderWidth: 1,
        flex: 1,
        gap: 4,
        paddingVertical: space.md,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.text} />
      <Text style={{ color: danger ? colors.danger : colors.text, fontSize: font.caption }}>{label}</Text>
    </Pressable>
  );
}
