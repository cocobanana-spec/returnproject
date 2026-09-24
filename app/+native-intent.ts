// 인증 딥링크를 라우터가 "화면"으로 착각하지 않게 가로챈다
//
// 메일 확인(ppurin://auth/confirm)·비밀번호 재설정(ppurin://auth/reset)·OAuth 복귀
// (ppurin://auth/callback)는 대응하는 파일 라우트가 없다. 그대로 두면 expo-router가
// 시스템 +not-found 로 보내 버려 사용자가 "Unmatched Route" 화면에 갇힌다.
// 여기서 로그인 화면으로 돌려보내고, 실제 코드 교환은 AuthProvider가 원본 URL을 받아 따로 한다.
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return path.startsWith('/auth/') ? '/sign-in' : path;
}
