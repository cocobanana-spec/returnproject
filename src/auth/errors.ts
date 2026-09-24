// Supabase Auth가 돌려주는 영문 오류를 사용자가 읽을 수 있는 한국어로 바꾼다
//
// 영문 원문을 그대로 화면에 띄우지 않는다. 원인을 구분해 다음에 할 일을 알려 주는 것이 목적이다.
// 순수 함수라 node --test로 덮는다.
export type AuthErrorLike = {
  message?: string | null;
  code?: string | null;
  status?: number | null;
};

export type MappedAuthError = {
  message: string;
  // 화면이 추가 동작을 붙일 수 있도록 원인을 분류해 둔다.
  kind:
    | 'invalid_credentials'
    | 'email_not_confirmed'
    | 'already_registered'
    | 'weak_password'
    | 'same_password'
    | 'invalid_email'
    | 'rate_limited'
    | 'expired_link'
    | 'network'
    | 'unknown';
};

export function mapAuthError(error: AuthErrorLike | null | undefined): MappedAuthError {
  const raw = (error?.message ?? '').toLowerCase();
  const code = (error?.code ?? '').toLowerCase();
  const status = error?.status ?? 0;

  if (status === 429 || code === 'over_email_send_rate_limit' || raw.includes('rate limit') ||
      raw.includes('for security purposes') || raw.includes('too many requests')) {
    return {
      kind: 'rate_limited',
      message: '요청이 너무 잦습니다. 잠시 뒤에 다시 시도해 주세요.',
    };
  }

  if (code === 'invalid_credentials' || raw.includes('invalid login credentials')) {
    return {
      kind: 'invalid_credentials',
      message: '메일 주소 또는 비밀번호가 올바르지 않습니다.',
    };
  }

  if (code === 'email_not_confirmed' || raw.includes('email not confirmed')) {
    return {
      kind: 'email_not_confirmed',
      message: '메일 확인이 아직 끝나지 않았습니다. 받은 메일의 링크를 눌러 주세요.',
    };
  }

  if (code === 'user_already_exists' || raw.includes('already registered') ||
      raw.includes('already been registered')) {
    return {
      kind: 'already_registered',
      message: '이미 가입된 메일 주소입니다. 로그인하거나 비밀번호를 재설정해 주세요.',
    };
  }

  if (code === 'weak_password' || raw.includes('password should be at least') ||
      raw.includes('password is too short')) {
    return {
      kind: 'weak_password',
      message: '비밀번호가 너무 약합니다. 8자 이상, 영문과 숫자를 모두 넣어 주세요.',
    };
  }

  if (code === 'same_password' || raw.includes('should be different from the old password')) {
    return {
      kind: 'same_password',
      message: '이전과 다른 비밀번호를 넣어 주세요.',
    };
  }

  if (code === 'validation_failed' || raw.includes('unable to validate email') ||
      raw.includes('invalid email')) {
    return {
      kind: 'invalid_email',
      message: '메일 주소 형식이 올바르지 않습니다.',
    };
  }

  if (code === 'otp_expired' || raw.includes('expired') || raw.includes('invalid or has expired')) {
    return {
      kind: 'expired_link',
      message: '링크가 만료되었습니다. 메일을 다시 보내 주세요.',
    };
  }

  if (raw.includes('network') || raw.includes('fetch failed') || raw.includes('failed to fetch')) {
    return {
      kind: 'network',
      message: '인터넷 연결을 확인하고 다시 시도해 주세요.',
    };
  }

  return {
    kind: 'unknown',
    message: '문제가 생겼습니다. 잠시 뒤에 다시 시도해 주세요.',
  };
}

// 연속 실패가 쌓이면 안내를 덧붙인다. 무차별 대입은 서버 속도 제한이 막지만,
// 사용자에게는 "왜 안 되는지" 알려 주는 편이 낫다.
export function repeatedFailureHint(failCount: number): string | null {
  if (failCount < 3) return null;
  return '여러 번 실패했습니다. 비밀번호를 잊었다면 재설정을 이용해 주세요.';
}
