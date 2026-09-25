// 사람 목록(S03) — 이름 검색, 관계 그룹 필터, 정렬 3종, 행마다 차액
//
// 하단 탭에서 빠지고 더보기 안으로 들어왔다(2026-09-24). 병합·삭제 같은 관리 동작이 여기 있어
// 화면 자체는 지우지 않는다. 일상 동선은 홈 목록의 이름 탭 → 사람 원장이다.
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RELATION_GROUPS, RELATION_GROUP_LABEL, type RelationGroup } from '../../src/domain/constants.ts';
import { normalizeName } from '../../src/domain/name.ts';
import { duplicateNameKeys, needsLabel } from '../../src/domain/person.ts';
import { useLedgerId } from '../../src/ledger/LedgerProvider';
import { queryKeys } from '../../src/lib/queryKeys';
import { listPeople, type PeopleSort } from '../../src/repositories/people';
import { useTokens } from '../../src/theme/tokens';
import { Chip } from '../../src/ui/Chip';
import { EmptyState } from '../../src/ui/EmptyState';
import { Field } from '../../src/ui/Field';
import { LoadFailed } from '../../src/ui/LoadFailed';
import { PersonRow } from '../../src/ui/PersonRow';
import { Screen } from '../../src/ui/Screen';

const SORTS: { key: PeopleSort; label: string }[] = [
  { key: 'name', label: '이름순' },
  { key: 'recent', label: '최근 기록순' },
  { key: 'balance', label: '차액순' },
];

export default function PeopleScreen() {
  const ledgerId = useLedgerId();
  const router = useRouter();
  const { colors, space, font, radius } = useTokens();

  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<RelationGroup | null>(null);
  const [sort, setSort] = useState<PeopleSort>('name');

  const prefix = normalizeName(search);
  const params = { sort, relationGroup: group, search: prefix.length > 0 ? search : null };

  // 명부를 크게 넣은 장부는 사람이 수백 명이다. 한 페이지로 받으면 100명에서 조용히 잘린다.
  const query = useInfiniteQuery({
    queryKey: queryKeys.people.list(ledgerId, { sort, group, prefix }),
    queryFn: ({ pageParam }) => listPeople(ledgerId, { ...params, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset,
  });

  const rows = (query.data?.pages ?? []).flatMap((page) => page.rows);
  // 라벨 없는 동명이인에게 "구분 없음"을 붙여 편집(S05)으로 유도한다. 자동 라벨은 만들지 않는다.
  const dupKeys = duplicateNameKeys(rows);
  const filtering = prefix.length > 0 || group !== null;

  return (
    <Screen padded={false} edges={{ top: false }}>
      <View style={{ paddingHorizontal: space.xl, gap: space.md, paddingTop: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/person/edit')}
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
            <Ionicons name="person-add-outline" size={16} color={colors.text} />
            <Text style={{ color: colors.text, fontSize: font.caption, fontWeight: '600' }}>추가</Text>
          </Pressable>
        </View>

        <Field
          value={search}
          onChangeText={setSearch}
          placeholder="이름으로 찾기"
          autoCorrect={false}
        />

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[null, ...RELATION_GROUPS]}
          keyExtractor={(item) => item ?? 'all'}
          contentContainerStyle={{ gap: space.sm }}
          renderItem={({ item }) => (
            <Chip
              label={item ? RELATION_GROUP_LABEL[item] : '전체'}
              selected={group === item}
              onPress={() => setGroup(item)}
            />
          )}
        />

        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {SORTS.map((s) => (
            <Chip key={s.key} label={s.label} selected={sort === s.key} onPress={() => setSort(s.key)} />
          ))}
        </View>
      </View>

      {query.isLoading ? (
        <ActivityIndicator color={colors.textMuted} style={{ marginTop: space.xxl }} />
      ) : query.isError ? (
        // 조회 실패를 "찾는 사람이 없습니다"로 덮으면 안 된다.
        <LoadFailed title="사람을 불러오지 못했습니다" onRetry={() => void query.refetch()} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id as string}
          contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: space.xxl }}
          keyboardShouldPersistTaps="handled"
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <ActivityIndicator color={colors.textMuted} style={{ marginVertical: space.lg }} />
            ) : null
          }
          ListEmptyComponent={
            filtering ? (
              <EmptyState title="찾는 사람이 없습니다" hint="이름 일부만 넣거나 필터를 지워 보세요." />
            ) : (
              <EmptyState
                title="아직 등록된 사람이 없습니다"
                hint={'경조사를 기록하면 사람이 자동으로 만들어집니다.\n먼저 기록을 남겨 보세요.'}
                actionLabel="기록 남기기"
                onAction={() => router.push('/record')}
              />
            )
          }
          renderItem={({ item }) => (
            <PersonRow
              person={item}
              showBalance
              flag={needsLabel(item, dupKeys) ? '구분 없음' : undefined}
              onPress={() => router.push(`/person/${item.id}`)}
            />
          )}
        />
      )}
    </Screen>
  );
}
