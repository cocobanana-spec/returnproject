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
- [ ] **사용자에게 보고하고 복구 가능 여부를 결정한다.** 실기기 테스트에 쓴 `donghan.cocoperry@gmail.com` 계정과 그 장부·기록이 라운드 종료 정리 중에 삭제됐다. 되돌릴 수 없다
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
- [ ] S09 명부 입력은 구분 칸을 아직 두지 않았다. 라벨 없이 만들어진 동명이인은 사람 목록의 "구분 없음"으로 잡힌다. 명부에서 자주 겪으면 S02와 같은 칸을 붙인다
- [ ] 사람 목록의 "구분 없음"은 화면에 받아 온 페이지 안에서만 판정한다. 100명 경계를 넘는 동명이인은 페이지를 더 받은 뒤에 표시된다

## 6. P1 기능
- [ ] S12 기록 검색/필터 (방향·종류·기간·금액·그룹, 하단 합계)
- [ ] S11 통계 (연도 세그먼트, 총계, 종류별·그룹별 막대 — `stats_by_year`, 사람별 상위, 형태별)
- [ ] 답례 체크·메모, 내 행사 "미완료만 보기"
- [ ] 연락처 피커 1명 가져오기 (expo-contacts, 이름·전화만, 권한 거부 경로)
- [ ] 날짜 정밀도 "월/년" 표시·필터 제외 안내
- [ ] S14 JSON 데이터 내보내기 (현재 장부, 공유 시트, `user_id`·`ledger_id` 제외)
- [ ] (질문 8 답변에 따라) CSV 가져오기

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
