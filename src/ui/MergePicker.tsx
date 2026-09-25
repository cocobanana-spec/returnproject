// 병합 대상 고르기 시트(S15의 병합 갈래). 같은 장부의 다른 사람만 후보가 된다
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Text, View } from 'react-native';
import { normalizeName } from '../domain/name.ts';
import { displayName, duplicateNameKeys, needsLabel } from '../domain/person.ts';
import { queryKeys } from '../lib/queryKeys';
import { listPeople } from '../repositories/people';
import { useTokens } from '../theme/tokens';
import { Button } from './Button';
import { Field } from './Field';
import { PersonRow } from './PersonRow';

type Props = {
  visible: boolean;
  ledgerId: string;
  excludeId: string;
  onPick: (personId: string, name: string) => void;
  onClose: () => void;
};

export function MergePicker({ visible, ledgerId, excludeId, onPick, onClose }: Props) {
  const { colors, space, font } = useTokens();
  const [search, setSearch] = useState('');
  const prefix = normalizeName(search);

  const query = useQuery({
    queryKey: queryKeys.people.list(ledgerId, { merge: true, prefix }),
    queryFn: () => listPeople(ledgerId, { sort: 'name', search: prefix.length > 0 ? search : null }),
    enabled: visible,
  });

  const rows = (query.data?.rows ?? []).filter((p) => p.id !== excludeId);
  const dupKeys = duplicateNameKeys(rows);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.xl, gap: space.md }}>
        <Text style={{ color: colors.text, fontSize: font.title, fontWeight: '700' }}>
          어느 사람으로 합칠까요
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: font.caption, lineHeight: 20 }}>
          고른 사람에게 기록이 전부 옮겨지고 지금 보던 사람은 사라집니다. 되돌릴 수 없습니다.
        </Text>

        <Field value={search} onChangeText={setSearch} placeholder="이름으로 찾기" autoCorrect={false} />

        {query.isLoading ? (
          <ActivityIndicator color={colors.textMuted} style={{ marginTop: space.xl }} />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id as string}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={{ color: colors.textMuted, fontSize: font.caption, marginTop: space.xl }}>
                합칠 수 있는 다른 사람이 없습니다.
              </Text>
            }
            renderItem={({ item }) => (
              <PersonRow
                person={item}
                flag={needsLabel(item, dupKeys) ? '구분 없음' : undefined}
                onPress={() => onPick(item.id as string, displayName(item))}
              />
            )}
          />
        )}

        <Button label="닫기" variant="secondary" onPress={onClose} />
      </View>
    </Modal>
  );
}
