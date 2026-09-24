// 하단 탭 3개 — 홈·통계·더보기. 기록은 탭이 아니라 홈의 FAB로 시작한다
//
// 사람·행사는 2026-09-24에 탭에서 빠져 더보기로 들어갔다. 사람은 홈 목록의 이름을 눌러,
// 행사는 받은돈 탭과 더보기에서 들어간다. 화면 자체는 지우지 않았다.
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTokens } from '../../../src/theme/tokens';

export default function TabsLayout() {
  const { colors, font } = useTokens();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: font.caption - 1 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: '통계',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: '더보기',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="menu-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
