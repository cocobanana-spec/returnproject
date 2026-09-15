# 뿌린대로거두리라 — 기술 스택 비교와 확정안

> 작성일 2026-09-14 · 작성 cto-orchestrator · **2026-09-15 사용자 결정 반영** — 프레임워크 Expo(확정), 저장 방식 클라우드(확정, 추천안과 다름), 출시 플랫폼 iOS·Android 동시(확정).
> 판단 근거는 2026-09-14 로컬 실측 결과(context-notes.md "기술 환경 발견")에 기반한다.

## 0. 판단의 전제

- 1인 개발이며 iOS와 Android를 동시에 출시한다(확정).
- 1단계부터 서버가 데이터의 원본(SoT)이다. 기기 변경·분실 시 로그인만으로 복원되어야 한다(클라우드 선택의 직접 효과).
- 2단계 청첩장은 공개 웹 페이지와 하객 회신이 필요하다. 1단계 백엔드가 그대로 2단계를 받아야 한다.
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

**사용자 결정 — A. React Native + Expo(TypeScript).** 이미 두 프로젝트에서 검증했고 툴체인이 준비돼 있으며, 2단계 웹과 타입을 공유하는 유일한 경로다.

## 2. 백엔드·DB — 클라우드 전제에서의 후보 비교

사용자가 저장 방식을 클라우드로 확정했다. 로컬 우선 대 클라우드의 비교는 끝났으므로, 여기서는 **어느 클라우드 백엔드인가**만 다룬다.

| 기준 | 1. Supabase (Postgres + Auth + RLS) | 2. Firebase (Firestore + Auth) | 3. 자체 API(Next.js Route Handlers) + Postgres |
|---|---|---|---|
| 사용자 경험 | **3개 프로젝트**(coco-finance, scentilique, 321go). RLS·Edge Function·Auth까지 실전 | 없음 | Next.js는 익숙하나 API 계층을 새로 써야 함 |
| 장부 집계(사람별 수지, 연도별·그룹별 합계) | SQL 뷰·함수로 서버에서 계산. 조인·GROUP BY 자유 | NoSQL이라 집계를 클라이언트나 Cloud Function으로. 조인 없음 | SQL 자유. 단 API 코드가 필요 |
| 사용자별 격리 | RLS 정책으로 DB 계층에서 강제. API 코드 없음 | Security Rules로 가능 | API 코드마다 직접 검사 |
| 인증 | Apple·Google·**Kakao** 내장 프로바이더, 익명 로그인, 계정 연결 | Apple·Google 내장, Kakao는 커스텀 토큰 | 직접 구현하거나 Auth.js 등 추가 |
| 2단계 청첩장(공개 페이지 + 익명 회신) | 같은 프로젝트에 테이블 추가 + `anon` 정책. Next.js 웹이 같은 클라이언트로 접근 | 가능 | 가능하나 API 확장 필요 |
| 운영 | 관리형. 무료 플랜은 **비활성 1주 후 일시정지**되므로 스토어 출시 시 Pro 플랜 필요(현행 조건 확인). 서울 리전 선택 가능 | 관리형. 무료 티어 넉넉하나 읽기 과금 모델이 집계 화면에 불리 | Vercel + 관리형 Postgres 두 곳 운영 |
| 잠금(lock-in) | 표준 Postgres라 이전 용이 | Firestore 종속 | 없음 |

**CTO 추천 — 1. Supabase.** 근거는 세 가지다.
1. 사용자가 가장 깊게 아는 백엔드다. RLS와 Edge Function까지 이미 운영해 봤으므로 착수 비용이 0에 가깝다.
2. 이 앱의 핵심 화면은 집계(사람별 수지, 연도별 합계)다. 관계형 DB와 SQL 뷰가 가장 자연스럽고, Firestore는 이 지점에서 불리하다.
3. 2단계 청첩장(공개 페이지·익명 회신·계좌 안내)이 같은 프로젝트에 테이블 3개와 `anon` 정책을 더하는 것으로 끝난다.

