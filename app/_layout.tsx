// 앱 루트 — 쿼리 캐시·세션·장부 컨텍스트를 깔고 로그인 여부에 따라 라우팅 그룹을 가른다
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { LedgerProvider } from '../src/ledger/LedgerProvider';
import { persistOptions, queryClient } from '../src/lib/queryClient';
import { useTokens } from '../src/theme/tokens';

function Gate() {
  const { session, restoring, resetPending } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { colors } = useTokens();

  useEffect(() => {
    if (restoring) return;
    const inAuthGroup = segments[0] === '(auth)';
    const onResetScreen = segments[segments.length - 1] === 'reset-password';

    // 재설정 링크로 들어왔으면 세션이 있어도 홈으로 보내지 않는다.
    // 새 비밀번호를 넣기 전까지는 재설정 화면에 붙잡아 둔다.
    if (resetPending) {
      if (!onResetScreen) router.replace('/reset-password');
      return;
    }

    if (!session && !inAuthGroup) router.replace('/sign-in');
    else if (session && inAuthGroup) router.replace('/');
  }, [session, restoring, resetPending, segments, router]);

  if (restoring) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.textMuted} />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  const { isDark } = useTokens();
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <AuthProvider>
        <LedgerProvider>
          <SafeAreaProvider>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <Gate />
          </SafeAreaProvider>
        </LedgerProvider>
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
