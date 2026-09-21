// 라벨이 붙은 입력칸. 폼에서 반복되는 모양을 한 곳에 모은다
import { forwardRef } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTokens } from '../theme/tokens';

type Props = TextInputProps & { label?: string; hint?: string };

export const Field = forwardRef<TextInput, Props>(function Field({ label, hint, style, ...rest }, ref) {
  const { colors, space, radius, font } = useTokens();
  return (
    <View style={{ gap: space.xs }}>
      {label && <Text style={{ color: colors.textMuted, fontSize: font.caption }}>{label}</Text>}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textMuted}
        style={[
          {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            backgroundColor: colors.card,
            color: colors.text,
            fontSize: font.body,
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
