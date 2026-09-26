// 사람 상세·원장(S04) — 수지 카드와 이 사람과 주고받은 기록 전부. 병합·삭제도 여기서 한다
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { confirmAction, notify } from '../../../src/lib/confirm.ts';
import { isWeb } from '../../../src/lib/platform.ts';
import { useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { directionLabel, entrySubtitle, isCoEntryFor } from '../../../src/domain/entry.ts';
import { formatWon, formatWonShort } from '../../../src/domain/money.ts';
import { personSubtitle } from '../../../src/domain/person.ts';
import { useLedgerId } from '../../../src/ledger/LedgerProvider';
import { queryKeys } from '../../../src/lib/queryKeys';
import { listEntriesByPerson } from '../../../src/repositories/entries';
import { deletePerson, getPersonBalance, mergePeople } from '../../../src/repositories/people';
import { useTokens } from '../../../src/theme/tokens';
import { displayName } from '../../../src/domain/person.ts';
import { EmptyState } from '../../../src/ui/EmptyState';
import { LoadFailed } from '../../../src/ui/LoadFailed';
import { MergePicker } from '../../../src/ui/MergePicker';
import { Screen } from '../../../src/ui/Screen';

export default function PersonDetailScreen() {
  const ledgerId = useLedgerId();
  const router = useRouter();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { colors, space, font, radius } = useTokens();
  const { id } = useLocalSearchParams<{ id: string }>();
  const personId = id as string;
  const [merging, setMerging] = useState(false);

  const balance = useQuery({
    queryKey: queryKeys.people.balance(ledgerId, personId),
    queryFn: () => getPersonBalance(ledgerId, personId),
  });

  const entries = useQuery({
    queryKey: queryKeys.entries.byPerson(ledgerId, personId),
    queryFn: () => listEntriesByPerson(ledgerId, personId),
  });

  const person = balance.data;

  useLayoutEffect(() => {
    navigation.setOptions({ title: person ? displayName(person) : '' });
  }, [navigation, person]);

  function invalidateAll() {
    void queryClient.invalidateQueries({ queryKey: ['people'] });
    void queryClient.invalidateQueries({ queryKey: ['entries'] });
    void queryClient.invalidateQueries({ queryKey: ['events'] });
    void queryClient.invalidateQueries({ queryKey: ['stats'] });
  }

  const remove = useMutation({
    mutationFn: () => deletePerson(ledgerId, personId),
    onSuccess: () => {
      invalidateAll();
      router.back();
    },
    onError: (e: Error) => void notify('삭제하지 못했습니다', e.message),
  });

  const merge = useMutation({
    mutationFn: (survivorId: string) => mergePeople(ledgerId, personId, survivorId),
    onSuccess: () => {
      invalidateAll();
      setMerging(false);
      router.back();
    },
    onError: (e: Error) => {
      setMerging(false);
      void notify('합치지 못했습니다', e.message);
    },
  });

  // 세 갈래(취소 / 합치기 / 삭제)다. 웹의 확인 창은 예·아니오뿐이라 "합치기"를 담을 수 없는데,
  // 이 화면에는 합치기 버튼이 이미 있으므로 길이 막히지는 않는다. 그래서 웹에서는 본문으로
  // 합치기를 안내하고 예·아니오만 묻는다. 앱은 세 갈래를 그대로 쓴다.
  function confirmDelete() {
    const count = entries.data?.rows.length ?? 0;
    const body =
      count > 0
        ? `기록 ${count}건도 함께 삭제됩니다. 되돌릴 수 없습니다.\n중복으로 만들어진 사람이라면 위의 "합치기"를 쓰세요.`
        : '되돌릴 수 없습니다.';
    if (isWeb) {
      void confirmAction({
        title: `${person ? displayName(person) : '이 사람'} 삭제`,
        message: body,
        confirmLabel: '삭제',
        destructive: true,
      }).then((ok) => {
        if (ok) remove.mutate();
      });
      return;
    }
    Alert.alert(
      `${person ? displayName(person) : '이 사람'} 삭제`,
      body,
      [
        { text: '취소', style: 'cancel' },
        ...(count > 0
          ? [{ text: '다른 사람과 합치기', onPress: () => setMerging(true) }]
          : []),
        { text: '삭제', style: 'destructive' as const, onPress: () => remove.mutate() },
      ],
    );
  }

  if (balance.isLoading) {
    return (
      <Screen edges={{ top: false }}>
        <ActivityIndicator color={colors.textMuted} />
      </Screen>
    );
  }

  // 조회 실패를 "이미 삭제된 사람"으로 읽으면 안 된다. 사람 탭이 사라진 뒤로 이 화면이
  // 사람별 수지에 닿는 주 도착지라, 여기서 실패를 삼키면 기록이 사라진 것처럼 보인다.
  if (balance.isError) {
    return (
      <Screen edges={{ top: false }}>
        <LoadFailed title="사람을 불러오지 못했습니다" onRetry={() => void balance.refetch()} />
      </Screen>
    );
  }

  if (!person) {
    return (
      <Screen>
        <EmptyState title="사람을 찾을 수 없습니다" hint="이미 삭제되었거나 다른 장부의 사람입니다." />
      </Screen>
    );
  }

  const given = person.given_total ?? 0;
  const received = person.received_total ?? 0;
  const diff = person.balance ?? 0;
  const subtitle = personSubtitle(person);
  const rows = entries.data?.rows ?? [];

  return (
    <Screen padded={false} edges={{ top: false }}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.xxl }}
        ListHeaderComponent={
          <View style={{ gap: space.lg, paddingBottom: space.md }}>
            {subtitle.length > 0 && (
              <Text style={{ color: colors.textMuted, fontSize: font.caption }}>{subtitle}</Text>
            )}

            <View
              style={{
                backgroundColor: colors.bgSubtle,
                borderRadius: radius.lg,
                gap: space.md,
                padding: space.lg,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textMuted, fontSize: font.caption }}>내가 준 돈</Text>
                  <Text style={{ color: colors.given, fontSize: font.title, fontWeight: '700', marginTop: 2 }}>
                    {formatWon(given)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textMuted, fontSize: font.caption }}>받은 돈</Text>
                  <Text
                    style={{ color: colors.received, fontSize: font.title, fontWeight: '700', marginTop: 2 }}
                  >
                    {formatWon(received)}
                  </Text>
                </View>
              </View>
              <View style={{ borderTopColor: colors.border, borderTopWidth: 1, paddingTop: space.md }}>
                <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '600' }}>
                  {diff === 0
                    ? '주고받은 금액이 같습니다'
                    : diff > 0
                      ? `내가 ${formatWonShort(diff)} 더 줬습니다`
                      : `내가 ${formatWonShort(Math.abs(diff))} 더 받았습니다`}
                </Text>
                {((person.given_unconfirmed ?? 0) + (person.received_unconfirmed ?? 0)) > 0 && (
                  <Text style={{ color: colors.textMuted, fontSize: font.caption, marginTop: 4 }}>
                    미확정 {(person.given_unconfirmed ?? 0) + (person.received_unconfirmed ?? 0)}건은 합계에서 빠져 있습니다
                  </Text>
                )}
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Action icon="create-outline" label="편집" onPress={() => router.push(`/person/edit?id=${personId}`)} />
              <Action icon="git-merge-outline" label="합치기" onPress={() => setMerging(true)} />
              <Action icon="trash-outline" label="삭제" danger onPress={confirmDelete} />
            </View>

            {/* 기록 조회가 실패했는데 "0건"을 찍으면 수지는 있는데 이력만 없는 모순이 된다 */}
            <Text style={{ color: colors.textMuted, fontSize: font.caption, marginTop: space.sm }}>
              {entries.isError ? '주고받은 기록' : `주고받은 기록 ${rows.length}건`}
            </Text>
          </View>
        }
        ListEmptyComponent={
          entries.isError ? (
            <LoadFailed title="기록을 불러오지 못했습니다" onRetry={() => void entries.refetch()} />
          ) : (
            <EmptyState
              title="아직 주고받은 기록이 없습니다"
              hint="홈에서 기록을 남기면 여기에 쌓입니다."
            />
          )
        }
        renderItem={({ item }) => {
          const isMine = item.event?.is_mine ?? false;
          const co = isCoEntryFor(
            { personId: item.person_id, coPersonId: item.co_person_id, event: item.event },
            personId,
          );
          return (
            <View
              style={{
                borderBottomColor: colors.border,
                borderBottomWidth: 1,
                flexDirection: 'row',
                gap: space.md,
                paddingVertical: space.md,
              }}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                  <Text style={{ color: colors.text, fontSize: font.body }} numberOfLines={1}>
                    {item.event?.title ?? '(행사 없음)'}
                  </Text>
                  {co && (
                    <View
                      style={{
                        backgroundColor: colors.bgSubtle,
                        borderRadius: radius.sm,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                      }}
                    >
                      <Text style={{ color: colors.textMuted, fontSize: font.caption - 2 }}>공동</Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: colors.textMuted, fontSize: font.caption, marginTop: 2 }}>
                  {entrySubtitle(item.event)} · {directionLabel(isMine)}
                </Text>
              </View>
              <Text
                style={{
                  color: isMine ? colors.received : colors.given,
                  fontSize: font.body,
                  fontWeight: '700',
                }}
              >
                {formatWonShort(item.amount)}
              </Text>
            </View>
          );
        }}
      />

      <MergePicker
        visible={merging}
        ledgerId={ledgerId}
        excludeId={personId}
        onClose={() => setMerging(false)}
        onPick={(survivorId, survivorName) => {
          void confirmAction({
            title: '합치기',
            message: `${displayName(person)} 의 기록 ${person.entry_count ?? 0}건이 ${survivorName} 에게 전부 옮겨집니다.`,
            confirmLabel: '합치기',
            destructive: true,
          }).then((ok) => {
            if (ok) merge.mutate(survivorId);
          });
        }}
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
