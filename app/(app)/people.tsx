// 사람 목록(S03) — 이름 검색, 관계 그룹 필터, 정렬 3종, 행마다 차액
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RELATION_GROUPS, RELATION_GROUP_LABEL, type RelationGroup } from '../../../src/domain/constants.ts';
import { normalizeName } from '../../../src/domain/name.ts';
import { useLedgerId } from '../../../src/ledger/LedgerProvider';
import { queryKeys } from '../../../src/lib/queryKeys';
import { listPeople, type PeopleSort } from '../../../src/repositories/people';
import { useTokens } from '../../../src/theme/tokens';
import { Chip } from '../../../src/ui/Chip';
import { EmptyState } from '../../../src/ui/EmptyState';
import { Field } from '../../../src/ui/Field';
import { PersonRow } from '../../../src/ui/PersonRow';
import { Screen } from '../../../src/ui/Screen';

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

  const query = useQuery({
    queryKey: queryKeys.people.list(ledgerId, { sort, group, prefix }),
    queryFn: () => listPeople(ledgerId, params),
  });

  const rows = query.data?.rows ?? [];
  const filtering = prefix.length > 0 || group !== null;

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.xl, gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.text, fontSize: font.heading, fontWeight: '700' }}>사람</Text>
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
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id as string}
          contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: space.xxl }}
          keyboardShouldPersistTaps="handled"
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
              onPress={() => router.push(`/person/${item.id}`)}
            />
          )}
        />
      )}
    </Screen>
  );
}
