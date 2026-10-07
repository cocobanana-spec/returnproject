// 로그인 후 화면 묶음. 현재 장부가 정해지기 전에는 아무 화면도 열지 않는다
import { Stack } from 'expo-router';
import { isWeb } from '../../src/lib/platform.ts';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { recordActivityOncePerDay } from '../../src/lib/activity.ts';
import { contentFrame, outerFrame } from '../../src/ui/webLayout.ts';
import { useLedger } from '../../src/ledger/LedgerProvider';
import { NoLedger } from '../../src/ledger/NoLedger';
import { useTokens } from '../../src/theme/tokens';
import { OfflineBanner } from '../../src/ui/OfflineBanner';
import { ToastProvider } from '../../src/ui/ToastProvider';

export default function AppLayout() {
  const { status, error } = useLedger();
  const { colors, space, font } = useTokens();

  // 하루 한 번 "오늘 열었다"를 남긴다(관리자 통계, 0011). 실패해도 조용하다.
  useEffect(() => {
    if (status === 'ready') void recordActivityOncePerDay();
  }, [status]);

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.textMuted} />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bg,
          padding: space.xl,
        }}
      >
        <Text style={{ color: colors.danger, fontSize: font.body, textAlign: 'center' }}>
          장부를 불러오지 못했습니다.{'\n'}
          {error?.message ?? ''}
        </Text>
      </View>
    );
  }

  // 구성원에서 제거되면 장부가 0권이 될 수 있다. 이때 할 수 있는 일은 초대 코드 입력뿐이다.
  if (status === 'none') return <NoLedger />;

  return (
    <ToastProvider>
      {/* 넓은 화면에서 내용이 가로로 퍼지지 않게 폭을 묶는다. 하단 탭도 이 안에 들어간다.
          바깥 View 가 좌우 여백을 칠한다 — 칠하지 않으면 다크 모드에서 양옆만 하얗다 */}
      <View style={outerFrame(colors.bg)}>
      <View style={[{ flex: 1, backgroundColor: colors.bg }, contentFrame]}>
        <OfflineBanner />
        <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
          // 그룹 이름 (tabs) 가 뒤로 버튼에 새는 것을 막는다
          headerBackButtonDisplayMode: 'minimal',
          // 웹 JS 헤더는 왼쪽 버튼과 제목이 붙어 "취소 기록 남기기"로 보인다 — 제목을 가운데로, 양쪽 여백을 준다
          ...(isWeb
            ? { headerTitleAlign: 'center' as const, headerLeftContainerStyle: { paddingLeft: 12 }, headerRightContainerStyle: { paddingRight: 12 } }
            : {}),
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="ledger-reset" options={{ title: '모든 기록 삭제' }} />
        <Stack.Screen name="search" options={{ title: '사람 찾기' }} />
        <Stack.Screen name="import" options={{ title: '가져오기' }} />
        <Stack.Screen name="people" options={{ title: '사람' }} />
        <Stack.Screen name="events" options={{ title: '행사' }} />
        <Stack.Screen name="person/[id]" options={{ title: '' }} />
        <Stack.Screen name="person/edit" options={{ title: '사람' }} />
        <Stack.Screen name="event/[id]" options={{ title: '' }} />
        <Stack.Screen name="event/edit" options={{ title: '행사' }} />
        <Stack.Screen name="event/receive" options={{ title: '명부 입력' }} />
        <Stack.Screen name="event/join" options={{ title: '' }} />
        <Stack.Screen name="entry/[id]" options={{ title: '기록' }} />
        <Stack.Screen name="invitation/[eventId]" options={{ title: '' }} />
        <Stack.Screen name="invitation/preview" options={{ title: '미리보기' }} />
        <Stack.Screen name="invitation/rsvp" options={{ title: '참석 여부' }} />
        <Stack.Screen name="account" options={{ title: '계정' }} />
        <Stack.Screen name="admin" options={{ title: '관리자' }} />
        <Stack.Screen
          name="record"
          options={{ title: '기록 남기기', presentation: 'modal' }}
        />
        </Stack>
      </View>
      </View>
    </ToastProvider>
  );
}
