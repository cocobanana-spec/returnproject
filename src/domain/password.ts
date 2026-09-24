// 비밀번호 규칙. 화면에 적는 문구와 검증이 어긋나지 않도록 한 곳에서 정한다
//
// Supabase 자체 최소 길이는 6자다. 여기서는 그보다 엄격하게 잡는다.
// 서버가 더 느슨하므로 이 검증을 통과한 값은 서버에서도 항상 통과한다.
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX_BYTES = 72; // bcrypt는 72바이트를 넘기면 뒤를 조용히 버린다

export const PASSWORD_RULE_TEXT = '8자 이상, 영문과 숫자를 모두 넣어 주세요.';

export function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export type PasswordCheck = { ok: true } | { ok: false; errors: string[] };

export function validatePassword(raw: string): PasswordCheck {
  const errors: string[] = [];
  if (raw.length < PASSWORD_MIN) errors.push(`비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.`);
  // 한글이 섞이면 글자 수와 바이트 수가 다르다. bcrypt가 자르는 기준은 바이트다.
  if (byteLength(raw) > PASSWORD_MAX_BYTES) {
    errors.push(`비밀번호가 너무 깁니다. 영문·숫자 기준 ${PASSWORD_MAX_BYTES}자 이내로 넣어 주세요.`);
  }
  if (!/[A-Za-z]/.test(raw)) errors.push('영문을 한 글자 이상 넣어 주세요.');
  if (!/[0-9]/.test(raw)) errors.push('숫자를 한 글자 이상 넣어 주세요.');
  if (/\s/.test(raw)) errors.push('비밀번호에 공백은 쓸 수 없습니다.');
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function validatePasswordConfirm(raw: string, confirm: string): PasswordCheck {
  const base = validatePassword(raw);
  if (!base.ok) return base;
  if (raw !== confirm) return { ok: false, errors: ['비밀번호가 서로 다릅니다.'] };
  return { ok: true };
}

// 메일 형식은 서버가 최종 판정한다. 앱은 명백히 틀린 것만 미리 걸러 왕복을 아낀다.
export function isLikelyEmail(raw: string): boolean {
  const value = raw.trim();
  if (value.length < 5 || value.length > 254) return false;
  if (/\s/.test(value)) return false;
  return /^[^@]+@[^@.]+(\.[^@.]+)+$/.test(value);
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