### 저장 계층 세부
- 앱은 **supabase-js**로 테이블·뷰·RPC를 직접 호출한다. 별도 API 서버·ORM은 없다.
- 스키마는 **Supabase CLI 마이그레이션 SQL**(`supabase/migrations/*.sql`)로 관리하고, 타입은 `supabase gen types typescript`로 생성한다. 손으로 쓴 타입을 두지 않는다(scentilique에서 hand-written 타입 교체 작업이 남았던 전례).
- 집계는 뷰 1개(`person_balances`)와 RPC 함수 3개(`event_summary`, `stats_by_year`, 삭제·병합)로 서버에 둔다. 상세는 docs/03.
- 로컬 DB는 두지 않는다. 오프라인은 TanStack Query 캐시 영속화로 읽기만 지원한다(docs/03 §7).
- 리전은 서울(ap-northeast-2). 개인정보 처리방침에 "서버 보관(Supabase, 서울 리전)"과 계정 삭제 시 즉시 삭제를 명시한다.

## 3. 인증 (1단계 필수)

| 항목 | 선택 | 비고 |
|---|---|---|
| 프로바이더 | **Apple + Google**(기본), Kakao는 사용자 확인 질문 12번 | iOS에서 소셜 로그인을 하나라도 넣으면 Apple 로그인이 의무다. Kakao는 Supabase 내장 프로바이더라 추가 비용이 작지만 Kakao 개발자 앱 등록·심사가 별도로 든다 |
| 구현 | Apple은 `expo-apple-authentication` → `signInWithIdToken`, Google은 `@react-native-google-signin/google-signin` → `signInWithIdToken` | 둘 다 네이티브 모듈이라 **Expo Go로는 실행 불가, dev client 빌드 필수** |
| 세션 저장 | supabase-js 기본(AsyncStorage) | 토큰 자체를 SecureStore에 두려면 커스텀 storage 어댑터로 교체 가능. 1단계는 기본값 |
| 첫 실행 | 로그인 화면이 먼저 뜬다(기본 가정). 익명 시작 후 계정 연결은 사용자 확인 질문 13번 | 익명 시작은 온보딩 마찰을 줄이지만, 계정을 연결하기 전에 앱을 지우면 데이터가 사라져 클라우드를 고른 목적과 충돌한다 |
| 계정 삭제 | 설정 → 계정 삭제. Edge Function `delete-account` 1개가 service role로 사용자를 지우고 데이터는 FK CASCADE | App Store 필수 요건(계정 생성이 있는 앱). 클라우드 선택으로 새로 생긴 필수 기능 |
| 앱 잠금(생체 인증) | 사용자 확인 질문 4번. 기본 가정은 첫 출시 제외 | expo-local-authentication |

## 4. 앱 구조와 라이브러리 (1단계)

| 영역 | 선택 | 이유 |
|---|---|---|
| 언어·런타임 | TypeScript, Expo SDK 57 이상(FluencC 검증 계열), dev client | 네이티브 로그인 모듈 때문에 Expo Go 불가 |
| 패키지 매니저 | npm | pnpm·yarn 없음. 기존 Expo 프로젝트와 통일 |
| 라우팅 | Expo Router | 파일 기반, 딥링크(2단계 청첩장 링크 → 앱) 기본 지원. 인증 여부에 따른 그룹 라우팅(`(auth)`/`(app)`) |
| 데이터 | supabase-js + TanStack Query(`persistQueryClient`로 AsyncStorage 영속화), 키 규칙 `[domain, action, params]` | 사용자의 기존 규칙과 동일. 전역 상태 라이브러리는 필요 전까지 도입하지 않음 |
| UI | React Native 기본 컴포넌트 + StyleSheet + 디자인 토큰 파일 1개 | 추가 UI 프레임워크 없이 시작 |
| 도메인 로직 | `src/domain/` 순수 함수(이름 정규화, 금액 파싱, 자동 제목, 통계 결과 접기) | `node --test`로 빌드 없이 단위 테스트(Node 26 타입 스트리핑, scentilique 전례). 합계 계산은 서버 뷰가 하므로 클라이언트 도메인 함수는 줄어든다 |
| 연락처 | expo-contacts, 권한 선택 | 이름·전화만 채운다. 연락처 식별자는 저장하지 않는다 |
| 알림 | 1단계 없음(P2) | 로컬 알림도 첫 출시 제외(docs/02 §3.9) |
| 파일 | expo-file-system + expo-sharing | JSON 내보내기(P1) |

