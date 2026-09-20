// 소셜 로그인 진입점. 프로바이더별 차이를 여기 한 곳에 가둬 두고 화면은 signInWith()만 부른다
//
// ⚠ 미검증 — Apple·Google·Kakao 어느 것도 아직 실제로 로그인해 본 적이 없다.
//   Supabase 대시보드에서 프로바이더를 켜고 각 콘솔에 앱을 등록해야 동작한다(checklist 2단계).
//   네이티브 빌드가 불가능한 상태라 브라우저 검증조차 하지 못했다.
//
// 지금은 세 프로바이더 모두 Supabase의 OAuth 브라우저 흐름(PKCE)을 쓴다.
// 클라이언트 ID를 앱에 넣을 필요가 없어 콘솔 등록만으로 동작하기 때문이다.
// iOS 심사 전에는 Apple을 expo-apple-authentication + signInWithIdToken 네이티브 흐름으로
// 바꾸는 것이 좋다(docs/04 §3). 바꿀 자리는 이 파일 한 곳이다.
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { QUERY_CACHE_KEY, queryClient } from '../lib/queryClient';
import { CURRENT_LEDGER_KEY } from '../ledger/storage';

export const AUTH_PROVIDERS = ['apple', 'google', 'kakao'] as const;
export type AuthProviderId = (typeof AUTH_PROVIDERS)[number];

export const AUTH_PROVIDER_LABEL: Record<AuthProviderId, string> = {
  apple: 'Apple로 계속하기',
  google: 'Google로 계속하기',
  kakao: '카카오로 계속하기',
};

export type SignInResult =
  | { status: 'success'; session: Session }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

function redirectUrl(): string {
  // 개발 중에는 exp:// 주소, 배포본에서는 ppurin:// 스킴이 된다.
  return Linking.createURL('auth/callback');
}

export async function signInWith(provider: AuthProviderId): Promise<SignInResult> {
  const redirectTo = redirectUrl();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) return { status: 'error', message: error.message };
  if (!data?.url) return { status: 'error', message: '로그인 주소를 받지 못했습니다.' };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'cancel' || result.type === 'dismiss') return { status: 'cancelled' };
  if (result.type !== 'success') return { status: 'error', message: '로그인이 완료되지 않았습니다.' };

  const code = new URL(result.url).searchParams.get('code');
  if (!code) return { status: 'error', message: '인증 코드를 받지 못했습니다.' };

  const exchanged = await supabase.auth.exchangeCodeForSession(code);
  if (exchanged.error) return { status: 'error', message: exchanged.error.message };
  if (!exchanged.data.session) return { status: 'error', message: '세션을 만들지 못했습니다.' };

  return { status: 'success', session: exchanged.data.session };
}

// 로그아웃은 세션만 지우는 것으로 끝나지 않는다. 영속화된 쿼리 캐시와 선택한 장부가 기기에 남으면
// 다음 사용자가 이전 사용자의 사람·기록 캐시를 물려받는다(PRD §3.12 "로컬 캐시를 비우고").
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  queryClient.clear();
  await AsyncStorage.multiRemove([QUERY_CACHE_KEY, CURRENT_LEDGER_KEY]).catch(() => {});
}
