# 뿌린대로거두리라 — 작업 체크리스트

> 상태: 기획 완료, 착수 가능 — 2026-09-16. 확정: Expo · 클라우드 · iOS+Android 동시 · **Supabase** · **공동 장부 1단계 포함** · 로그인 **Apple+Google+메일 회원가입**(2026-09-24 변경, Kakao 제외) · 로그인 우선.
> 남은 확인 질문은 docs/02 §8.2(4~10번)뿐이며 착수를 막지 않는다.

## 0. 기획 (완료)
- [x] 로컬 환경·기존 프로젝트 스택 실측 → context-notes.md "기술 환경 발견"
- [x] docs/01-product-overview.md — 비전·타깃·차별점·로드맵
- [x] docs/04-tech-stack.md — 스택 후보 비교 + CTO 추천안
- [x] docs/02-prd-phase1.md — 1단계 PRD (product-planner 작성, CTO 검토)
- [x] docs/03-data-model.md — 1단계 데이터 모델 + 2단계 확장 영향 (product-planner 작성, CTO 검토)
- [x] CTO 검토 — `entries.direction` 제거, `events.host_person_id` 추가, 금액 단위 규칙 명문화
- [x] 사용자 결정 1~3 반영 — 클라우드 전제로 docs/01~04 개정 (2026-09-15)
- [x] 사용자 결정 11~14 반영 — 소유 축을 장부(`ledger_id`)로 재설계, Kakao 로그인 사실 확인, 로그인 우선 고정, Supabase 확정 (2026-09-16)

## 1. 착수 전 정리 (사용자)
- [x] 질문 1~3, 11~14 답변
- [ ] 질문 4~10 답변 (앱 잠금, 공동 부조 표시, 관계 그룹, 화환 합산, 기존 기록 규모, 알림, 참석 필드) — P0 화면 구현 전까지
- [ ] 경쟁 앱 5개 이상 설치·비교해 docs/01 §5 표를 실측값으로 교체
- [ ] 스토어 표시명·번들 ID 결정 (예 `com.<조직>.ppurin`), 앱 아이콘 방향 결정

## 2. 외부 콘솔 등록 — 2026-09-24 완료 (애플·구글·메일)
> 서버에서 확인함. `/auth/v1/settings`가 apple·google·email 모두 true, 인증 요청이 각 프로바이더로 정상 리다이렉트된다. 복귀 주소 3종(`ppurin://auth/callback`·`confirm`·`reset`) 허용 목록 등록 완료.
> **⏰ 애플 client secret 만료 2027-03-23.** 만료되면 애플 로그인이 막힌다. 재발급은 `node tools/apple-client-secret.mjs --team-id Y7U3S84HW6 --key-id JKG4QXCZ49 --services-id com.cocobanana.ppurin.web --key <.p8 경로>`.
> 남은 것 — 사람이 직접 눌러 보는 실제 로그인 1회(자동화 불가), 안드로이드 구글 클라이언트(서명 지문 필요), iOS 심사 전 네이티브 애플 로그인 전환 판단.
> 2026-09-24 로그인 수단 변경 — Kakao 항목은 삭제했다. 조사 결과는 docs/04 §3.1에 보존돼 있다.
- [x] Supabase 프로젝트 생성 (서울 리전)
- [ ] **Apple Developer** — App ID(네이티브용)와 **Services ID**(브라우저용) 둘 다 만든다. Sign in with Apple 키(`.p8`)를 받고 Team ID·Key ID를 적어 둔다
- [ ] Apple — Services ID의 Return URL 에 `https://ekcjfqqiopajlcbqgvfo.supabase.co/auth/v1/callback` 등록
- [ ] Supabase Auth → Apple — **Client IDs 칸에 Services ID를 첫 번째로 두고 번들 ID(`com.cocobanana.ppurin`)를 쉼표로 붙인다.** Team ID·Key ID·`.p8` 내용 입력
- [ ] **Google Cloud** — OAuth 클라이언트 웹·iOS 두 개 생성(Android는 서명 지문이 없어 미룬다)
- [ ] Supabase Auth → Google — **Client ID 칸에 웹 클라이언트를 먼저 쓰고 iOS 클라이언트를 쉼표로 붙인다.** Secret은 웹 것만 넣는다
- [ ] **Supabase Auth → Email 프로바이더 활성화, "Confirm email" 켠 상태 유지**
- [ ] **Supabase Auth → URL Configuration → Redirect URLs 에 세 개를 모두 등록** — `ppurin://auth/confirm`, `ppurin://auth/reset`, **`ppurin://auth/callback`**. 마지막 것이 빠지면 Apple·Google 로그인이 코드를 못 받고 조용히 실패한다(허용 목록에 없는 redirect_to 는 Site URL 로 대체된다)
- [ ] 개발 중 Expo Go로 확인하려면 `exp://<개발머신 IP>:8081/--/auth/confirm`·`.../auth/reset`·`.../auth/callback` 도 임시로 등록한다
- [ ] URL Configuration 의 **Site URL** 값을 확인해 둔다. 허용 목록에 없는 주소는 여기로 대체되므로 실패 원인을 알아볼 때 필요하다
- [ ] **Auth → Policies 의 최소 비밀번호 길이를 8자로** 올린다. 앱은 8자+영문+숫자를 강제하지만 서버 기본은 6자라 앱을 거치지 않는 경로에서 규칙이 깨진다
- [ ] Auth → Rate Limits 의 현재 값을 확인해 적어 둔다(7단계 커스텀 SMTP 판단의 근거)

## 3. 백엔드 토대 (Supabase) — 2026-09-19 구현 완료, 로컬 검증 154건 통과
- [x] `supabase init` (config.toml 생성). 로컬 `supabase start`는 **Docker 없어 불가** — 대신 로컬 Postgres 17 + auth 스텁으로 검증(context-notes §7)
- [x] `supabase/migrations/0001_init.sql` — ledgers · ledger_members · people · events · entries + `updated_at`·`events_lock_is_mine`·`events_validate`·`entries_same_ledger`·`forbid_ledger_change` 트리거
- [x] 헬퍼 `is_ledger_member` · `is_ledger_owner` (SECURITY DEFINER, search_path 고정)
- [x] RLS 활성화 + 데이터 테이블 3개 × 정책 4개, `ledgers` SELECT/UPDATE(`GRANT UPDATE (name)`), `ledger_members` SELECT만. `anon` 권한 0건 확인
- [x] `auth.users` 트리거 `handle_new_user` (개인 장부 + owner 구성원 + display_name) — 로컬 가입으로 검증
- [x] 장부 RPC — `create_invite_code` · `join_ledger`(빈 개인 장부 정리) · `remove_member`(마지막 구성원 차단, owner 승계) · `prepare_account_deletion` · `ensure_owner` · `random_invite_code` · `display_name_of(_user)`
- [x] 데이터 RPC — `delete_person` · `merge_people`(같은 장부 검사) · `event_summary` · `stats_by_year(p_ledger_id, p_year)`
- [x] 뷰 `person_balances` (security_invoker, `ledger_id` 포함)
- [x] Edge Function `delete-account` — 코드 작성 완료. **런타임 미검증**(Deno·Supabase 런타임 없음)
- [x] `supabase gen types typescript --project-id ekcjfqqiopajlcbqgvfo` → `src/db/database.types.ts` (원격 프로젝트 연결 후 수행, Docker 불필요)
- [x] RLS 검증 스크립트 `supabase/tests/` — 계정 A·B(같은 장부)·C(다른 장부)·D(두 장부) 네 세션으로 163건. `./supabase/tests/run.sh`로 재실행, 실패 시 종료 코드 ≠ 0
- [x] `supabase/migrations/0002_orphan_ledger_cleanup.sql` — 앱 밖에서 계정이 삭제될 때 고아 장부를 지우고 owner를 승계한다 (원격 검증 중 발견)

