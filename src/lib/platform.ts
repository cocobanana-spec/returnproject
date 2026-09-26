// 플랫폼 분기를 한 곳에 모은다. 화면과 도메인은 이 모듈만 보고 갈린다
//
// 분기를 여기저기 흩뿌리면 웹을 고칠 때마다 네이티브가 깨진다. 지금 갈리는 것은 셋뿐이다.
//   ① 인증 복귀 주소(딥링크 대 웹 주소) ② OAuth 복귀 처리(딥링크 파싱 대 주소창)
//   ③ 파일 읽기(expo-file-system 대 fetch)
// 그 밖의 도메인·리포지토리·화면은 전부 그대로 공유한다.
import { Platform } from 'react-native';

export const isWeb = Platform.OS === 'web';

// Expo가 app.json 의 experiments.baseUrl 을 번들에 넣어 준다.
// 개발 서버(expo start --web)에서는 빈 문자열이라 origin 바로 아래가 된다.
export function webBasePath(): string {
  const raw = process.env.EXPO_BASE_URL ?? '';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

// 웹에서 브라우저가 이 앱을 열고 있는 주소의 뿌리. 예 https://user.github.io/returnproject/app
export function webOrigin(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}${webBasePath()}`;
}
