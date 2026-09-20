// 초대 코드 입력 정규화. 서버의 join_ledger도 같은 규칙으로 다듬으므로 앱은 미리 맞춰 보여 준다
export const INVITE_CODE_LENGTH = 8;

// 혼동되는 0·O·1·I를 뺀 32글자. random_invite_code()가 쓰는 집합과 같다.
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// 서버 표현식: upper(regexp_replace(coalesce(p_code,''), '\s', '', 'g'))
export function normalizeInviteCode(raw: string): string {
  return raw.replace(/\s/g, '').toUpperCase();
}

export function isValidInviteCode(raw: string): boolean {
  const code = normalizeInviteCode(raw);
  if (code.length !== INVITE_CODE_LENGTH) return false;
  return [...code].every((ch) => INVITE_CODE_ALPHABET.includes(ch));
}