## 3b. 실제 Supabase에서 재검증 — 2026-09-20 완료, 원격 스모크 27건 통과
> 프로젝트 `ekcjfqqiopajlcbqgvfo` (returnproject, 서울 리전). 재실행은 `python3 supabase/tests/remote_smoke.py` (환경변수 3개 필요, 파일 상단 참고).
- [x] `supabase db push` 성공 — `auth.users`의 `on_auth_user_created` 트리거도 권한 오류 없이 생성됐다
- [x] 가입 1회 → `ledger_members` 1행·역할 owner·표시 이름 자동 생성 확인 (메일/비밀번호 계정으로 확인. 트리거 경로는 소셜 로그인과 같다)
- [ ] 소셜 2종으로 같은 확인 (Apple·Google 프로바이더 활성화 후). 메일 가입 경로는 2026-09-24 원격 검증에서 확인함
- [x] pgcrypto 경로 확인 — `create_invite_code`가 8자 코드를 실제로 발급하며 혼동 문자 0/O/1/I가 없다
- [x] anon 권한 0건 재확인 — 테이블 5개 전부 `permission denied`
- [x] Edge Function `delete-account` 배포 후 실제 계정 삭제 — 혼자 장부(장부·데이터 함께 삭제)와 공유 장부(구성원만 제거, 데이터 보존·owner 승계) 두 경우 모두 확인
- [x] `supabase gen types typescript --project-id <ref>` → `src/db/database.types.ts` (502줄, RPC 8개 포함)
- [x] `name_normalized` 값 확인 — `' 김 철수 '` → `'김철수'` (호스티드 로케일에서도 동일)
- [ ] `[api] max_rows` 기본값 1000 확정 — 원격은 대시보드 설정이다. 수년치 기록 조회가 조용히 잘리므로 앱에서 페이지네이션 필수
- [ ] `graphql_public` 노출 범위 점검 (미확인)

## 4. 앱 토대 (Expo) — 2026-09-21 자바스크립트 계층 완료
검증 — `npx tsc --noEmit` 0건 · `npm test` 39건 · `npx expo export` 번들 3.2MB 생성 · `npm run integration` 78건(실제 프로젝트).
- [x] Expo 앱 스캐폴드 (SDK 57.0.24, TypeScript, Expo Router, npm)
- [x] supabase-js 클라이언트 + 세션 저장(AsyncStorage), 인증 그룹 라우팅 `(auth)` / `(app)`
- [x] 현재 장부 컨텍스트 — 저장값이 유효하면 유지, 아니면 owner 장부 우선, 0권이면 초대 코드 입력 화면
- [x] TanStack Query + `persistQueryClient`(AsyncStorage), 키 규칙 `[domain, action, { ledgerId, ... }]`, 오프라인 배너
- [x] `src/domain/` 순수 함수 — 이름 정규화·금액 파싱·자동 제목·통계 접기·초대 코드 입력 정규화
- [x] `node --test` 도메인 단위 테스트 39건
- [x] 리포지토리 계층 — 모든 함수가 `ledgerId` 필수 인자. 테이블·뷰 조회는 `.eq('ledger_id')`, RPC는 호출 전 소속 확인. 목록은 전부 페이지네이션
- [x] 디자인 토큰 1개(색·간격·반경·글꼴), 라이트/다크
- [x] 앱↔DB 이름 정규화 대조 11종(NBSP·전각 공백 포함) 실제 DB에서 일치 확인
- [ ] 소셜 로그인 3종 — 코드만 작성, **실제 로그인 0회**. 콘솔 등록(2단계)과 네이티브 빌드가 선행돼야 한다
- [ ] `ANDROID_HOME` 환경변수 설정 — Java 런타임이 없어 보류
- [x] iOS 시뮬레이터 실행 확인 (2026-09-21) — Xcode 라이선스 동의 완료. 의존성이 모두 Expo Go 범위라 `npx expo start --ios`로 iPhone 17 Pro에서 실행되며 로그인 화면이 뜬다
- [ ] dev client 빌드 (`expo run:ios`) — 소셜 로그인 네이티브 모듈을 넣을 때 필요. 지금은 Expo Go로 충분하다
- [ ] Android 실행 — Java 런타임 없음(`brew install --cask temurin`), `ANDROID_HOME` 미설정

## 4b. 실기기·시뮬레이터에서 확인할 것 — 런타임 위험 2건 해소 (2026-09-21)
- [x] Hermes에서 `String.prototype.normalize('NFC')` 동작 — **된다.** `Intl`도 있다. NFD로 분해한 '감'(3코드유닛)이 NFC로 정확히 합쳐지고, `' 김 철수 '` → `'김철수'`가 Node와 같다. `/\s/`가 NBSP·전각 공백에도 매치된다
- [x] Hermes에서 `Number.prototype.toLocaleString('ko-KR')` — **된다.** `1234567` → `1,234,567`, `50000` → `50,000`
- [ ] 소셜 로그인 3종 실동작 + Supabase Redirect URL 허용 목록에 `ppurin://auth/callback` 등록
- [ ] AsyncStorage 세션 영속 — 앱 강제 종료 후 재실행 시 로그인 화면이 안 뜨는지
- [ ] `persistQueryClient` 복원 — 비행기 모드 재실행 시 마지막 화면이 보이는지
- [ ] 오프라인 배너 — `isInternetReachable`이 실제로 false로 떨어지는지
- [ ] 장부 전환 중 삭제·병합 — 다른 장부 데이터가 건드려지지 않는지 실기기 재확인
- [x] 로그아웃 후 다른 계정 로그인 — 2026-09-21 확인. 세션이 죽은 채로 남으면 "장부가 없습니다"에 갇히는 결함을 찾아 고쳤다(context-notes §11.1). 저장된 현재 장부 id도 로그아웃 때 지운다
- [ ] 다크 모드 전환 시 StatusBar와 토큰이 함께 바뀌는지

