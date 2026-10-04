// 라벨이 붙은 입력칸. 폼에서 반복되는 모양을 한 곳에 모은다 — Green Deck 라이트: 회색 면, 테두리 없음, 포커스에만 초록 선
import { forwardRef, useState } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTokens } from '../theme/tokens';

type Props = TextInputProps & { label?: string; hint?: string };

export const Field = forwardRef<TextInput, Props>(function Field({ label, hint, style, onFocus, onBlur, ...rest }, ref) {
  const { colors, space, radius, font } = useTokens();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: space.xs }}>
      {label && <Text style={{ color: colors.textMuted, fontSize: font.caption }}>{label}</Text>}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textMuted}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          {
            borderWidth: 1,
            borderColor: focused ? colors.accent : colors.surface2,
            borderRadius: radius.sm,
            backgroundColor: colors.surface2,
            color: colors.text,
            fontSize: font.body,
            paddingHorizontal: space.md,
            paddingVertical: space.md,
          },
          style,
        ]}
        {...rest}
      />
      {hint && <Text style={{ color: colors.textMuted, fontSize: font.caption }}>{hint}</Text>}
    </View>
  );
});