리포지토리는 **단일 앱 + `supabase/` 디렉터리**로 시작한다. 2단계에서 웹(Next.js)이 추가될 때 npm workspaces 모노레포(`apps/mobile`, `apps/web`, `packages/domain`)로 재편한다.

## 5. 빌드·배포·운영

| 항목 | 선택 | 비고 |
|---|---|---|
| 개발 빌드 | `npx expo run:ios` / `run:android`(dev client) | Xcode·Android SDK가 있어 EAS 없이 가능. `ANDROID_HOME` 설정 필요 |
| 스토어 빌드 | EAS Build | 무료 플랜 월 빌드 제한 확인 후 필요 시 로컬 빌드 |
| JS 업데이트 | EAS Update | 스토어 심사 없이 버그 수정 배포 |
| 백엔드 환경 | Supabase 프로젝트 1개(운영) + 로컬 `supabase start`(개발) | 마이그레이션은 로컬에서 만들어 `supabase db push` |
| 비밀값 | anon key와 URL만 앱에 포함(공개 가능, RLS가 보호). service role은 Edge Function 환경변수에만 | 앱 번들에 service role을 넣지 않는다 |
| iOS 배포 | TestFlight → App Store | Apple Developer 계정 보유(321go 출시 근거, 가정). 계정 삭제 기능 심사 항목 |
| Android 배포 | 내부 테스트 → 클로즈드 테스트 → 프로덕션 | 개인 개발자 신규 계정 클로즈드 테스트 요건(12명 이상·14일, 현행 수치 확인). 321go 계정이 있어 통과했을 가능성이 높다(가정) |
| 개인정보 처리방침 | 필수. 서버 보관·리전·수집 항목(이름·전화·금액)·연락처 권한·계정 삭제 절차 명시 | 로컬 저장 때보다 기재 항목이 늘어난다 |
| 비용 | Supabase Pro(월 $25 수준, 현행 확인) + Apple $99/년 + Play 일회 등록비 | 무료 플랜의 일시정지는 스토어 앱에 부적합 |

## 6. 명시적으로 하지 않는 것 (1단계)

- 로컬 DB·오프라인 쓰기 큐·동기화 엔진·충돌 해결·실시간 구독. 오프라인은 읽기 캐시만.
- 별도 API 서버·ORM. supabase-js가 테이블·뷰·RPC를 직접 호출한다.
- 가족 공동 장부(소유 축 확장). 사용자 확인 질문 11번의 답에 따라 착수 전에만 재검토.
- JSON 가져오기. 내보내기만 P1.
- 모노레포, 디자인 시스템 패키지, 전역 상태 라이브러리.
- Flutter·KMP 재검토.

## 7. 결정 현황

| 항목 | 상태 |
|---|---|
| 프레임워크 | **확정** — Expo |
| 저장 방식 | **확정** — 클라우드 |
| 출시 플랫폼 | **확정** — iOS·Android 동시 |
| 백엔드 | CTO 추천 Supabase(사용자 확인 대기, docs/02 §8 14번) |
| 로그인 수단·첫 실행 방식·공동 장부 필요 여부 | 사용자 확인 질문 11~13번 |
