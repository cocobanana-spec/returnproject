# 뿌린대로거두리라 — 기술 스택 확정안

> 작성일 2026-09-14 · 작성 cto-orchestrator · 2026-09-15 사용자 결정 1~3 반영 · 2026-09-16 사용자 결정 11~14 반영 · **2026-09-24 로그인 수단 변경** — 공동 장부 1단계 포함, **로그인 Apple + Google + 메일·비밀번호(Kakao 제외)**, 첫 실행 로그인 우선, 백엔드 Supabase 확정.
> 판단 근거는 2026-09-14 로컬 실측 결과(context-notes.md "기술 환경 발견")에 기반한다.

## 0. 판단의 전제

- 1인 개발이며 iOS와 Android를 동시에 출시한다(확정).
- 1단계부터 서버가 데이터의 원본(SoT)이고, **부부(가족)가 한 장부를 함께 쓴다**(확정). 데이터의 소유 단위는 사용자가 아니라 장부다(docs/03).
- 첫 실행은 로그인이 먼저다(확정). 로그인 수단은 **Apple·Google·메일 회원가입** 세 가지다(2026-09-24 확정. Kakao는 뺐다).
- 2단계 청첩장은 공개 웹 페이지와 하객 회신이 필요하다. 1단계 백엔드가 그대로 2단계를 받는다.
- 실측된 환경 — Xcode 26.6, Android Studio + SDK, Node 26, Bun, CocoaPods 있음. Flutter/Dart 없음. 사용자 실전 경험은 Swift(321go 출시), Kotlin/Compose(321go 베타), Expo(FluencC SDK 57, scentilique), Next.js + Supabase(coco-finance), Supabase Auth·RLS·Edge Function(scentilique).

## 1. 모바일 프레임워크 — Expo 확정

| 기준 | A. React Native + Expo | B. Flutter | C. 네이티브 Swift + Kotlin | D. KMP / Compose Multiplatform |
|---|---|---|---|---|
| 사용자 경험 보유 | 있음(2개 프로젝트) | 없음 | 양쪽 다 있음 | 없음 |
| 툴체인 준비 | 모두 있음 | Flutter SDK 설치부터 | 모두 있음 | JDK·Gradle 설정 필요 |
| 1인 유지 비용 | 코드베이스 1개 | 코드베이스 1개 | **코드베이스 2개** (321go에서 Android가 뒤처진 전례) | 로직 1개 + UI는 플랫폼별 조정 |
| 2단계 웹(청첩장) 코드 공유 | TypeScript 타입·도메인 로직을 웹(Next.js)과 공유 | Dart 웹은 공개 페이지에 불리 | 없음 | 제한적 |
| Supabase 클라이언트 | supabase-js(사용자가 가장 익숙) | supabase-dart | swift·kotlin SDK 각각 | kotlin SDK |
| OTA(JS 번들 업데이트) | EAS Update 가능 | 불가 | 불가 | 불가 |

**사용자 결정 — A. React Native + Expo(TypeScript).**

## 2. 백엔드·DB — Supabase 확정

비교(Supabase / Firebase / 자체 API + Postgres)는 2026-09-15 개정본에서 했고 사용자가 Supabase로 확정했다. 확정 근거를 기록해 둔다.
1. 사용자가 가장 깊게 아는 백엔드다. RLS와 Edge Function까지 운영해 봤으므로 착수 비용이 0에 가깝다.
2. 이 앱의 핵심 화면은 집계(사람별 수지, 연도별 합계)다. 관계형 DB와 SQL 뷰가 가장 자연스럽다.
3. 공동 장부의 "내가 구성원인 장부의 행만" 규칙을 RLS 헬퍼 함수 하나로 DB 계층에서 강제할 수 있다. API 코드마다 검사하는 방식보다 빠뜨릴 곳이 적다.
4. 2단계 청첩장(공개 페이지·익명 회신·계좌 안내)이 같은 프로젝트에 테이블 3개와 `anon` 정책을 더하는 것으로 끝난다.

