// 개발 전용 메일 로그인 진입점 — 소셜 로그인 콘솔이 준비되기 전에 시뮬레이터로 화면을 보기 위한 것
//
// ⚠ 프로덕션 번들에 절대 남으면 안 된다. 그래서 두 가지를 겹쳐 둔다.
//   1. __DEV__ — 릴리스 빌드에서는 false이므로 아래 상수가 항상 false가 된다.
//   2. EXPO_PUBLIC_DEV_SIGNIN=1 — .env.local(gitignore)에만 있고 EAS 빌드 환경에는 없다.
// 조건을 컴포넌트 밖 모듈 상수로 두어 번들러가 죽은 가지를 제거할 수 있게 한다.
// 콘솔 등록이 끝나면 이 파일과 로그인 화면의 호출부를 지울지 결정한다(checklist 5b).
import { supabase } from '../lib/supabase';

const DEV_FLAG = process.env.EXPO_PUBLIC_DEV_SIGNIN;

export const DEV_SIGN_IN_ENABLED = __DEV__ && (DEV_FLAG === '1' || DEV_FLAG === 'auto');

// 'auto'면 로그인 화면이 뜨자마자 스스로 로그인한다.
// 시뮬레이터에 탭을 보낼 수단이 없어(접근성 권한 불가) 화면 스크린샷 검증을 할 때만 쓴다.
export const DEV_SIGN_IN_AUTO = __DEV__ && DEV_FLAG === 'auto';

export async function devSignIn(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!DEV_SIGN_IN_ENABLED) return { ok: false, message: '개발 로그인이 꺼져 있습니다.' };

  const email = process.env.EXPO_PUBLIC_DEV_EMAIL ?? '';
  const password = process.env.EXPO_PUBLIC_DEV_PASSWORD ?? '';
  if (!email || !password) {
    return { ok: false, message: '.env.local 에 EXPO_PUBLIC_DEV_EMAIL·PASSWORD 가 필요합니다.' };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
