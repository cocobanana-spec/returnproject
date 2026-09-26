// 로그인 전 화면 묶음. 가입·메일 확인·비밀번호 재설정이 여기 들어간다
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { useTokens } from '../../src/theme/tokens';
import { contentFrame, outerFrame } from '../../src/ui/webLayout.ts';

export default function AuthLayout() {
  const { colors } = useTokens();
  return (
    // 넓은 화면에서 로그인 칸이 화면 끝까지 늘어나지 않게 폭을 묶는다.
    // 바깥 View 가 좌우 여백을 칠한다(다크 모드에서 양옆이 하얘지는 것을 막는다).
    <View style={outerFrame(colors.bg)}>
    <View style={[{ flex: 1, backgroundColor: colors.bg }, contentFrame]}>
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
    </View>
    </View>
  );
}
