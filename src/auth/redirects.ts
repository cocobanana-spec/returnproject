// 메일 링크가 앱으로 돌아올 주소. expo-linking에 의존하므로 앱에서만 쓴다
//
// 개발 중에는 exp://<host>:8081/--/auth/… , 배포본에서는 ppurin://auth/… 가 된다.
// Supabase 대시보드의 Redirect URLs 에 ppurin://auth/confirm 과 ppurin://auth/reset 을 등록해야 한다.
import * as Linking from 'expo-linking';

export function confirmRedirectUrl(): string {
  return Linking.createURL('auth/confirm');
}

export function resetRedirectUrl(): string {
  return Linking.createURL('auth/reset');
}