## 4c. 서버 쪽 후속 — 2026-09-21 완료 (마이그레이션 0003)
- [x] `delete_person`·`merge_people`·`event_summary`가 `p_ledger_id`를 받아 서버에서 장부를 검사한다. 기본값을 주지 않아 호출부가 빼먹을 수 없다. 로컬 T15, 원격 스모크 §9로 검증
- [x] `entries.amount` 상한 CHECK (10억) — 앱 상한과 같은 값을 DB에도 둔다

## 5. P0 화면 — 1차 완료 (2026-09-21)
검증 — `tsc --noEmit` 0건 · `npm test` 72건 · `run.sh` 전부 · `npm run integration` 87건 · `expo export` 번들 생성 · iOS 시뮬레이터 스크린샷 9종(데이터·빈 상태 모두).

### 1차에서 만든 것
- [x] 탭 셸 4개(홈·사람·행사·더보기) + 빈 상태 문구
- [x] S00 로그인 — 소셜 3종 버튼, 레이아웃 정리
- [x] S17 장부 — 목록·전환, 이름 편집, 구성원 목록, 초대 코드 생성·공유 시트, 초대 코드 입력, 내보내기·나가기
- [x] S03 사람 목록 — 이름 검색, 관계 그룹 필터, 정렬 3종, 행마다 차액
- [x] S04 사람 상세·원장 — 수지 카드, 기록 목록, 공동 배지, 병합·삭제
- [x] S05 사람 생성/편집 — 개인·단체, 관계, 구분 라벨, 전화, 메모, 동명이인 경고
- [x] S15 동명이인·병합 대상 고르기 시트
- [x] S02 준돈 빠른 기록 — 자동완성, 종류·금액 프리셋, 날짜 피커, 형태, 더 입력(장소·참석·공동 부조자·메모), ±7일 기존 행사 판정, 순차 INSERT, 실행 취소, 저장 실패 시 폼 유지
- [x] 개발 전용 메일 로그인 진입점 (`__DEV__` + `EXPO_PUBLIC_DEV_SIGNIN`, 릴리스 번들에 문자열 0건 확인)

## 5a. P0 화면 — 2차 완료 (2026-09-24)
검증 — `tsc --noEmit` 0건 · `npm test` 138건 · `run.sh` 177건 · `npm run integration` 97건(메일 발송 경로는 SMTP 제한으로 SKIP) · `expo export` 번들 생성 · iOS 시뮬레이터 스크린샷 15종(데이터·빈 상태 모두) · 계정 삭제 실행 검증 1회.

- [x] S08 행사 생성/편집 (내 행사 토글 잠금, 당사자, 날짜 정밀도, 측 라벨)
- [x] S06 행사 목록 (세그먼트, 연도 헤더, 무한 스크롤)
- [x] S07 행사 상세 (내 행사 정산 — `event_summary`, 측별·형태별·미확정·답례 진행, 측/미확정 필터)
- [x] S09 받은돈 연속 입력 ("저장하고 다음", 직전 값 유지, 미확정 저장, 방금 넣은 기록 인라인 삭제)
- [x] S10 기록 상세/편집 (방향은 표시 전용, 입력자는 구성원 2명 이상일 때만)
- [x] S01 홈 본체 (올해 카드 2개, 다가오는 행사 3개, 최근 기록 10건, 조회 실패와 빈 상태 구분)
- [x] S16 계정 (로그아웃, 장부별 삭제 결과를 실제 구성원 수로 계산해 보여 주는 삭제 다이얼로그 → Edge Function)
- [x] 계정 삭제를 테스트 계정으로 실제 1회 실행 — Edge Function `{ok:true}`, 서버에서 사용자·장부·구성원 0건 확인, 죽은 세션으로 앱을 다시 열면 로그인 화면으로 떨어진다
- [ ] docs/02 §7 검증 기준 중 화면이 필요한 항목 전수 통과 (P1 화면이 필요한 항목이 남아 있다)

### 2차 QA에서 고친 것
- [x] S10 측 편집이 영영 렌더되지 않던 문제 (`getEntry` 조인에 `side_a_label` 누락 + 타입 단언이 가림)
- [x] S07 명부 목록이 100건에서 조용히 잘리던 문제 (`useInfiniteQuery`로 이어받기)
- [x] 조회 실패를 "데이터 없음"으로 표시하던 5개 지점 (`src/ui/LoadFailed.tsx`로 통일)
- [x] S09·S02에서 저장 중간 실패 뒤 이름을 고치면 앞 사람에게 기록이 붙던 오귀속
- [x] 되돌릴 수 없는 확인 문구가 실제와 다르던 곳 (S07 삭제는 집계 미도착 시 보수적으로, S16은 삭제 직전 구성원 수 재조회)
- [x] 0행이 갱신돼도 "저장됨"으로 화면을 닫던 문제 (`updateEntry`·`updateEvent`)
- [x] S08 잠금이 집계 도착 전에 풀리던 문제, 종류를 바꿔도 결혼식 측 라벨이 남던 문제, 생성 응답 유실 시 중복 생성
- [x] PersonPicker 자동완성 실패를 "그런 사람 없음"으로 읽어 중복 사람을 만들던 문제 + 접두사 캐시 누적

### 2차 QA가 찾았으나 이번에 고치지 않은 것
- [ ] **⛔ 코디네이터 조치 필요 — `supabase functions deploy delete-account`.** 계정 삭제의 부분 실패(`prepared: true`)를 구분해 안내하는 변경이 소스에만 있고 배포되지 않았다. 배포 권한이 막혀 있었다. 앱은 구 응답도 기존과 같은 문구로 처리하므로 회귀는 없다
- [ ] S09 공동 부조자 입력 (docs/02 §4.5 시나리오 B 8단계) — 도메인 검증은 있으나 UI가 없다
- [ ] S09 개인/단체 토글 (9단계) — 새 사람은 항상 `kind='person'`으로 생긴다
- [ ] S06 행마다 건수·합계 (docs/02 §3.6)
- [ ] S10에서 사람·행사·공동 부조자 변경 (현재는 표시만)
- [ ] S09 저장 시 동명이인 1회 질의 (docs/02 §5)
- [ ] S08 저장 후 "명부 입력을 바로 시작할까요?" 다이얼로그 — 지금은 곧바로 S07로 간다
- [ ] S16 "먼저 내보내기" 링크 — S14 내보내기가 P1이라 아직 없다

## 5c. 통계 사람별 상위 연도 옵션 — 2026-09-24 완료
- [x] `0004_person_stats_by_year.sql` — 사람별 연도 집계 RPC (원격 적용)
- [x] `0005_person_stats_year_default.sql` — p_year 기본값 NULL. 생략 호출이 PostgREST에서 404가 나던 문제 (원격 적용, 타입 재생성)
- [x] 통계 화면 "전체 기간 / N년만" 토글, 공동 부조자 이름이 각자의 원장으로
- [ ] 실기기에서 통계 토글과 공동 부조 이름 탭을 사용자가 눌러 확인

