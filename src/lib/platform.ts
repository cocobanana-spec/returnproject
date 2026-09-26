// 플랫폼 분기를 한 곳에 모은다. 화면과 도메인은 이 모듈만 보고 갈린다
//
// 분기를 여기저기 흩뿌리면 웹을 고칠 때마다 네이티브가 깨진다. 지금 갈리는 것은 셋뿐이다.
//   ① 인증 복귀 주소(딥링크 대 웹 주소) ② OAuth 복귀 처리(딥링크 파싱 대 주소창)
//   ③ 파일 읽기(expo-file-system 대 fetch)
// 그 밖의 도메인·리포지토리·화면은 전부 그대로 공유한다.
import { Platform } from 'react-native';

export const isWeb = Platform.OS === 'web';

// Expo가 app.json 의 experiments.baseUrl 을 번들에 **인라인**한다.
// 그래서 개발 서버(expo start --web)에서도 이 값이 들어 있다. 그런데 개발 서버는 앱을
// origin 바로 아래(/)에서 서빙하므로, 개발에서 만들어지는 복귀 주소는
// http://localhost:8081/returnproject/app/auth/… 가 되어 실제 개발 주소와 다르다.
// 개발에서 소셜 로그인·메일 링크를 확인하려면 Supabase Redirect URLs 에 그 주소를
// 그대로 등록하거나(권장), baseUrl 없이 따로 빌드해야 한다.
export function webBasePath(): string {
  const raw = process.env.EXPO_BASE_URL ?? '';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

// 웹에서 브라우저가 이 앱을 열고 있는 주소의 뿌리. 예 https://user.github.io/returnproject/app
export function webOrigin(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}${webBasePath()}`;
}
