// 하단 탭 4개 — 홈((home) 중첩 스택)·내 행사·통계·더보기. iOS·안드로이드는 네이티브 탭(iOS 26 리퀴드 글라스), 웹은 JS 탭
//
// 2026-10-06 리뉴얼 0단계(docs/DESIGN.md 레이어 규칙). 네비게이션 레이어는 OS 가 그린다 — 직접 블러·반투명을
// 만들지 않는다. 네이티브 탭은 UITabBarController 라 iOS 26 에서 글라스·스크롤 시 축소가 자동이고,
// 안드로이드는 머티리얼 탭이다. 웹은 네이티브 탭의 웹 구현이 글자뿐이라(아이콘 없음) 기존 JS 탭을 두고
// 반투명 흰 면으로 "비슷한 인상"만 낸다(사장님 결정 2).
//
// 2026-10-04 1차 피드백: 기록 탭은 홈에 합쳤고 내 행사 탭이 생겼다. 사람·행사는 더보기 안에 있다.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useEffect, useRef } from 'react';
import { useT } from '../../../src/i18n';
import { restoredTabRoute, tabRouteFromPath } from '../../../src/domain/tabs.ts';
import { LAST_TAB_KEY } from '../../../src/ledger/storage.ts';
import { isWeb } from '../../../src/lib/platform.ts';
import { useTokens } from '../../../src/theme/tokens';

// 되살리기는 앱을 켠 뒤 한 번만이다. 탭 레이아웃이 다시 마운트될 때마다 하면
// 사용자가 방금 누른 탭을 덮어쓴다.
let restoredOnce = false;

// 마지막으로 보던 탭으로 열고, 탭을 옮길 때마다 기억한다. 두 구현이 같이 쓴다.
function useLastTab() {
  const router = useRouter();
  const pathname = usePathname();
  const restoring = useRef(false);

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

  // **되살리는 동안에는 저장하지 않는다.** 첫 마운트의 경로는 언제나 홈이라, 이 가드가 없으면
  // 저장된 탭을 읽기도 전에 홈으로 덮어쓴다(2026-09-26 QA).
  useEffect(() => {
    if (restoring.current) return;
    const route = tabRouteFromPath(pathname);
    if (route) AsyncStorage.setItem(LAST_TAB_KEY, route).catch(() => {});
  }, [pathname]);
}

export default function TabsLayout() {
  useLastTab();
  return isWeb ? <WebTabs /> : <NativeTabsLayout />;
}

// iOS·안드로이드 — OS 의 탭 바. 아이콘은 iOS SF Symbol, 안드로이드 머티리얼 심볼
function NativeTabsLayout() {
  const t = useT();
  const { colors } = useTokens();
  return (
    <NativeTabs minimizeBehavior="onScrollDown" tintColor={colors.accent} labelStyle={{ fontWeight: '600' }} labelVisibilityMode="labeled">
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md={{ default: 'home', selected: 'home' }} />
        <NativeTabs.Trigger.Label>{t('tab.home')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="my-events">
        <NativeTabs.Trigger.Icon sf={{ default: 'calendar', selected: 'calendar' }} md={{ default: 'calendar_month', selected: 'calendar_month' }} />
        <NativeTabs.Trigger.Label>{t('tab.myEvents')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="stats">
        <NativeTabs.Trigger.Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} md={{ default: 'bar_chart', selected: 'bar_chart' }} />
        <NativeTabs.Trigger.Label>{t('tab.stats')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Icon sf={{ default: 'ellipsis', selected: 'ellipsis' }} md={{ default: 'more_horiz', selected: 'more_horiz' }} />
        <NativeTabs.Trigger.Label>{t('tab.more')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

// 웹 — JS 탭. 반투명 흰 면 + 블러(브라우저 backdrop-filter)로 네이티브와 비슷한 인상만 낸다
function WebTabs() {
  const t = useT();
  const { colors, font } = useTokens();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        // 웹에서는 안전 영역 값이 0이라 라벨 아래 여백이 없다. 높이를 직접 준다(2026-09-26 실측).
        tabBarStyle: {
          backgroundColor: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(18px)',
          borderTopColor: colors.border,
          height: 64,
        } as never,
        tabBarLabelStyle: { fontSize: font.caption - 1, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="(home)" options={{ title: t('tab.home'), tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} color={color} size={size} /> }} />
      <Tabs.Screen name="my-events" options={{ title: t('tab.myEvents'), tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'calendar' : 'calendar-outline'} color={color} size={size} /> }} />
      <Tabs.Screen name="stats" options={{ title: t('tab.stats'), tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} color={color} size={size} /> }} />
      <Tabs.Screen name="more" options={{ title: t('tab.more'), tabBarIcon: ({ color, size }) => <MaterialIcons name="more-horiz" color={color} size={size} /> }} />
    </Tabs>
  );
}