### 저장 계층 세부
- 앱은 **supabase-js**로 테이블·뷰·RPC를 직접 호출한다. 별도 API 서버·ORM은 없다.
- 스키마는 **Supabase CLI 마이그레이션 SQL**(`supabase/migrations/*.sql`)로 관리하고, 타입은 `supabase gen types typescript`로 생성한다. 손으로 쓴 타입을 두지 않는다.
- 집계는 뷰 1개(`person_balances`)와 RPC(`event_summary`, `stats_by_year`, `delete_person`, `merge_people`)로 서버에 둔다. 장부·구성원 관리는 SECURITY DEFINER RPC 5개(`create_invite_code`, `join_ledger`, `remove_member`, `prepare_account_deletion`, 그리고 `auth.users` 트리거 `handle_new_user`)다. 상세는 docs/03.
- 로컬 DB는 두지 않는다. 오프라인은 TanStack Query 캐시 영속화로 읽기만 지원한다(docs/03 §7).
- 리전은 서울(ap-northeast-2). 개인정보 처리방침에 "서버 보관(Supabase, 서울 리전)", 장부 공유 시 구성원 간 데이터 공개 범위, 계정 삭제 시 처리(혼자인 장부는 삭제, 공유 장부의 데이터는 남음)를 명시한다.

## 3. 인증 (1단계 필수, 확정)

| 항목 | 결정 | 비고 |
|---|---|---|
| 로그인 수단 | **Apple + Google + 메일·비밀번호**, 첫 출시부터 | iOS에서 소셜 로그인을 하나라도 넣으면 Apple 로그인이 의무다 |
| 메일·비밀번호 | Supabase 기본 email 프로바이더. 가입·메일 확인·재발송·비밀번호 재설정 네 흐름 | 비밀번호 8자 이상 + 영문·숫자(앱 규칙. 서버 최소는 6자라 앱 규칙이 더 엄격하다) |
| 메일 확인 | **켠 채로 둔다** | 오타 메일과 남용을 막는다. 가입 직후에는 세션이 없고 확인 링크를 눌러야 끝난다 |
| 딥링크 | 확인 `ppurin://auth/confirm`, 재설정 `ppurin://auth/reset`, OAuth 복귀 `ppurin://auth/callback` | PKCE라 `?code=`를 달고 돌아온다. `src/auth/links.ts`가 해석하고 `AuthProvider`가 교환한다. **`app/+native-intent.ts`가 이 경로들을 라우터에서 가로채지 않으면 사용자가 Unmatched Route에 갇힌다** |
| 첫 실행 | 로그인 화면이 먼저 뜬다. 로그인 성공 시 서버 트리거가 개인 장부를 만들고 홈으로 간다 | 익명 시작은 하지 않는다(확정) |
| Apple | **현재 구현은 `signInWithOAuth` 브라우저 PKCE 흐름**(`src/auth/providers.ts`). 네이티브 모듈을 쓰지 않아 Expo Go에서도 돈다 | iOS 심사 전에 `expo-apple-authentication` + `signInWithIdToken` 네이티브 흐름으로 바꾸는 것을 권한다. 바꿀 자리는 providers.ts 한 곳 |
| Google | **현재 구현은 `signInWithOAuth` 브라우저 PKCE 흐름**. 앱에 클라이언트 ID를 넣지 않는다 | Supabase Client ID 칸에 웹 클라이언트를 먼저, iOS 클라이언트를 쉼표로 붙인다 |
| 세션 저장 | supabase-js 기본(AsyncStorage) | 1단계는 기본값 |
| 계정 삭제 | 설정 → 계정 → 계정 삭제. 앱이 사용자 JWT로 RPC `prepare_account_deletion()`을 호출한 뒤 Edge Function `delete-account`가 service role로 사용자를 삭제 | App Store 필수 요건. 장부 처리 규칙은 docs/03 §6.2 |
| 앱 잠금(생체 인증) | 사용자 확인 질문 4번. 기본 가정은 첫 출시 제외 | expo-local-authentication |

### 3.1 Kakao 로그인 — **1단계에서 제외됨 (2026-09-24)**

