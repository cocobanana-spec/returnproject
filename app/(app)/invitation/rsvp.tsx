// 참석 여부(S21) — 청첩장 하나에 모인 응답을 한눈에. 요약 카드 → 필터·검색 → 카드 안 목록 → 명단 보내기
//
// 2026-10-07 사장님 요청("보는 방식이 불편하다"). 편집 화면 중간에 끼어 있던 목록을 전용 화면으로 뺐다.
// 주인(장부 구성원)만 읽는다(0017 RLS). 지우기는 행의 ⋯ 대신 길게 누르기 — 잘못 누를 일이 적다.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gbTime } from '../../../src/invitation/render/spring.ts';
import { filterRsvp, mealLabel, rsvpCsv, rsvpShareText, summarizeRsvp, type RsvpFilter } from '../../../src/domain/rsvp.ts';
import { confirmAction } from '../../../src/lib/confirm.ts';
import { canDownload, downloadText } from '../../../src/lib/downloadFile.ts';
import { deleteRsvp, listRsvp } from '../../../src/repositories/invitations.ts';
import { amountText, useTokens } from '../../../src/theme/tokens';
import { Card } from '../../../src/ui/Card';
import { CardRow } from '../../../src/ui/CardRow';
import { Chip } from '../../../src/ui/Chip';
import { EmptyState } from '../../../src/ui/EmptyState';
import { Field } from '../../../src/ui/Field';
import { LoadFailed } from '../../../src/ui/LoadFailed';
import { useToast } from '../../../src/ui/ToastProvider';

const FILTERS: { key: RsvpFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'groom', label: '신랑측' },
  { key: 'bride', label: '신부측' },
  { key: 'absent', label: '불참' },
];

