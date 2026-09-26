// 하단 탭 4개 — 홈·기록·통계·더보기
//
// 2026-09-26 개편(사용자 요청). 홈은 준돈·받은돈 총액만 보여 주는 대시보드가 되고,
// 목록(준돈/받은돈 상단 탭)은 기록 탭으로 그대로 옮겼다. 기록 버튼과 검색도 함께 간다.
// 사람·행사는 2026-09-24에 탭에서 빠져 더보기로 들어갔다. 화면 자체는 지우지 않았다.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { restoredTabRoute, tabRouteFromPath } from '../../../src/domain/tabs.ts';
import { LAST_TAB_KEY } from '../../../src/ledger/storage.ts';
import { useTokens } from '../../../src/theme/tokens';

// 되살리기는 앱을 켠 뒤 한 번만이다. 탭 레이아웃이 다시 마운트될 때마다 하면
// 사용자가 방금 누른 탭을 덮어쓴다.
let restoredOnce = false;

export default function TabsLayout() {
  const { colors, font } = useTokens();
  const router = useRouter();
  const pathname = usePathname();
  const restoring = useRef(false);

  // 마지막으로 보던 탭으로 연다. 저장된 값이 더 이상 없는 탭이면 홈이다.
  useEffect(() => {
    if (restoredOnce) return;
    restoredOnce = true;
    restoring.current = true;
    AsyncStorage.getItem(LAST_TAB_KEY)
      .then((stored) => {
        const route = restoredTabRoute(stored);
        if (route !== '/') router.replace(route);
      })
      .catch(() => {})
      .finally(() => {
        restoring.current = false;
      });
  }, [router]);

  // 탭을 옮길 때마다 기억한다. 탭 안에서 더 들어간 화면은 탭이 아니므로 건드리지 않는다.
  // **되살리는 동안에는 저장하지 않는다.** 첫 마운트의 경로는 언제나 홈이라, 이 가드가 없으면
  // 저장된 탭을 읽기도 전에 홈으로 덮어쓴다. 지금까지 통과한 것은 저장소 큐 순서 덕이었지
  // 계약이 아니었다(2026-09-26 QA).
  useEffect(() => {
    if (restoring.current) return;
    const route = tabRouteFromPath(pathname);
    if (route) AsyncStorage.setItem(LAST_TAB_KEY, route).catch(() => {});
  }, [pathname]);

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
        name="records"
        options={{
          title: '기록',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" color={color} size={size} />,
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
