// 로그인 후 화면 묶음. 현재 장부가 정해지기 전에는 아무 화면도 열지 않는다
import { Stack } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLedger } from '../../src/ledger/LedgerProvider';
import { NoLedger } from '../../src/ledger/NoLedger';
import { useTokens } from '../../src/theme/tokens';
import { OfflineBanner } from '../../src/ui/OfflineBanner';
import { ToastProvider } from '../../src/ui/ToastProvider';

export default function AppLayout() {
  const { status, error } = useLedger();
  const { colors, space, font } = useTokens();

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
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <OfflineBanner />
        <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
          // 그룹 이름 (tabs) 가 뒤로 버튼에 새는 것을 막는다
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="ledger" options={{ title: '장부' }} />
        <Stack.Screen name="search" options={{ title: '사람 찾기' }} />
        <Stack.Screen name="import" options={{ title: '가져오기' }} />
        <Stack.Screen name="people" options={{ title: '사람' }} />
        <Stack.Screen name="events" options={{ title: '행사' }} />
        <Stack.Screen name="person/[id]" options={{ title: '' }} />
        <Stack.Screen name="person/edit" options={{ title: '사람' }} />
        <Stack.Screen name="event/[id]" options={{ title: '' }} />
        <Stack.Screen name="event/edit" options={{ title: '행사' }} />
        <Stack.Screen name="event/receive" options={{ title: '명부 입력' }} />
        <Stack.Screen name="entry/[id]" options={{ title: '기록' }} />
        <Stack.Screen name="account" options={{ title: '계정' }} />
        <Stack.Screen
          name="record"
          options={{ title: '기록 남기기', presentation: 'modal' }}
        />
        </Stack>
      </View>
    </ToastProvider>
  );
}
