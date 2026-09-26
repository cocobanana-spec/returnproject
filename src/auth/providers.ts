// 소셜 로그인 진입점. 프로바이더별 차이를 여기 한 곳에 가둬 두고 화면은 signInWith()만 부른다
//
// ⚠ 미검증 — Apple·Google 어느 것도 아직 실제로 로그인해 본 적이 없다.
//   Supabase 대시보드에서 프로바이더를 켜고 각 콘솔에 앱을 등록해야 동작한다(checklist 2단계).
//
// 두 프로바이더 모두 Supabase의 OAuth 브라우저 흐름(PKCE)을 쓴다.
// 클라이언트 ID를 앱에 넣을 필요가 없어 콘솔 등록만으로 동작하기 때문이다.
// iOS 심사 전에는 Apple을 expo-apple-authentication + signInWithIdToken 네이티브 흐름으로
// 바꾸는 것이 좋다(docs/04 §3). 바꿀 자리는 이 파일 한 곳이다.
//
// Kakao는 2026-09-24 사용자 결정으로 1단계에서 빠졌다(docs/04 §3.1에 조사 결과는 보존).
import * as WebBrowser from 'expo-web-browser';
import type { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { mapAuthError } from './errors.ts';
import { parseAuthLink } from './links.ts';
import { callbackRedirectUrl } from './redirects.ts';
import { isWeb } from '../lib/platform.ts';
import { QUERY_CACHE_KEY, queryClient } from '../lib/queryClient';
import { CURRENT_LEDGER_KEY, LAST_TAB_KEY } from '../ledger/storage';

export const AUTH_PROVIDERS = ['apple', 'google'] as const;
export type AuthProviderId = (typeof AUTH_PROVIDERS)[number];

export const AUTH_PROVIDER_LABEL: Record<AuthProviderId, string> = {
  apple: 'Apple로 계속하기',
  google: 'Google로 계속하기',
};

export type SignInResult =
  | { status: 'success'; session: Session }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

export async function signInWith(provider: AuthProviderId): Promise<SignInResult> {
  // 브라우저 세션·URL 파싱은 예상 밖의 예외를 던질 수 있다. 여기서 막지 않으면
  // 화면의 setBusy(null)이 실행되지 않아 버튼이 영구 로딩 상태로 잠긴다.
  try {
    const redirectTo = callbackRedirectUrl();

    // 웹은 별도 브라우저 세션이 필요 없다. 같은 탭에서 Supabase로 갔다가 돌아오고,
    // 돌아온 주소의 코드는 supabase-js 가 detectSessionInUrl 로 직접 처리한다(lib/supabase.ts).
    // 그래서 여기서는 세션을 기다리지 않고 이동만 시킨다.
    if (isWeb) {
      const { error: webError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: false },
      });
      if (webError) return { status: 'error', message: mapAuthError(webError).message };
      // 페이지가 떠나는 중이다. 화면은 로딩 상태 그대로 두면 된다.
      return { status: 'cancelled' };
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) return { status: 'error', message: mapAuthError(error).message };
    if (!data?.url) return { status: 'error', message: '로그인 주소를 받지 못했습니다.' };

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'cancel' || result.type === 'dismiss') return { status: 'cancelled' };
    if (result.type !== 'success') {
      return { status: 'error', message: '로그인이 완료되지 않았습니다.' };
    }

    const link = parseAuthLink(result.url);
    if (link.errorDescription) {
      return { status: 'error', message: mapAuthError({ message: link.errorDescription }).message };
    }
    if (!link.code) return { status: 'error', message: '인증 코드를 받지 못했습니다.' };

    const exchanged = await supabase.auth.exchangeCodeForSession(link.code);
    if (exchanged.error) {
      return { status: 'error', message: mapAuthError(exchanged.error).message };
    }
    if (!exchanged.data.session) return { status: 'error', message: '세션을 만들지 못했습니다.' };

    return { status: 'success', session: exchanged.data.session };
  } catch (error) {
    return { status: 'error', message: mapAuthError(error as never).message };
  }
}

// 로그아웃은 세션만 지우는 것으로 끝나지 않는다. 영속화된 쿼리 캐시와 선택한 장부가 기기에 남으면
// 다음 사용자가 이전 사용자의 사람·기록 캐시를 물려받는다(PRD §3.12 "로컬 캐시를 비우고").
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  queryClient.clear();
  await AsyncStorage.multiRemove([QUERY_CACHE_KEY, CURRENT_LEDGER_KEY, LAST_TAB_KEY]).catch(() => {});
}
