// 기록 한 행의 이름 조각. 대표자와 공동 부조자가 각자의 원장(S04)으로 간다
//
// "김철수 (+이영희)"에서 김철수를 누르면 김철수 원장, 이영희를 누르면 이영희 원장이다
// (2026-09-24 사용자 결정). 조각과 id는 도메인 함수가 주고 여기서는 그리기만 한다.
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { entryRowNames } from '../domain/home.ts';
import { useTokens } from '../theme/tokens';

type Props = {
  person: { id?: string | null; name?: string | null } | null;
  coPerson: { id?: string | null; name?: string | null } | null;
};

export function EntryNames({ person, coPerson }: Props) {
  const router = useRouter();
  const { colors, space, font } = useTokens();
  const parts = entryRowNames(person, coPerson);

  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
      {parts.map((part, index) => (
        <Pressable
          key={`${part.id ?? 'none'}-${index}`}
          accessibilityRole="link"
          accessibilityLabel={`${part.name} 원장 보기`}
          disabled={!part.id}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          onPress={() => part.id && router.push(`/person/${part.id}`)}
          style={({ pressed }) => ({
            alignItems: 'center',
            flexDirection: 'row',
            gap: 2,
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <Text
            style={{
              color: part.co ? colors.textMuted : colors.text,
              fontSize: part.co ? font.caption : font.body,
              fontWeight: part.co ? '500' : '600',
            }}
            numberOfLines={1}
          >
            {part.co ? `(+${part.name})` : part.name}
          </Text>
          <Ionicons name="chevron-forward" size={part.co ? 11 : 13} color={colors.textMuted} />
        </Pressable>
      ))}
    </View>
  );
}