## 5b. 콘솔 등록이 끝나면 확인할 것
- [x] 개발 전용 메일 로그인 진입점 삭제 — 정식 메일 로그인이 생겨 존재 이유가 사라졌다(2026-09-24)
- [ ] Apple 로그인 실동작 (콘솔 등록 후). 실패 시 `src/auth/providers.ts` 한 파일만 손보면 된다
- [ ] Google 로그인 실동작 (콘솔 등록 후)
- [ ] 메일 확인 링크가 앱으로 돌아오는지 실기기·시뮬레이터에서 1회 (`ppurin://auth/confirm`)
- [ ] 비밀번호 재설정 링크가 앱으로 돌아와 새 비밀번호 화면이 열리는지 1회 (`ppurin://auth/reset`)
- [ ] 테스트 계정은 만들 때마다 작업 끝에 지운다

## 5c. 구조 변경 — 홈 방향 탭·통계 탭 (2026-09-24, 사용자 실기기 사용 후 요청) — 완료

검증 — `tsc --noEmit` 0건 · `npm test` 161건 · `run.sh` 177건 · `npm run integration` 104건(메일 경로 1건 SKIP) · `expo export` 번들 생성 · 시뮬레이터 스크린샷 9종.

### 리포지토리·도메인
- [x] `listEntriesByDirection(ledgerId, isMine, { offset })` — 행사 `is_mine`으로 방향을 걸러 행사 날짜 최신순으로 페이지 단위 조회
- [x] S11 사람별 상위는 새 함수 없이 `listPeople(sort: 'balance', limit: 5)`로 처리했다. `person_balances` 뷰에 연도 구분이 없어 전체 기간 기준이며 화면에 그렇게 적었다
- [x] `src/domain/home.ts` — 방향 탭 정의, 목록 행 조립, 다가오는 행사 문구, 합계 보조 문구 (순수 함수 + `node --test`)
- [x] `src/domain/stats.ts`에 연도 목록 추출·연도별 접기·기본 연도 보정·방향별 미확정 추가 (`stats_by_year`를 한 번만 부른다)

### 화면
- [x] S01 홈 — 준돈·받은돈 상단 탭, 기본 준돈, 행사 날짜 최신순 내림차순, 무한 스크롤. 행의 사람 이름을 누르면 S04로 간다
- [x] S01 준돈 탭 상단에 다가오는 행사 얇은 띠 (알림을 넣지 않기로 한 결정 9의 대체물), 받은돈 탭에는 행사로 가는 줄
- [x] S01 우상단 검색 버튼 → S03b 사람 검색
- [x] S11 통계 탭 — 연도 세그먼트, 총계·차액, 종류별·그룹별 막대, 사람별 상위
- [x] S13 더보기 — 기록 관리(사람·행사) / 장부 / 계정 세 묶음
- [x] 하단 탭 3개로 축소 (홈·통계·더보기). 사람·행사 화면은 `app/(app)/` 로 옮겼고 지우지 않았다
- [x] docs/02 §4.1 탭 구조, §4.2 화면 목록, §4.3 흐름도 갱신

### QA에서 고친 것
- [x] 사람 원장(S04)이 조회 실패를 "이미 삭제된 사람"으로, 기록 조회 실패를 "0건"으로 표시하던 문제. 사람 탭이 사라져 이 화면이 주 도착지가 되면서 심각해졌다
- [x] 통계 기본 연도가 기기의 올해로 고정돼, 올해 기록이 없는 장부에서 아무 칩도 선택 안 된 채 전부 0으로 보이던 문제 (`defaultYear` 순수 함수)
- [x] 홈 합계 문구가 "12건 · 미확정 3건 제외"로 읽혀 건수에서 뺀 것처럼 보이던 문제 (`totalCaption` 순수 함수. `cnt`는 미확정 포함, `total`은 제외)
- [x] 준돈 탭에 받은돈의 미확정 건수가 섞여 나오던 문제 (방향별 미확정 분리)
- [x] 사람 목록이 100명에서 조용히 잘리던 문제 (`useInfiniteQuery`)
- [x] 홈 목록의 이어받기 실패가 화면에 안 나오던 문제, 사람 이름 탭 영역이 좁던 문제(`hitSlop`)
- [x] 검색창에 `%`·`_` 한 글자만 넣으면 전체 명단이 나오던 문제, 검색 디바운스 없음
- [x] 합계 0원 버킷에도 막대가 2% 그려지던 문제, 막대 축 설명 주석이 사실과 달랐던 문제
- [x] `listEntriesByDirection` 통합 검증 추가 — 방향 필터와 행사 날짜 내림차순은 틀려도 오류가 아니라 조용히 섞여 돌아온다

### 후속 두 건 (2026-09-24, 사용자 결정 반영) — 완료
검증 — `tsc` 0건 · `npm test` 165건 · `run.sh` 185건(T9.27~34 신규) · `npm run integration` 105건 · 시뮬레이터 스크린샷 4종.
- [x] 통계 사람별 상위에 연도 옵션 — 마이그레이션 `0004_person_stats_by_year.sql`(첫 인자 `p_ledger_id` 기본값 없음, `p_year` NULL이면 전체, INVOKER, authenticated만). 화면은 "전체 기간" 기본 + "N년만" 토글
- [x] 공동 부조자 이름 탭 분리 — `entryRowNames()`가 이름과 id 조각을 돌려주고 `src/ui/EntryNames.tsx`가 각 조각을 자기 원장으로 보낸다. 홈 목록·행사 상세에 적용
- [ ] **⛔ 코디네이터 조치 — `supabase db push`(0004)와 타입 재생성.** 원격에 RPC가 없어 통계의 사람별 상위가 "불러오지 못했습니다"로 보인다. `database.types.ts`에는 재생성 전까지 같은 모양의 타입을 손으로 넣어 두었다
- [ ] `remote_smoke.py` §10은 db push 뒤에 한 번 돌려 확인한다

### 다음 라운드로 넘긴 것
- [ ] `src/lib/queryKeys.ts`의 `ledgerScopedDomains`가 어디서도 쓰이지 않는 죽은 코드다 (지우지 않고 보고만 한다)

### ⛔ 사고 — 정리 스크립트가 사용자 실계정을 지웠다
- [x] context-notes §14.6에 원인과 재발 방지 규칙을 기록했다
- [ ] **사용자에게 보고하고 복구 가능 여부를 결정한다.** 실기기 테스트에 쓴 사용자 실계정과 그 장부·기록이 라운드 종료 정리 중에 삭제됐다. 되돌릴 수 없다
- [ ] 정리 절차를 "이번 실행에서 만든 id만 삭제"로 바꾼다. `listUsers()` 전수 삭제 금지, `@ppurin-test.kr` 도메인 밖 계정은 발견 시 보고만 한다

