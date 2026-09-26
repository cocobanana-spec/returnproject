// 메일 링크·OAuth가 돌아올 주소. 앱은 딥링크, 웹은 현재 origin 기준 주소다
//
// 앱 — 개발 중에는 exp://<host>:8081/--/auth/… , 배포본에서는 ppurin://auth/… 가 된다.
// 웹 — https://<host><baseUrl>/auth/… 가 된다. baseUrl 은 app.json 의 experiments.baseUrl 이고
//      런타임에서는 process.env.EXPO_BASE_URL 로 읽는다(src/lib/platform.ts).
//
// Supabase 대시보드의 Redirect URLs 에 앱 주소와 웹 주소를 **둘 다** 등록해야 한다.
// 등록되지 않은 주소로 돌아오면 Supabase가 링크를 거부한다.
import * as Linking from 'expo-linking';
import { isWeb, webOrigin } from '../lib/platform.ts';

function urlFor(path: 'auth/confirm' | 'auth/reset' | 'auth/callback'): string {
  if (isWeb) return `${webOrigin()}/${path}`;
  return Linking.createURL(path);
}

export function confirmRedirectUrl(): string {
  return urlFor('auth/confirm');
}

export function resetRedirectUrl(): string {
  return urlFor('auth/reset');
}

// 소셜 로그인 복귀 주소. providers.ts 가 쓴다.
export function callbackRedirectUrl(): string {
  return urlFor('auth/callback');
}
