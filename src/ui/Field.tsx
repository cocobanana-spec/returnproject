// 라벨이 붙은 입력칸 — 연회색 면, 모서리 12, 포커스하면 브랜드 테두리 1.5(docs/DESIGN.md)
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
        placeholderTextColor={colors.textFaint}
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
            borderWidth: 1.5,
            borderColor: focused ? colors.accent : colors.surface2,
            borderRadius: radius.sm,
            backgroundColor: colors.surface2,
            color: colors.text,
            fontSize: font.body,
            fontWeight: '500',
            minHeight: 52,
            paddingHorizontal: space.lg,
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