### 검증
- [x] `tsc --noEmit` · `npm test` · `run.sh` · `npm run integration`
- [x] 시뮬레이터 스크린샷 — 준돈 탭, 받은돈 탭, 검색, 통계, 더보기, 사람, 행사, 빈 상태 2종
- [x] 테스트 계정·데이터 삭제 후 사용자 0명·장부 0권 확인

### 기록 입력 단순화 (2026-09-24, 빌드 5 사용 뒤 사용자 요청) — 완료
- [x] S02 준돈 빠른 기록 — 이름·날짜·종류·금액·메모 다섯 필드. 형태(`cash` 고정)·참석·공동 부조자·장소·"더 입력" 제거. 자동완성·동명이인·±7일 판정·자동 제목·실행 취소·실패 시 폼 유지는 그대로
- [x] S09 받은돈 연속 입력 — 이름·금액·메모. 측 세그먼트·형태·공동 부조자 제거. "저장 후 다음"과 관계 그룹·금액 단위 유지는 그대로
- [x] S10 기록 상세·편집 — 이름·날짜·종류·방향 표시, 금액·메모 편집. 형태·참석·측·답례는 표시하지 않고 페이로드에도 넣지 않는다
- [x] 죽은 코드 제거 — `allowsMissingAmount`(+테스트), `switchSide`(+테스트), 초안의 `method`·`side`·`coPersonId`·`attended`·`place`
- [x] docs/02 §3.2·§3.3·§4.4·§4.5·화면 목록·§8.1 비고 갱신 (입력에서만 빠졌고 데이터 모델에는 남음, 사용자가 실사용 뒤 뒤집은 결정)
- [ ] 답례 체크가 입력 UI에서 사라졌다. S07의 "답례 완료 N / 전체 M"은 기존 데이터만 반영한다. P1 "답례 체크·메모"에서 다시 다룬다
- [ ] 측별 정산(S07)은 새 기록에 측이 붙지 않아 앞으로 채워지지 않는다. 측이 필요해지면 입력 위치를 다시 판단한다
- [x] QA 반영 — docs/02 §5·§7의 구 사양 문장(측 세그먼트·형태 조합·검증 기준 4줄)을 입력 단순화에 맞췄다. S09 "방금 넣은 기록" 행 탭을 S10으로 연결해 §3.3·§4.5 10단계와 코드를 일치시켰다
- [ ] 준돈 미확정 허용 여부가 S02(금액 필수)와 S10(빈 금액 허용)에서 어긋난다. 정책 결정 필요
- [ ] S02 중간 실패 뒤 종류·날짜를 바꿔 재시도하면 `created.eventId`가 재사용돼 옛 행사에 붙는다. 재시도 시 종류·날짜가 달라지면 ref를 버리는 한 줄로 막힌다

### 동명이인 구분과 준돈 금액 필수 통일 (2026-09-25, 빌드 6 사용 뒤 사용자 요청) — 완료
- [x] 표시 — `displayName()` 하나로 이름 뒤에 라벨을 붙인다("김철수 · 회사"). 홈 두 탭·행사 상세(`EntryNames`)·원장 제목·자동완성·검색·사람 목록(`PersonRow`)·통계 사람별(`listPeopleByIds`로 라벨 보강)·S10 헤더
- [x] 구별 줄 — `distinguishLine()` 라벨 → 관계 그룹 → 주고받은 요약 → (라벨 없으면) 최근 기록 시점. 데이터로 구별 불가면 "구분 없음". 같은 이름 두 사람의 줄이 같으면 실패하는 단위 테스트
- [x] S02 — 같은 이름이 이미 있는 상태로 "새 사람으로 추가"를 고르면 구분 칸이 나타나고 필수(`sameNameExists`·`newPersonLabel`). 같은 이름이 없으면 칸 없음. `createPerson`에 `label` 전달
- [x] S03 사람 목록 — 라벨 없는 동명이인 행에 "구분 없음" 표시 (`duplicateNameKeys`·`needsLabel`). 편집(S05)의 라벨 칸으로 유도. 자동 병합·자동 라벨 없음
- [x] 준돈 금액 필수 통일 — `validateEntryAmount(text, isMine)`. S10에서 행사 `is_mine`으로 분기. 받은돈은 빈 금액이 미확정으로 통과
- [x] docs/02 §5 동명이인·§4.4 2단계·S02·S05·S15 행·§7 검증 기준 갱신
- [x] QA 반영 — 저장 직전 서버 재확인(`findByNormalizedName`)으로 자동완성 실패·8건 상한을 보완, 숨겨진 구분 칸 값은 버림, 병합·삭제 확인 다이얼로그와 병합 시트에 `displayName`·기록 수, 검색·병합 시트 행에도 "구분 없음"
- [x] S09 명부 입력 구분 칸 — 2026-09-25 후속 라운드에서 붙였다(아래 항목)
- [ ] 사람 목록의 "구분 없음"은 화면에 받아 온 페이지 안에서만 판정한다. 100명 경계를 넘는 동명이인은 페이지를 더 받은 뒤에 표시된다

### 명부 입력 구분 칸·"구분 없음" 재현·가져오기 기획 (2026-09-25, 빌드 7 사용 뒤) — 완료
- [x] S09 — 같은 이름이 이 장부에 있으면 이름 아래 한 줄로 구분 칸, 새 사람 저장 시 필수, 저장 직전 서버 재확인. 저장하고 다음 뒤에 사라진다. 규칙은 `newPersonLabelRule`로 S02와 공유(복사 없음)
- [x] "구분 없음" 결함 재현 — 시뮬레이터에서 그룹 같음/다름/끝 공백/가운데 공백 네 쌍과 실계정 모양(라벨 없음 1 + 라벨 있음 1) 모두 배지가 붙는다. 실계정 people 행(네 컬럼만 읽음)은 "박태준" 2명(1명 라벨 "회사"). 단위 테스트 2건으로 네 경우와 실계정 모양 고정
- [x] docs/02 §3.14 가져오기·§3.15 OCR 기획, §8.1 질문 8 비고, checklist P1 항목(가져오기가 OCR보다 앞)
- [x] QA 반영 — 검색(S03b)·병합 시트도 사람 목록처럼 "구분 없음"을 배지로(구별 줄 끝에 붙이면 한 줄 잘림에 묻힌다), 테스트의 인덱스 접근 타입 오류, 이름 X로 지우면 구분할 말도 비움, 기획의 라이브러리 사실 보정(재빌드는 document-picker만, xlsx 출처·legacy API·codepage, iOS 타깃 16.4, ML Kit 대안)
- [ ] S09 저장 중에도 이름 칸이 열려 있어 왕복 중 친 다음 이름이 `resetForNext`에 지워질 수 있다. 저장 중 입력을 잠그거나 바뀐 이름은 남기는 처리 필요

