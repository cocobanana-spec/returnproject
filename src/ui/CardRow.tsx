// FlatList 행을 카드 안에 넣는 껍데기 — 첫 줄 위·마지막 줄 아래에만 카드 모서리를 그린다(docs/DESIGN.md: 모든 목록은 카드 안에)
//
// FlatList 는 행을 하나씩 그려서 Card 로 통째로 감쌀 수 없다. 행마다 흰 면을 깔고 양 끝 행에만 둥근 모서리를 준다.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTokens } from '../theme/tokens';

export function CardRow({ first, last, children }: { first: boolean; last: boolean; children: ReactNode }) {
  const { colors, radius } = useTokens();
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderTopLeftRadius: first ? radius.lg : 0,
        borderTopRightRadius: first ? radius.lg : 0,
        borderBottomLeftRadius: last ? radius.lg : 0,
        borderBottomRightRadius: last ? radius.lg : 0,
      }}
    >
      {children}
    </View>
  );
}
