// 인증 딥링크 해석. 확인 메일과 재설정 메일이 앱으로 돌아올 때의 주소를 읽는다
//
// PKCE 흐름이라 링크에는 ?code= 가 붙는다. 스킴에 따라 모양이 다르다.
//   개발  exp://127.0.0.1:8081/--/auth/reset?code=xxx
//   배포  ppurin://auth/reset?code=xxx
//   웹    https://host/returnproject/app/auth/reset?code=xxx (스킴과 호스트를 떼고 끝만 본다)
// 순수 함수로 빼서 node --test로 덮는다.
export type AuthLink = {
  kind: 'reset' | 'confirm' | 'callback' | 'other';
  code: string | null;
  errorDescription: string | null;
};

export function parseAuthLink(url: string): AuthLink {
  let code: string | null = null;
  let errorDescription: string | null = null;
  let path = '';

  // URL 파서가 커스텀 스킴을 못 다루는 경우가 있어 문자열에서 직접 끊는다.
  // 오류는 ?query 로 오기도 하고 #fragment 로 오기도 한다. 둘 다 읽는다.
  const queryStart = url.search(/[?#]/);
  const beforeQuery = queryStart >= 0 ? url.slice(0, queryStart) : url;
  const query = queryStart >= 0 ? url.slice(queryStart + 1).replace(/#/g, '&') : '';

  for (const part of query.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const rawKey = eq >= 0 ? part.slice(0, eq) : part;
    const rawValue = eq >= 0 ? part.slice(eq + 1) : '';
    if (!rawKey) continue;
    let value = rawValue.replace(/\+/g, ' ');
    try {
      value = decodeURIComponent(value);
    } catch {
      // 깨진 퍼센트 인코딩이면 원본을 그대로 쓴다. 링크를 통째로 버리지 않는다.
    }
    if (rawKey === 'code') code = value || null;
    if (rawKey === 'error_description') errorDescription = value || null;
  }

  // 스킴만 뗀다. 커스텀 스킴(ppurin://auth/reset)에서는 "auth"가 호스트 자리에 오므로
  // 호스트를 떼면 경로가 망가진다. exp:// 주소의 /--/ 구분자만 없앤다.
  path = beforeQuery
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .replace('/--/', '/')
    .replace(/\/+$/, '');

  // 앞에 /를 붙여 myauth/reset 같은 이름이 잘못 걸리지 않게 한다.
  const normalized = `/${path}`;
  const kind: AuthLink['kind'] = normalized.endsWith('/auth/reset')
    ? 'reset'
    : normalized.endsWith('/auth/confirm')
      ? 'confirm'
      : normalized.endsWith('/auth/callback')
        ? 'callback'
        : 'other';

  return { kind, code, errorDescription };
}
