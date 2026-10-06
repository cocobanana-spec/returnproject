// 카드 — 순백 면, 모서리 20, 안쪽 20, 그림자 없음. 모든 목록은 이 안에 들어간다(docs/DESIGN.md)
import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { useTokens } from '../theme/tokens';

type Props = {
  children: ReactNode;
  // 목록을 담을 때는 안쪽 여백을 행이 알아서 준다
  padded?: boolean;
  // 카드 안의 하위 영역(연회색)
  tone?: 'default' | 'secondary';
  style?: ViewStyle;
};

export function Card({ children, padded = true, tone = 'default', style }: Props) {
  const { colors, space, radius } = useTokens();
  return (
    <View
      style={[
        {
          backgroundColor: tone === 'secondary' ? colors.surface2 : colors.card,
          borderRadius: radius.lg,
          padding: padded ? space.xl : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