> 사용자 결정으로 Kakao는 1단계에 넣지 않는다. 아래 조사 결과는 **지우지 않고 보존한다.**
> 나중에 다시 넣기로 하면 이 내용이 그대로 유효하므로 재조사가 필요 없다.
> (2026-09-16, Supabase 공식 문서 `guides/auth/social-login/auth-kakao` 기준)

**확인된 사실**
- Kakao는 Supabase Auth의 **기본 제공(built-in) OAuth 프로바이더**다. 대시보드 Authentication → Providers에서 켠다.
- Kakao Developers 설정 — 앱의 **REST API 키**가 `client_id`, **Kakao 로그인 → 보안 → Client Secret**(활성화 필요)이 `client_secret`. **Redirect URI**에 Supabase 콜백 `https://<project-ref>.supabase.co/auth/v1/callback`을 등록한다.
- 동의 항목 — `profile_nickname`, `profile_image`, `account_email`(선택). 문서가 명시하기를 **`account_email` 동의 항목은 "비즈 앱"으로 등록된 앱에서만 사용할 수 있다.**
- 문서에 `signInWithOAuth({ provider: 'kakao' })` 외에 **Kakao ID 토큰을 `signInWithIdToken`으로 넘기는 경로**도 기술되어 있다(인가 코드를 ID 토큰으로 교환해 전달).

**검증 필요 (착수 시 실제로 확인할 것)**
- 네이티브 Kakao SDK(`@react-native-seoul/kakao-login` 등) 경로 — Kakao Developers에서 OpenID Connect를 켜고 받은 ID 토큰을 `signInWithIdToken({ provider: 'kakao', token })`으로 넘겼을 때 실제로 세션이 생기는지. 확인 방법은 Supabase 로컬(`supabase start`)에 Kakao 프로바이더를 설정하고 테스트 앱에서 1회 시도. 안 되면 브라우저 OAuth 경로(확인된 사실)로 간다. 카톡 앱으로 넘어가는 UX는 네이티브 SDK가 낫지만 필수는 아니다.
- **비즈 앱 전환 조건** — 이메일을 받으려면 비즈 앱이어야 하는데, 개인 개발자가 사업자 정보 없이 전환할 수 있는지(개인 개발자 비즈 앱 제도)는 Kakao Developers 문서에서 확인한다. 이메일 없이 로그인이 되는 경우 Supabase가 이메일 없는 사용자를 어떻게 만드는지도 함께 확인한다(`raw_user_meta_data`의 닉네임만 있는 사용자). 이 앱은 이메일을 식별에 쓰지 않으므로(사용자 id 기준) 이메일이 없어도 기능상 문제는 없다. 표시 이름은 닉네임을 쓴다(docs/03 `display_name`).
- 검수 — Kakao 로그인은 기본 동의 항목(닉네임·프로필 사진)만 쓰면 별도 검수 없이 동작하는 것으로 알려져 있으나, 스토어 출시 전 Kakao Developers의 현행 정책을 확인한다.

## 4. 앱 구조와 라이브러리 (1단계)

| 영역 | 선택 | 이유 |
|---|---|---|
| 언어·런타임 | TypeScript, Expo SDK 57 이상(FluencC 검증 계열), dev client | 네이티브 로그인 모듈 때문에 Expo Go 불가 |
| 패키지 매니저 | npm | pnpm·yarn 없음. 기존 Expo 프로젝트와 통일 |
| 라우팅 | Expo Router | 인증 여부에 따른 그룹 라우팅(`(auth)`/`(app)`). 2단계 청첩장 딥링크 대비 |
| 데이터 | supabase-js + TanStack Query(`persistQueryClient`로 AsyncStorage 영속화), 키 규칙 `[domain, action, { ledgerId, ... }]` | 장부별 캐시 분리. 전역 상태는 "현재 장부 id" 하나뿐이며 AsyncStorage + React Context로 충분 |
| 리포지토리 | 모든 조회·쓰기 함수가 `ledgerId`를 필수 인자로 받는다 | RLS는 "내 모든 장부"를 허용하므로 앱 필터가 빠지면 장부가 섞인다(docs/03 구현 필수 조건) |
| UI | React Native 기본 컴포넌트 + StyleSheet + 디자인 토큰 파일 1개 | 추가 UI 프레임워크 없이 시작 |
| 도메인 로직 | `src/domain/` 순수 함수(이름 정규화, 금액 파싱, 자동 제목, 통계 결과 접기, 초대 코드 입력 정규화) | `node --test`로 빌드 없이 단위 테스트 |
| 연락처 | expo-contacts, 권한 선택 | 이름·전화만 채운다 |
| 알림 | 1단계 없음(P2) | |
| 파일 | expo-file-system + expo-sharing | JSON 내보내기(P1), 초대 코드 공유 시트 |

