// 사람 생성·편집(S05). id 쿼리 파라미터가 있으면 편집, 없으면 새로 만든다
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import {
  PERSON_KINDS,
  RELATION_GROUPS,
  RELATION_GROUP_LABEL,
  type PersonKind,
  type RelationGroup,
} from '../../../src/domain/constants.ts';
import { isValidName, normalizeName, trimName } from '../../../src/domain/name.ts';
import { useLedgerId } from '../../../src/ledger/LedgerProvider';
import { queryKeys } from '../../../src/lib/queryKeys';
import {
  createPerson,
  findByNormalizedName,
  getPerson,
  updatePerson,
} from '../../../src/repositories/people';
import { useTokens } from '../../../src/theme/tokens';
import { Button } from '../../../src/ui/Button';
import { Chip } from '../../../src/ui/Chip';
import { Field } from '../../../src/ui/Field';
import { Screen } from '../../../src/ui/Screen';

const KIND_LABEL: Record<PersonKind, string> = { person: '개인', group: '단체' };

export default function PersonEditScreen() {
  const ledgerId = useLedgerId();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, space, font } = useTokens();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = Boolean(id);

  const [name, setName] = useState('');
  const [kind, setKind] = useState<PersonKind>('person');
  const [group, setGroup] = useState<RelationGroup>('other');
  const [label, setLabel] = useState('');
  const [phone, setPhone] = useState('');
  const [memo, setMemo] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const existing = useQuery({
    queryKey: queryKeys.people.detail(ledgerId, id ?? ''),
    queryFn: () => getPerson(ledgerId, id as string),
    enabled: editing,
  });

  // 서버 값으로 폼을 채우는 것은 한 번뿐이다. 두 번째부터는 사용자가 친 값을 덮지 않는다.
  const filled = useRef(false);
  useEffect(() => {
    const p = existing.data;
    if (!p || filled.current) return;
    filled.current = true;
    setName(p.name);
    setKind(p.kind as PersonKind);
    setGroup(p.relation_group as RelationGroup);
    setLabel(p.label ?? '');
    setPhone(p.phone ?? '');
    setMemo(p.memo ?? '');
  }, [existing.data]);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['people'] });
    if (id) void queryClient.invalidateQueries({ queryKey: queryKeys.people.detail(ledgerId, id) });
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: trimName(name),
        kind,
        relation_group: group,
        label: label.trim() || null,
        phone: kind === 'group' ? null : phone.trim() || null,
        memo: memo.trim() || null,
      };
      if (editing) return updatePerson(ledgerId, id as string, payload);
      return createPerson(ledgerId, payload);
    },
    onSuccess: () => {
      invalidate();
      router.back();
    },
    onError: (e: Error) => setMessage(e.message),
  });

  // 같은 이름이 이미 있으면 저장 전에 한 번 묻는다(docs/02 §5 동명이인).
  async function onSave() {
    setMessage(null);
    if (!isValidName(name)) {
      setMessage('이름을 넣어 주세요.');
      return;
    }
    const same = (await findByNormalizedName(ledgerId, normalizeName(name))).filter((p) => p.id !== id);
    if (same.length > 0 && !label.trim()) {
      Alert.alert(
        '같은 이름이 이미 있습니다',
        `"${trimName(name)}" 이름이 ${same.length}명 있습니다. 구분 라벨을 붙이면 나중에 헷갈리지 않습니다.`,
        [
          { text: '라벨 붙이기', style: 'cancel' },
          { text: '그대로 저장', onPress: () => save.mutate() },
        ],
      );
      return;
    }
    save.mutate();
  }

  return (
    <Screen scroll edges={{ top: false }}>
      <View style={{ gap: space.lg }}>
        <Field label="이름" value={name} onChangeText={setName} maxLength={50} autoFocus={!editing} />

        <View style={{ gap: space.sm }}>
          <Text style={{ color: colors.textMuted, fontSize: font.caption }}>개인 / 단체</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {PERSON_KINDS.map((k) => (
              <Chip key={k} label={KIND_LABEL[k]} selected={kind === k} onPress={() => setKind(k)} />
            ))}
          </View>
        </View>

        <View style={{ gap: space.sm }}>
          <Text style={{ color: colors.textMuted, fontSize: font.caption }}>관계</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {RELATION_GROUPS.map((g) => (
              <Chip
                key={g}
                label={RELATION_GROUP_LABEL[g]}
                selected={group === g}
                onPress={() => setGroup(g)}
              />
            ))}
          </View>
        </View>

        <Field
          label="구분 라벨"
          value={label}
          onChangeText={setLabel}
          maxLength={30}
          placeholder="회사 동기, 고등학교 …"
          hint="같은 이름이 여러 명일 때 구별하는 데 씁니다."
        />

        {kind === 'person' && (
          <Field label="전화번호" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        )}

        <Field label="메모" value={memo} onChangeText={setMemo} maxLength={500} multiline />

        {message && <Text style={{ color: colors.danger, fontSize: font.caption }}>{message}</Text>}

        <Button
          label={editing ? '저장' : '추가'}
          loading={save.isPending}
          disabled={!isValidName(name)}
          onPress={() => void onSave()}
        />
      </View>
    </Screen>
  );
}
