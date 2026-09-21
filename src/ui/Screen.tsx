// 화면 공통 껍데기. 안전 영역과 배경색을 한 곳에서 맞춘다
import type { ReactNode } from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTokens } from '../theme/tokens';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: { top?: boolean; bottom?: boolean };
  style?: ViewStyle;
};

export function Screen({ children, scroll = false, padded = true, edges, style }: Props) {
  const { colors, space } = useTokens();
  const insets = useSafeAreaInsets();
  const top = edges?.top === false ? 0 : insets.top;
  const bottom = edges?.bottom === false ? 0 : insets.bottom;

  const inner: ViewStyle = {
    paddingTop: top + (padded ? space.md : 0),
    paddingBottom: bottom + (padded ? space.lg : 0),
    paddingHorizontal: padded ? space.xl : 0,
  };

  if (scroll) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={[inner, style]}
        keyboardShouldPersistTaps="handled"
        // 키보드가 올라와도 입력칸과 저장 버튼에 닿을 수 있게 한다
        automaticallyAdjustKeyboardInsets
      >
        {children}
      </ScrollView>
    );
  }

  return <View style={[{ flex: 1, backgroundColor: colors.bg }, inner, style]}>{children}</View>;
}
