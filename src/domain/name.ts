// 사람 이름 정규화 — DB의 people.name_normalized 생성 컬럼과 같은 결과를 내야 한다
//
// DB 표현식은 0001_init.sql 에 있다.
//   lower(regexp_replace(normalize(name, NFC), '\s', '', 'g'))
// 순서가 중요하다. NFC 정규화 → 공백 제거 → 소문자.
// 이 함수가 DB와 어긋나면 자동완성 prefix 조회와 중복 경고가 조용히 틀어진다.
// 대조 검증은 supabase/tests/app_integration.mjs 가 실제 DB에 넣어 비교한다.

export function normalizeName(value: string): string {
  return value.normalize('NFC').replace(/\s/g, '').toLowerCase();
}

// 이름 입력값을 저장 직전에 다듬는다. DB는 1~50자만 받는다(CHECK).
export function trimName(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ');
}

export const NAME_MAX = 50;

export function isValidName(value: string): boolean {
  const trimmed = trimName(value);
  // 공백만 있는 이름은 CHECK(1~50자)를 통과하지만 정규화하면 빈 문자열이 된다. 앱에서 막는다.
  return trimmed.length > 0 && trimmed.length <= NAME_MAX && normalizeName(trimmed).length > 0;
}

// 자동완성 입력을 prefix 조회용으로 바꾼다. DB의 name_normalized와 같은 규칙이어야 한다.
export function toSearchPrefix(value: string): string {
  return normalizeName(value);
}
