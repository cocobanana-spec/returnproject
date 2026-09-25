// 사람 검색(S03b) — 홈 우상단 검색 버튼이 여는 화면. 고르면 그 사람 원장(S04)으로 간다
//
// 사람 목록(S03)의 검색만 떼어 왔다. 필터·정렬은 관리용이라 여기 두지 않는다.
// 일상에서 찾는 것은 "그 사람에게 얼마를 주고받았나" 한 가지뿐이다.
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { normalizeName } from '../../src/domain/name.ts';
import { duplicateNameKeys } from '../../src/domain/person.ts';
import { useLedgerId } from '../../src/ledger/LedgerProvider';
import { queryKeys } from '../../src/lib/queryKeys';
import { listPeople } from '../../src/repositories/people';
import { useTokens } from '../../src/theme/tokens';
import { EmptyState } from '../../src/ui/EmptyState';
import { Field } from '../../src/ui/Field';
import { LoadFailed } from '../../src/ui/LoadFailed';
import { PersonRow } from '../../src/ui/PersonRow';
import { Screen } from '../../src/ui/Screen';

export default function SearchScreen() {
  const ledgerId = useLedgerId();
  const router = useRouter();
  const { colors, space, font } = useTokens();

  const [search, setSearch] = useState('');
  // 키를 칠 때마다 요청을 보내면 "김철수" 한 번에 세 번이 나간다.
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  // LIKE 와일드카드(%, _)만 남는 입력은 접두사가 빈 문자열이 되어 전체 명단을 끌어온다.
  const prefix = normalizeName(debounced).replace(/[%_\\]/g, '');
  const searching = prefix.length > 0;

  const query = useQuery({
    queryKey: queryKeys.people.list(ledgerId, { search: prefix }),
    queryFn: () => listPeople(ledgerId, { sort: 'recent', search: prefix }),
    enabled: searching,
  });

  const rows = query.data?.rows ?? [];
  const dupKeys = duplicateNameKeys(rows);

  return (
    <Screen padded={false} edges={{ top: false }}>
      <View style={{ paddingHorizontal: space.xl, paddingTop: space.md }}>
        <Field
          value={search}
          onChangeText={setSearch}
          placeholder="이름으로 찾기"
          autoCorrect={false}
          autoFocus
        />
      </View>

      {!searching ? (
        <View style={{ paddingHorizontal: space.xl, paddingTop: space.xl }}>
          <Text style={{ color: colors.textMuted, fontSize: font.caption, lineHeight: 20 }}>
            이름을 입력하면 그 사람과 주고받은 내역을 볼 수 있습니다.
          </Text>
        </View>
      ) : query.isLoading ? (
        <ActivityIndicator color={colors.textMuted} style={{ marginTop: space.xxl }} />
      ) : query.isError ? (
        // 조회 실패를 "없는 사람"으로 읽으면 사용자가 중복으로 만들게 된다.
        <LoadFailed title="사람을 찾지 못했습니다" onRetry={() => void query.refetch()} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id as string}
          contentContainerStyle={{
            paddingHorizontal: space.xl,
            paddingTop: space.md,
            paddingBottom: space.xxl,
          }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState title="찾는 사람이 없습니다" hint="이름 일부만 넣어 보세요." />
          }
          renderItem={({ item }) => (
            <PersonRow person={item} dupKeys={dupKeys} showBalance onPress={() => router.push(`/person/${item.id}`)} />
          )}
        />
      )}
    </Screen>
  );
}