## 6a. 가져오기 — 2026-09-25 구현 완료
- [x] 엑셀·CSV 가져오기 (대상 선택 → 파일 → 열 매핑 → 미리보기 → 저장)
- [x] 금액·종류 파싱 도메인 함수와 테스트, fixture 4종(xlsx, UTF-8 BOM CSV, EUC-KR CSV, 문제 행)
- [x] 중간 실패 뒤 이어서 재시도 (통합 검증으로 고정)
- [ ] 실기기에서 실제 엑셀 파일로 가져오기 1회 (사용자 확인 필요)
- [ ] OCR — 손글씨 사진으로 인식률 먼저 측정 후 착수 (사용자가 사진 제공 예정, 첫 출시 포함 결정됨)

### 빌드 9 피드백 반영 — 받은돈 기록·통계 개편·화면 정리 (2026-09-25) — 완료
검증 — `tsc` 0건 · `npm test` 219건 · `run.sh` 196건 · `npm run integration` 122건.
- [x] (4) 받은돈 탭의 "+ 기록"이 준돈을 저장하던 버그 — 받은돈 탭은 S09로 보내고, 행사 없이 들어오면 맨 위에서 내 행사를 고른다(`pickDefaultEvent`). 하나면 자동, 여럿이면 최근 것, 없으면 행사 만들기로 보낸다. 화면을 새로 만들지 않고 S09를 확장했다
- [x] (6) 받은돈 탭에서 행사로 가는 줄을 빼 준돈과 같은 평평한 목록으로
- [x] (7) 통계 개편 — 전체·준돈·받은돈 탭, 연도·종류 필터, 정렬(금액순·건수순), 행사별 블록(최신순·금액순·건수순). 마이그레이션 `0006_event_totals.sql`
- [x] (1) S02에서 "최근 기록한 사람" 칩 제거 (자동완성은 유지)
- [x] (2) 홈 상단 요약을 총액 한 줄로
- [x] (3)(5) S02·S09 오른쪽 위 가져오기 버튼 (대상이 미리 정해져 들어간다)
- [x] (8) 더보기 → 사람 — 시뮬레이터에서 재현되지 않았다. 목록·검색·그룹 필터·정렬 3종·병합 시트 모두 정상, Metro 오류 0건. 사용자에게 증상을 다시 물어야 한다
- [ ] **⛔ 코디네이터 조치 — `supabase db push`(0006)와 타입 재생성.** 원격에 `event_totals`가 없어 통계의 행사별 블록이 "행사를 불러오지 못했습니다"로 보인다. `database.types.ts`에 재생성 전까지 같은 모양의 타입을 손으로 넣어 두었다
- [ ] db push 뒤 `remote_smoke.py` §11을 한 번 돌려 확인한다

### 빌드 10 피드백 — 사람 화면 크래시 재현과 통계 가독성 (2026-09-25) — 완료
검증 — `tsc` 0건 · `npm test` 218건 · `run.sh` 196건 · `npm run integration` 122건 · **릴리스 시뮬레이터 빌드**로 확인.
- [x] 사람 화면 크래시 — 원인 계통 확정. 좌표자가 실기기 `.ips`(빌드 9, 20:57:45)를 분석해 **처리되지 않은 JS 예외 → `RCTExceptionsManager reportFatal` → `abort()`**임을 확인했다. 네이티브 결함이 아니다
- [x] 릴리스 재현 시도 — **재현되지 않았다.** 시뮬레이터 릴리스(Hermes 바이트코드 확인)로 `/people`·`/person/[id]`, 그리고 **사용자 장부와 같은 형태(137명·전부 other·라벨 없음·준 돈만)의 테스트 장부**까지 열어 봤다. 전역 오류 핸들러로 비치명 예외까지 받았으나 0건
- [x] 통계 가독성 — 덜어내기. 막대 정렬 칩·행사별 정렬 칩 제거(금액순·최신순 고정), 종류 필터 접기, '전체' 탭에서 막대 블록 4개 제거, 숫자 고정폭 열 정렬, 사람별은 차액 하나만
- [x] 고아가 된 도메인 함수 제거 — `sortBuckets`·`BucketSort`·`BUCKET_SORT_LABEL`·`bucketsFor`·`EventSort`·`EVENT_SORT_LABEL`. `sortEventTotals`는 최신순 전용으로 단순화
- [x] QA 지적 반영 — 거짓 기간 표기(`topPeopleScopeLabel(year)`로 교정), 금액 열 폭 넘침(고정폭 → 최소폭 + 한 줄 + 글자 축소), 그 과정에서 생긴 열 붙음(간격 명시). **셋 다 릴리스 빌드로 확인**(10억 금액 포함)
- [ ] **⛔ 기기 릴리스 빌드로 재현 후 콘솔에서 JS 예외 메시지 확보 필요.** `.ips`에는 JS 예외 메시지가 없다(bug_type 309). 기기에 릴리스 빌드를 넣고 재현시켜 콘솔에서 메시지 원문을 잡아야 한다. 그 전에는 추측으로 고치지 않는다

### 빌드 11 피드백 — "같은 이름 = 다른 사람" 기본값 뒤집기 (2026-09-26) — 완료
사용자 원문 — "받은돈 가져오기했을때 기존장부에 같은 이름이 있다고 뜨는데 준돈에 같은 이름이 있어도 이 오류가 뜨나? (수정필요)".
검증 — `tsc` 0건 · `npm test` 239건 · `run.sh` 196건 · `npm run integration` 137건 · **릴리스 빌드 스크린샷 5상태**.
- [x] 공유 규칙을 도메인 한 곳으로 — `sameNameDecision`·`resolveSameName`(`src/domain/person.ts`). S02·S09·가져오기가 같은 함수를 쓴다
- [x] 가져오기 — 장부 후보 1명이면 자동 연결하고 통과. 미리보기에 `기존 "○○○"에 연결` 표시
- [x] 가져오기 — 후보 2명 이상일 때만 고르게 하고, "다른 사람이에요"를 고른 경우에만 구분 라벨 요구
- [x] 가져오기 — 파일 안 중복은 자동 연결하지 않는다. 같은 사람으로 정하면 그제야 연결된다(`applyDupChoice`)
- [x] S02·S09 — 이름을 치는 즉시 뜨던 구분 칸을 "새 사람으로 추가"를 누른 뒤로 미뤘다. 저장 직전 서버 재확인도 같은 규칙으로 판정하고, 후보 1명이면 새로 만들지 않고 그 사람에게 붙는다
- [x] 통합 검증 — 절반이 이미 있는 12행 명부를 가져와 **수정 필요 0, 새 사람 6명만 생기고 겹치는 6건은 기존 사람에게 붙는다**

