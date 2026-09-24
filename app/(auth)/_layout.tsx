// 로그인 전 화면 묶음. 가입·메일 확인·비밀번호 재설정이 여기 들어간다
import { Stack } from 'expo-router';
import { useTokens } from '../../src/theme/tokens';

export default function AuthLayout() {
  const { colors } = useTokens();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="sign-up" options={{ title: '회원가입' }} />
      <Stack.Screen name="check-email" options={{ title: '메일 확인', headerBackVisible: false }} />
      <Stack.Screen name="forgot-password" options={{ title: '비밀번호 재설정' }} />
      <Stack.Screen name="reset-password" options={{ title: '새 비밀번호', headerBackVisible: false }} />
    </Stack>
  );
}
