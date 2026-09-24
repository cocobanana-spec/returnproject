// 메일·비밀번호 인증. 가입·로그인·메일 확인 재발송·비밀번호 재설정을 한 곳에 모은다
//
// 이 프로젝트는 Supabase의 "Confirm email"을 켜 둔 채로 간다(오타 메일과 남용을 막는다).
// 그래서 가입 직후에는 세션이 없고 확인 메일이 나간다. 확인 링크와 재설정 링크는
// PKCE 흐름이라 ?code= 를 달고 앱으로 돌아오며, 그 교환은 useAuthDeepLink가 맡는다.
//
// 리다이렉트 주소는 인자로 받는다. expo-linking을 직접 끌어오면 Node에서 불러올 수 없어
// 통합 검증에서 이 모듈을 그대로 호출하지 못한다. 앱은 src/auth/redirects.ts 의 값을 넘긴다.
import { db } from '../lib/supabaseClient.ts';
import { mapAuthError, type MappedAuthError } from './errors.ts';
import { normalizeEmail } from '../domain/password.ts';

export type AuthOutcome<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { value?: undefined } : { value: T }))
  | { ok: false; error: MappedAuthError };

function fail(error: unknown): { ok: false; error: MappedAuthError } {
  return { ok: false, error: mapAuthError(error as never) };
}

export type SignUpResult =
  | { ok: true; needsConfirmation: true }
  | { ok: true; needsConfirmation: false }
  | { ok: false; error: MappedAuthError };

export async function signUpWithEmail(
  rawEmail: string,
  password: string,
  emailRedirectTo?: string,
): Promise<SignUpResult> {
  const email = normalizeEmail(rawEmail);
  const { data, error } = await db().auth.signUp({
    email,
    password,
    options: emailRedirectTo ? { emailRedirectTo } : undefined,
  });
  if (error) return fail(error);

  // 이미 가입된 메일이면 Supabase는 오류 대신 identities가 빈 사용자를 돌려준다.
  // (존재 여부를 노출하지 않으려는 설계다.) 앱은 이를 "이미 가입됨"으로 안내한다.
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return {
      ok: false,
      error: {
        kind: 'already_registered',
        message: '이미 가입된 메일 주소입니다. 로그인하거나 비밀번호를 재설정해 주세요.',
      },
    };
  }

  return { ok: true, needsConfirmation: data.session === null };
}

export async function signInWithEmail(
  rawEmail: string,
  password: string,
): Promise<AuthOutcome> {
  const { error } = await db().auth.signInWithPassword({
    email: normalizeEmail(rawEmail),
    password,
  });
  if (error) return fail(error);
  return { ok: true };
}

export async function resendConfirmation(
  rawEmail: string,
  emailRedirectTo?: string,
): Promise<AuthOutcome> {
  const { error } = await db().auth.resend({
    type: 'signup',
    email: normalizeEmail(rawEmail),
    options: emailRedirectTo ? { emailRedirectTo } : undefined,
  });
  if (error) return fail(error);
  return { ok: true };
}

export async function requestPasswordReset(
  rawEmail: string,
  redirectTo?: string,
): Promise<AuthOutcome> {
  const { error } = await db().auth.resetPasswordForEmail(
    normalizeEmail(rawEmail),
    redirectTo ? { redirectTo } : undefined,
  );
  if (error) return fail(error);
  return { ok: true };
}

// 재설정 링크로 들어와 세션이 생긴 뒤에 부른다.
export async function updatePassword(password: string): Promise<AuthOutcome> {
  const { error } = await db().auth.updateUser({ password });
  if (error) return fail(error);
  return { ok: true };
}