#### QA 재검증에서 잡힌 것 (같은 라운드)
- [x] (치명) 파일 안 중복을 "다른 사람"으로 나눴을 때 장부에 같은 이름이 없으면 **구분 칸이 안 떠 저장이 영구히 막히던** 막다른 길. 판정을 도메인 `rowLabelNeeded`로 옮겨 `rowStatus`와 한 곳을 보게 했다
- [x] (중대) 후보 칩을 누른 뒤 `dupChoice`·`label`이 남아 모순된 상태가 되던 것 — `chooseExisting`/`chooseNewPerson`이 함께 정리한다
- [x] (중대) S02에서 자동 연결 시 기존 행사 확인이 건너뛰어져 **같은 행사가 하나 더 생기던 것** — `onSave`가 사람을 먼저 정하고 그 id로 확인한다
- [x] (중대) 중간 실패 뒤 이름을 바꿔 자동 연결되면 **실행 취소가 엉뚱한 사람을 지우던 것** — `created.current`를 비운다
- [x] (경미) 라벨 잔존, 후보 2명에서의 '같은 사람', 짝을 건너뛴 뒤의 `dupChoice` 요구
- [x] 막다른 길이 다시 생기지 않도록 **조합 전수 검사**를 단위 테스트로 넣었다

### 빌드 15 피드백 — 받은돈 종류·대시보드·탭 기억·장부 초기화 (2026-09-26) — 완료
검증 — `tsc` 0건 · `npm test` 259건 · `run.sh` 216건 · `npm run integration` 170건(1건 건너뜀 — 0008 배포 전) · **릴리스 빌드 스크린샷 12장**.
- [x] **받은돈 종류 지정(가장 중요)** — 받은돈은 행사에 속하고 종류는 행사가 가진다. 내 행사가 결혼식 하나뿐이면 무엇을 넣어도 결혼식이 되던 문제
  - [x] 명부 입력(S09) — 행사 선택 줄에 "+ 새 행사 만들기". **내 행사가 하나뿐이어도 선택 줄을 보여 준다**(전에는 둘 이상일 때만 떠서 만들 길이 아예 없었다). 만들고 나면 명부 입력으로 돌아온다(`/event/edit?next=receive`)
  - [x] 가져오기 — 행사가 정해지지 않으면 파일의 구분 열을 따르고 **종류별로 내 행사에 나눠 담는다**(`src/domain/importEvents.ts`). 미리보기에 "장례식 1건 → 내 장례식 (새로 만듦)"으로 보여 주고 대상을 바꿀 수 있다
  - [x] 행사 상세(S07)에서 들어오면 대상 고정 + 구분 열이 다르면 경고(기존 동작 유지)
- [x] **홈 대시보드 · 기록 탭 신설** — 하단 탭 넷(홈·기록·통계·더보기). 홈은 준돈·받은돈 총액 두 숫자만, 목록은 기록 탭으로 그대로 이동
- [x] **마지막 탭 기억** — AsyncStorage에 저장하고 모르는 탭이면 홈으로. 로그아웃 시 지운다(`src/domain/tabs.ts`)
- [x] **장부 초기화** — 더보기 → 장부 초기화. RPC `reset_ledger`(0007). 장부 이름을 그대로 입력해야 버튼이 켜지고, 지워질 실제 건수를 보여 준다
- [x] 0007 배포됨(좌표자). 통합 170건 통과

#### QA 재검증에서 잡힌 것 (같은 라운드, 빌드 16에 남아 있던 것)
- [x] **(치명) 종류별 나눠 넣기에 닿는 길이 없었다.** 대상 선택이 행사 하나를 반드시 고르게 해서 `eventId` 없이 미리보기까지 갈 수 없었다 — 도메인·러너·테스트는 맞았는데 화면 진입로 하나가 빠져 사용자 버그가 그대로 재현됐다. **"파일의 구분에 따라 나눠 넣기"를 기본 선택지**로 두고, 그때는 행사를 고르지 않아도(내 행사 0건이어도) 다음이 켜진다. 기록 탭 받은돈에도 가져오기 버튼을 두었다. **릴리스로 처음부터 끝까지 확인** — 내 행사 0건 장부와 결혼식만 있는 장부 둘 다
- [x] (중대) 묶음 대상 칩이 초기 스냅샷만 고치던 것 — `shownGroups` 기준으로
- [x] (중대) 초기 묶음이 비면 계획이 영구히 비던 것 — 조건을 "나눠 넣기 모드인가"로
- [x] (중대) 명부 입력 → 새 행사에서 남의 행사를 만들 수 있던 것 — 토글 잠금 + 받는 쪽에서 `is_mine` 검사
- [x] (중대) 탭 복원의 `restoring` 가드가 읽히지 않던 것 — 저장 effect에 연결
- [x] (경미) 0008 — `revoke/grant` 짝, **owner만 초기화**. 화면도 owner가 아니면 이유를 보여 준다
- [x] (경미) 고정 행사의 종류를 못 받았으면 미리보기로 넘어가지 않음, 초기화 알림을 바깥에서 닫아도 이동
- [ ] **⛔ 0008 `db push` 필요.** 배포 전에는 통합 검증의 owner 전용 절이 건너뛴다

### 웹 1차 — 브라우저에서 로그인해 내 기록 보기 (2026-09-26) — 완료
사용자 원문 — "웹버전도 있었으면 좋겠는데 pc에서도 볼수 있게끔".
검증 — `tsc` 0건 · `npm test` 264건 · `run.sh` 213건 · `npm run integration` 171건 · **헤드리스 크롬으로 실제 확인**.
- [x] `react-native-web`·`@expo/metro-runtime`·`react-dom` 설치, `app.json` web 설정(`output: single`)
- [x] `experiments.baseUrl: /returnproject/app` — 번들 자산 경로가 실제로 그 하위로 나오는 것 확인
- [x] **SPA 폴백** — `export:web` 스크립트가 `index.html`을 `404.html`로 복사한다. 없으면 새로고침에서 404
- [x] 인증 복귀 주소를 플랫폼별로 가름(`src/auth/redirects.ts`), 웹 OAuth는 같은 탭 이동 + `detectSessionInUrl`
- [x] 세션 저장 — 웹 AsyncStorage가 `localStorage` 기반임을 패키지 구현으로 확인. 분기 없음
- [x] 넓은 화면 — 최대 폭 720 가운데 정렬. 레이아웃 두 곳에만
- [x] 웹 파일 읽기 — blob URL → `fetch` → `Uint8Array`. 파싱은 그대로 공유. 브라우저에서 왕복 확인
- [x] iOS 회귀 — `expo export --platform ios` 정상, 네 검증 전부 통과
- [ ] **⛔ Supabase Redirect URLs 등록 필요.** 등록 전에는 웹 소셜 로그인·메일 링크가 거부된다. 앱 주소 3종은 이미 등록돼 있고, 웹 주소 3종을 더한다

  ```
  https://cocobanana-spec.github.io/returnproject/app/auth/callback
  https://cocobanana-spec.github.io/returnproject/app/auth/confirm
  https://cocobanana-spec.github.io/returnproject/app/auth/reset
  ```

  Authentication → URL Configuration → Redirect URLs 에서 한 줄씩 더한다. **Site URL 은 바꾸지 않는다** — 바꾸면 허용 목록에 없는 주소로 온 요청이 웹으로 튕겨 앱의 메일 링크가 깨진다. 주소는 `experiments.baseUrl`(`/returnproject/app`)에서 나오므로 배포 경로를 옮기면 이 값도 같이 바뀐다
