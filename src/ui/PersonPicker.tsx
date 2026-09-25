// 사람 하나를 고르는 입력. 행사 당사자 지정과 명부 입력이 같은 모양을 쓴다
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { displayName, distinguishLine, duplicateNameKeys } from '../domain/person.ts';
import { normalizeName, trimName } from '../domain/name.ts';
import { queryKeys } from '../lib/queryKeys';
import { listRecentPeople, searchPeopleByPrefix, type PersonBalance } from '../repositories/people';
import { useTokens } from '../theme/tokens';
import { Chip } from './Chip';
import { Field } from './Field';

type Props = {
  ledgerId: string;
  label?: string;
  placeholder?: string;
  picked: PersonBalance | null;
  onPick: (person: PersonBalance) => void;
  onClear: () => void;
  // 새 사람을 만들 수 있는 자리인지. 행사 당사자는 기존 사람만 고른다.
  allowNew?: boolean;
  newName?: string;
  onUseNew?: (name: string) => void;
  autoFocus?: boolean;
  // 최근 사람 칩을 보여 줄지. 명부 입력에서는 방해가 되므로 끈다.
  showRecent?: boolean;
  excludeId?: string | null;
  // 바깥에서 입력값을 제어할 때 쓴다(연속 입력이 저장 후 비우기 위해 필요).
  text?: string;
  onChangeText?: (next: string) => void;
};

export function PersonPicker({
  ledgerId,
  label,
  placeholder = '이름',
  picked,
  onPick,
  onClear,
  allowNew = false,
  newName,
  onUseNew,
  autoFocus = false,
  showRecent = false,
  excludeId,
  text,
  onChangeText,
}: Props) {
  const { colors, space, font, radius } = useTokens();
  const [inner, setInner] = useState('');
  const value = text ?? inner;
  const setValue = onChangeText ?? setInner;

  const prefix = normalizeName(value);

  const suggestions = useQuery({
    queryKey: queryKeys.people.search(ledgerId, `pick:${prefix}`),
    queryFn: () => searchPeopleByPrefix(ledgerId, prefix),
    enabled: !picked && prefix.length > 0,
    // 한 글자마다 쿼리가 하나씩 생긴다. 명부 300명이면 접두사 수천 개가 영속 캐시에 쌓인다.
    // 자동완성 결과는 오래 들고 있을 이유가 없으니 짧게 버린다.
    gcTime: 60_000,
  });

  const recent = useQuery({
    queryKey: queryKeys.people.recent(ledgerId),
    queryFn: () => listRecentPeople(ledgerId, 5),
    enabled: showRecent && !picked && prefix.length === 0,
  });

  const rows = (prefix.length > 0 ? (suggestions.data ?? []) : (recent.data ?? [])).filter(
    (p) => p.id !== excludeId,
  );
  const dupKeys = duplicateNameKeys(rows);

  if (picked) {
    return (
      <View style={{ gap: space.xs }}>
        {label && <Text style={{ color: colors.textMuted, fontSize: font.caption }}>{label}</Text>}
        <Pressable
          onPress={onClear}
          style={{
            alignItems: 'center',
            backgroundColor: colors.bgSubtle,
            borderRadius: radius.md,
            flexDirection: 'row',
            gap: space.sm,
            paddingHorizontal: space.lg,
            paddingVertical: space.md,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: font.body, fontWeight: '600' }}>
              {displayName(picked)}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: font.caption, marginTop: 2 }}>
              {distinguishLine(picked)}
            </Text>
          </View>
          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
        </Pressable>
      </View>
    );
  }

  const newRow =
    allowNew && onUseNew && trimName(value).length > 0 ? (
      <Pressable
        onPress={() => onUseNew(value)}
        style={({ pressed }) => ({
          justifyContent: 'center',
          minHeight: 44,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text style={{ color: colors.given, fontSize: font.body, fontWeight: '600' }}>
          “{trimName(value)}” 새 사람으로 추가
        </Text>
      </Pressable>
    ) : null;

  return (
    <View style={{ gap: space.sm }}>
      <Field
        label={label}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        autoCorrect={false}
        autoFocus={autoFocus}
      />

      {prefix.length === 0 && showRecent && rows.length > 0 && (
        <>
          <Text style={{ color: colors.textMuted, fontSize: font.caption }}>최근 기록한 사람</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {rows.map((p) => (
              <Chip key={p.id} label={displayName(p)} onPress={() => onPick(p)} />
            ))}
          </View>
        </>
      )}

      {prefix.length > 0 && suggestions.isError && (
        // 조회 실패를 "그런 사람 없음"으로 읽으면 이미 있는 사람을 또 만들게 된다.
        <Text style={{ color: colors.danger, fontSize: font.caption }}>
          이름을 확인하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.
        </Text>
      )}

      {prefix.length > 0 && !suggestions.isError && (
        <>
          {rows.length === 0 && !suggestions.isFetching && newRow}
          {rows.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => onPick(p)}
              style={({ pressed }) => ({
                borderBottomColor: colors.border,
                borderBottomWidth: 1,
                justifyContent: 'center',
                minHeight: 44,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={{ color: colors.text, fontSize: font.body }}>{displayName(p)}</Text>
              <Text style={{ color: colors.textMuted, fontSize: font.caption, marginTop: 2 }}>
                {distinguishLine(p, dupKeys)}
              </Text>
            </Pressable>
          ))}
          {rows.length > 0 && newRow}
        </>
      )}
      {newName !== undefined && newName.length > 0 && (
        <Text style={{ color: colors.given, fontSize: font.caption }}>
          새 사람 “{newName}” 으로 저장됩니다.
        </Text>
      )}
    </View>
  );
}
