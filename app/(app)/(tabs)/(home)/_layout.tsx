// 홈 탭 안의 네이티브 스택 — 검색은 툴바 아이템(우상단)으로. iOS 26 에서 헤더가 글라스가 된다(docs/DESIGN.md 네비게이션 레이어)
//
// 2026-10-06 리뉴얼 2단계. 홈 화면 자체에 그리던 머리(로고·이름·검색)를 뺐다. 토스처럼 로고는 안 보인다.
// 헤더는 iOS 에서만 투명(콘텐츠가 밑으로 지나간다). 안드로이드는 바닥색 면. 웹은 JS 헤더가 빈 띠만 남겨 어색해서
// 숨기고, 검색 버튼은 홈 화면 안 오른쪽 위에 그린다(2026-10-06 사장님 지적).
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { Platform, Pressable } from 'react-native';
import { useT } from '../../../../src/i18n';
import { useTokens } from '../../../../src/theme/tokens';

export default function HomeStackLayout() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTokens();
  return (
    <Stack
      screenOptions={{
        title: '',
        // 로고·앱 이름·검색은 홈 화면 안에서 그린다(2026-10-08 사장님 요청). 네이티브 헤더는 쓰지 않는다
        headerShown: false,
        headerShadowVisible: false,
        headerTintColor: colors.text,
        ...(Platform.OS === 'ios' ? { headerTransparent: true } : { headerStyle: { backgroundColor: colors.bg } }),
        contentStyle: { backgroundColor: colors.bg },
        headerRight: () => (
          <Pressable accessibilityRole="button" accessibilityLabel={t('home.search')} hitSlop={8} onPress={() => router.push('/search')} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
            <Ionicons name="search" size={22} color={colors.text} />
          </Pressable>
        ),
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