리포지토리는 **단일 앱 + `supabase/` 디렉터리**로 시작한다. 2단계에서 웹(Next.js)이 추가될 때 npm workspaces 모노레포로 재편한다.

## 5. 빌드·배포·운영

| 항목 | 선택 | 비고 |
|---|---|---|
| 개발 빌드 | `npx expo run:ios` / `run:android`(dev client) | `ANDROID_HOME` 설정 필요 |
| 스토어 빌드 | EAS Build | 무료 플랜 월 빌드 제한 확인 후 필요 시 로컬 빌드 |
| JS 업데이트 | EAS Update | |
| 백엔드 환경 | Supabase 프로젝트 1개(운영) + 로컬 `supabase start`(개발) | 마이그레이션은 로컬에서 만들어 `supabase db push`. `auth.users` 트리거는 로컬에서 먼저 검증 |
| 비밀값 | anon key와 URL만 앱에 포함. service role은 Edge Function 환경변수에만 | |
| 외부 콘솔 | Apple Developer(App ID + Services ID, Team ID·Key ID·.p8 키), Google Cloud(OAuth 클라이언트 웹·iOS·Android) | 두 콘솔 모두 Supabase 콜백 `https://<ref>.supabase.co/auth/v1/callback` 등록 |
| iOS 배포 | TestFlight → App Store | 계정 삭제 기능 심사 항목 |
| Android 배포 | 내부 테스트 → 클로즈드 테스트 → 프로덕션 | 클로즈드 테스트 요건 현행 수치 확인 |
| 개인정보 처리방침 | 필수. 서버 보관·리전·수집 항목·소셜 로그인 3종에서 받는 정보·장부 공유 범위·연락처 권한·계정 삭제 절차 | |
| 비용 | Supabase Pro(월 $25 수준, 현행 확인) + Apple $99/년 + Play 일회 등록비 | 무료 플랜의 일시정지는 스토어 앱에 부적합 |

## 6. 명시적으로 하지 않는 것 (1단계)

- 로컬 DB·오프라인 쓰기 큐·동기화 엔진·충돌 해결·실시간 구독. 오프라인은 읽기 캐시만.
- 별도 API 서버·ORM.
- 익명 시작·전화번호 인증·소셜 계정 연결(같은 사람이 메일과 Apple로 각각 가입하면 별개 계정이 된다).
- 장부 만들기·장부 합치기·장부 삭제 UI. 장부는 첫 로그인 시 자동 생성되고 마지막 구성원의 계정 삭제로만 사라진다.
- 초대 딥링크·전화번호 매칭 초대. 초대는 코드 입력만.
- JSON 가져오기. 내보내기만 P1.
- 모노레포, 디자인 시스템 패키지, 전역 상태 라이브러리.

## 7. 결정 현황

| 항목 | 상태 |
|---|---|
| 프레임워크 | **확정** — Expo |
| 저장 방식 | **확정** — 클라우드 |
| 출시 플랫폼 | **확정** — iOS·Android 동시 |
| 백엔드 | **확정** — Supabase |
| 공동 장부 | **확정** — 1단계 포함, 소유 축 `ledger_id` |
| 로그인 수단 | **확정** — Apple + Google + 메일·비밀번호 (2026-09-24 변경. Kakao 제외) |
| 첫 실행 | **확정** — 로그인 먼저 |
| 앱 잠금 등 | 사용자 확인 질문 4~10번 (docs/02 §8.2) |