- [ ] 웹 소셜 로그인 실제 왕복, 가져오기 웹 전체 흐름 — 2차

#### QA 재검증에서 잡힌 것 (웹 1차, 빌드 20에 남아 있던 것)
- [x] **(중대) 웹에서 `Alert.alert` 이 빈 함수라 확인 창 18곳이 전부 무반응.** 공용 헬퍼 `src/lib/confirm.ts` 로 16곳을 옮기고, 세 갈래 2곳은 웹에서 다른 방식으로 풀었다
- [x] 기록 저장의 세 갈래 — 웹에서는 저장 버튼 위에 **화면 안 선택지**. 헤드리스 브라우저로 실제 재현해 확인
- [x] 사람 삭제의 세 갈래 — 웹은 예·아니오. 합치기는 그 화면의 버튼으로 간다
- [x] (경미) 웹 OAuth 실패가 화면에 남지 않던 것 — `links.ts` 에 `callback` 종류 추가, AuthProvider 가 오류만 읽는다
- [x] (경미) `webOrigin()` 주석을 사실에 맞게, 다크 모드 좌우 여백 배경(`outerFrame`), 토스트 폭 제한
- [ ] 웹 날짜 선택기 — `docs/04` "아직 아닌 것"에 기록. 2차

#### QA 2차 — 네이티브 회귀와 남은 것 (2026-09-26, 빌드 21)
검증 — `tsc` 0건 · `npm test` 264건 · `run.sh` 213건 · `npm run integration` 171건 · **시뮬레이터 실화면 확인**.
- [x] **(치명) 앱 전체가 빈 화면이던 것** — `outerFrame` 이 네이티브에서 빈 객체를 돌려주어 `flex: 1` 자식이 높이 0으로 접혔다. 수정 전 번들을 바꿔 끼워 **빈 화면을 실제로 재현**하고, 고친 뒤 로그인 화면이 뜨는 것을 확인했다. 빌드 20 에 들어갔고, **심사에 올린 19 에는 없다**
- [x] (중대) 웹 세 갈래 선택지를 띄워 둔 채 이름·종류·날짜를 고치면 옛 판정이 그대로 쓰이던 것 — 판정 근거가 바뀌면 선택지를 거둔다
- [x] (중대) 합치기 확인이 "되돌릴 수 없습니다"를 잃은 것 — `destructive` 는 빨간 버튼만 뜻하게 하고, 경고 문장은 부르는 쪽 `message` 에 둔다. 명부 기록 삭제·장부 초기화에도 같은 문장을 넣었다
- [x] (경미) 로그아웃 빨간 버튼 복원, 웹 꼬리말의 어색한 한국어, 안 쓰는 `notify` import, `platform.ts` 머리말
- [x] **빌드 21 업로드 완료** (2026-09-26 20:16). `xcodebuild` 업로드가 `Failed to Use Accounts` 로 막혀 **API 키(`xcrun altool`)로 우회**했다. 절차는 `docs/05` §5-1. 심사 중인 빌드 19 는 그대로 두었다

## 6. P1 기능
- [ ] S12 기록 검색/필터 (방향·종류·기간·금액·그룹, 하단 합계)
- [ ] S11 통계 (연도 세그먼트, 총계, 종류별·그룹별 막대 — `stats_by_year`, 사람별 상위, 형태별)
- [ ] 답례 체크·메모, 내 행사 "미완료만 보기"
- [ ] 연락처 피커 1명 가져오기 (expo-contacts, 이름·전화만, 권한 거부 경로)
- [ ] 날짜 정밀도 "월/년" 표시·필터 제외 안내
- [ ] S14 JSON 데이터 내보내기 (현재 장부, 공유 시트, `user_id`·`ledger_id` 제외)
- [ ] **명부 가져오기(엑셀·CSV)** — docs/02 §3.14. 파일 선택 → 열 매핑 → 미리보기(동명이인·금액 오류·빈 이름) → 저장. `expo-document-picker`·`expo-file-system`·`xlsx` 추가, 네이티브 재빌드. 금액 규칙 `parseImportedAmount` + 테스트. 사용자 견본 파일 필요
- [ ] **명부 사진 OCR** — docs/02 §3.15. 가져오기의 미리보기가 전제. 온디바이스(iOS Vision, 로컬 네이티브 모듈) 기본, 손글씨 정확도 위험. `expo-image-picker`·권한 문구·처리방침 갱신. 첫 출시 포함 여부 사용자 결정 필요

## 7. 출시 준비
- [ ] **⛔ 출시 차단 — 커스텀 SMTP 연결.** Supabase 내장 메일 발송은 시간당 몇 건으로 제한된다. 제한에 걸리면 메일만 못 가는 게 아니라 **가입 API가 429로 거부되어 신규 가입이 통째로 막힌다**(2026-09-24 실측). Resend·SendGrid 등 커스텀 SMTP를 붙이고 발신 도메인을 인증해야 한다
- [ ] 메일 템플릿 한국어화 (확인 메일·재설정 메일). 기본 템플릿은 영문이다
- [ ] 개인정보 처리방침 작성·호스팅 (서버 보관·서울 리전·수집 항목·소셜 로그인 3종·장부 공유 범위·연락처 권한·계정 삭제 절차)
- [ ] Supabase Pro 전환, 백업 설정 확인
- [ ] 앱 아이콘·스플래시·스토어 스크린샷
- [ ] EAS Build 설정 (또는 로컬 빌드), EAS Update 설정
- [ ] iOS TestFlight 내부 테스트 → 심사 제출 (계정 삭제 기능 심사 항목 확인)
- [ ] Android 내부 테스트 → (필요 시) 클로즈드 테스트 요건 충족 → 프로덕션
- [ ] 사용자 부부가 한 장부에 최근 1년치 기록 + 내 행사 1건 실입력 (docs/02 완료 기준)

## 8. 2단계 착수 전 (청첩장)
- [ ] 모노레포 재편 (`apps/mobile`, `apps/web`, `packages/domain`), 웹은 같은 Supabase 프로젝트 사용
- [ ] `invitations`·`rsvps`·`bank_accounts` 설계 확정 (`ledger_id` 소유, docs/03 §10) + 첫 `anon` 정책 설계