export default function RsvpScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const { colors, space, font, radius } = useTokens();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [filter, setFilter] = useState<RsvpFilter>('all');
  const [query, setQuery] = useState('');

  const key = ['rsvp', id] as const;
  const list = useQuery({ queryKey: key, queryFn: () => listRsvp(id), enabled: !!id });
  const remove = useMutation({
    mutationFn: (rid: string) => deleteRsvp(rid),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => toast.show({ message: e.message, durationMs: 4000 }),
  });

  const rows = useMemo(() => list.data ?? [], [list.data]);
  const sum = summarizeRsvp(rows);
  const shown = useMemo(() => filterRsvp(rows, filter, query), [rows, filter, query]);
  const name = title || '청첩장';

  async function onExport() {
    if (rows.length === 0) return;
    if (canDownload()) {
      downloadText(`${name}-참석여부.csv`, rsvpCsv(rows));
      toast.show({ message: '명단을 내려받았어요. 엑셀에서 열 수 있어요.' });
      return;
    }
    await Share.share({ message: rsvpShareText(name, rows) }).catch(() => {});
  }

  const header = (
    <View style={{ gap: space.xl, paddingBottom: space.md }}>
      {/* 주인공 — 참석 인원 */}
      <View style={{ gap: space.xs }}>
        <Text style={{ color: colors.textMuted, fontSize: font.caption }}>지금까지 온 답장 {sum.responses}건</Text>
        <Text style={{ ...amountText, color: colors.text, fontSize: font.display, fontWeight: '800' }}>참석 {sum.attendingPeople}명</Text>
        <Text style={{ color: colors.textMuted, fontSize: font.body, fontWeight: '500' }}>본인 포함 인원이에요 · 불참 {sum.absentResponses}건</Text>
      </View>

      {/* 측·식사 — 숫자 네 칸 */}
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Stat label="신랑측" value={sum.bySide.groom} />
        <Stat label="신부측" value={sum.bySide.bride} />
      </View>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Stat label="식사" value={sum.meal.yes} small />
        <Stat label="식사 안 함" value={sum.meal.no} small />
        <Stat label="미정" value={sum.meal.unknown} small />
      </View>

      <View style={{ gap: space.md }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.xl }} contentContainerStyle={{ paddingHorizontal: space.xl }}>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {FILTERS.map((f) => (
              <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
            ))}
          </View>
        </ScrollView>
        {rows.length > 6 && <Field value={query} onChangeText={setQuery} placeholder="이름으로 찾기" autoCorrect={false} />}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: '참석 여부',
          headerRight: () =>
            rows.length > 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel={canDownload() ? '명단 내려받기' : '명단 보내기'} hitSlop={8} onPress={() => void onExport()}>
                <Ionicons name={canDownload() ? 'download-outline' : 'share-outline'} size={22} color={colors.text} />
              </Pressable>
            ) : null,
        }}
      />
      {list.isLoading ? (
        <ActivityIndicator color={colors.textMuted} style={{ marginTop: space.xxl }} />
      ) : list.isError ? (
        <View style={{ padding: space.xl }}>
          <LoadFailed title="응답을 불러오지 못했어요" onRetry={() => void list.refetch()} />
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.xl, paddingTop: space.lg }}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
          ListHeaderComponent={rows.length > 0 ? header : null}
          ListEmptyComponent={
            rows.length === 0 ? (
              <Card>
                <EmptyState icon="mail-open" title="아직 온 답장이 없어요" hint={'청첩장 링크를 보내면\n하객의 참석 여부가 여기 모여요.'} />
              </Card>
            ) : (
              <Text style={{ color: colors.textMuted, fontSize: font.body, paddingVertical: space.lg, textAlign: 'center' }}>조건에 맞는 응답이 없어요.</Text>
            )
          }
          renderItem={({ item: r, index }) => (
            <CardRow first={index === 0} last={index === shown.length - 1}>
              <Pressable
                onLongPress={() =>
                  void confirmAction({ title: '이 응답을 지울까요', message: `${r.name} · 되돌릴 수 없어요.`, confirmLabel: '지우기', destructive: true }).then((ok) => {
                    if (ok) remove.mutate(r.id);
                  })
                }
                style={({ pressed }) => ({ flexDirection: 'row', gap: space.md, minHeight: 64, paddingHorizontal: space.xl, paddingVertical: space.md, opacity: pressed ? 0.6 : 1 })}
              >
                <View
                  style={{
                    alignItems: 'center',
                    backgroundColor: r.attending ? colors.accentSoft : colors.surface2,
                    borderRadius: radius.pill,
                    height: 40,
                    justifyContent: 'center',
                    width: 40,
                  }}
                >
                  <Ionicons name={r.attending ? 'checkmark' : 'close'} size={20} color={r.attending ? colors.accent : colors.textMuted} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontSize: font.title, fontWeight: '700' }} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: font.caption }} numberOfLines={1}>
                    {[r.side === 'groom' ? '신랑측' : '신부측', r.attending ? mealLabel(r.meal) : '불참', gbTime(r.created_at)].filter(Boolean).join(' · ')}
                  </Text>
                  {r.message ? (
                    <Text style={{ backgroundColor: colors.surface2, borderRadius: radius.sm, color: colors.text, fontSize: font.body, marginTop: space.xs, padding: space.sm }}>
                      {r.message}
                    </Text>
                  ) : null}
                </View>
                <Text style={{ ...amountText, color: r.attending ? colors.text : colors.textFaint, fontSize: font.title, fontWeight: '700' }}>
                  {r.attending ? `${r.party_size}명` : '—'}
                </Text>
              </Pressable>
            </CardRow>
          )}
          ListFooterComponent={
            rows.length > 0 ? (
              <Text style={{ color: colors.textFaint, fontSize: font.caption, marginTop: space.lg, textAlign: 'center' }}>
                응답을 길게 누르면 지울 수 있어요. 아래로 당기면 새로 불러와요.
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

function Stat({ label, value, small = false }: { label: string; value: number; small?: boolean }) {
  const { colors, space, font, radius } = useTokens();
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, flex: 1, gap: 2, padding: space.lg }}>
      <Text style={{ color: colors.textMuted, fontSize: font.caption }}>{label}</Text>
      <Text style={{ ...amountText, color: colors.text, fontSize: small ? font.title : font.heading, fontWeight: '800' }}>{value}명</Text>
    </View>
  );
}
