# 뿌린대로거두리라 — 작업 체크리스트

> 상태: 기획 완료, 착수 가능 — 2026-09-16. 확정: Expo · 클라우드 · iOS+Android 동시 · **Supabase** · **공동 장부 1단계 포함** · 로그인 Apple+Google+Kakao · 로그인 우선.
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

## 2. 외부 콘솔 등록
- [ ] Supabase 프로젝트 생성 (서울 리전), 플랜 확인 (무료 플랜 일시정지 조건 → 출시 전 Pro)
- [ ] Apple Developer — Sign in with Apple 서비스 ID·키 발급, Supabase 콜백 등록
- [ ] Google Cloud — OAuth 클라이언트 3개(iOS·Android·웹), Supabase에 웹 클라이언트 등록
- [ ] **Kakao Developers — 앱 등록, 플랫폼(iOS 번들 ID·Android 패키지명·키 해시) 등록, Kakao 로그인 활성화, Client Secret 활성화, Redirect URI에 Supabase 콜백 등록, 동의 항목 `profile_nickname`·`profile_image` 설정**
- [ ] Kakao — 비즈 앱 전환 조건 확인(개인 개발자 가능 여부). 전환 가능하면 `account_email` 추가, 불가하면 이메일 없이 진행(앱은 이메일을 식별에 쓰지 않음)
- [ ] Kakao — (검증) Kakao 로그인 → OpenID Connect 활성화 후 네이티브 SDK ID 토큰으로 `signInWithIdToken({ provider: 'kakao' })`가 되는지 로컬 Supabase에서 1회 시도. 안 되면 브라우저 OAuth 경로 확정
- [ ] Supabase Auth — Apple·Google·Kakao 프로바이더 활성화

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
- [ ] 소셜 로그인 3종으로 같은 확인 (Apple·Google·Kakao 프로바이더 활성화 후)
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
- [ ] dev client 빌드 (`expo run:ios` / `run:android`) — **불가.** Xcode 라이선스 미동의(`sudo xcodebuild -license accept` 필요), Java 런타임 없음

## 4b. 네이티브 빌드가 가능해지면 확인할 것
- [ ] Hermes에서 `String.prototype.normalize('NFC')` 동작 — 안 되면 이름 정규화 전체가 죽는다
- [ ] Hermes에서 `Number.prototype.toLocaleString('ko-KR')`이 천 단위 콤마를 내는지 — 안 되면 금액 표시가 전부 깨진다
- [ ] 소셜 로그인 3종 실동작 + Supabase Redirect URL 허용 목록에 `ppurin://auth/callback` 등록
- [ ] AsyncStorage 세션 영속 — 앱 강제 종료 후 재실행 시 로그인 화면이 안 뜨는지
- [ ] `persistQueryClient` 복원 — 비행기 모드 재실행 시 마지막 화면이 보이는지
- [ ] 오프라인 배너 — `isInternetReachable`이 실제로 false로 떨어지는지
- [ ] 장부 전환 중 삭제·병합 — 다른 장부 데이터가 건드려지지 않는지 실기기 재확인
- [ ] 로그아웃 후 다른 계정 로그인 — 이전 계정 데이터가 한 프레임도 비치지 않는지
- [ ] 다크 모드 전환 시 StatusBar와 토큰이 함께 바뀌는지

## 4c. 서버 쪽 후속 — 2026-09-21 완료 (마이그레이션 0003)
- [x] `delete_person`·`merge_people`·`event_summary`가 `p_ledger_id`를 받아 서버에서 장부를 검사한다. 기본값을 주지 않아 호출부가 빼먹을 수 없다. 로컬 T15, 원격 스모크 §9로 검증
- [x] `entries.amount` 상한 CHECK (10억) — 앱 상한과 같은 값을 DB에도 둔다

## 5. P0 화면 (docs/02 §4)
- [ ] S00 로그인 (Apple·Google·Kakao 버튼, 처리방침 링크, 네트워크 없음 안내)
- [ ] 탭 셸 4개 (홈·사람·행사·더보기) + 빈 상태 문구 (홈 빈 상태에 "초대 코드 입력" 안내 포함)
- [ ] S17 장부 — 장부 목록·전환, 이름 편집, 구성원 목록, 초대 코드 생성·공유 시트, 초대 코드 입력, 내보내기·나가기
- [ ] S02 준돈 빠른 기록 — 이름 자동완성(최근 5명 칩, prefix 8명), 종류 칩, 금액 프리셋, 날짜, 형태, "더 입력", ±7일 기존 행사 판정, 실행 취소 토스트, 저장 실패 시 폼 유지·재시도
- [ ] S15 동명이인 선택 시트
- [ ] S05 사람 생성/편집 (개인/단체, 관계 그룹, 라벨)
- [ ] S03 사람 목록 (검색, 그룹 필터, 정렬 3종, 차액 표시 — `person_balances`)
- [ ] S04 사람 상세·원장 (수지 카드, 기록 목록, 공동 배지, 병합·삭제 메뉴 → RPC)
- [ ] S08 행사 생성/편집 (내 행사 토글 잠금 규칙, 당사자, 날짜 정밀도, 측 라벨)
- [ ] S06 행사 목록 (세그먼트, 연도 헤더)
- [ ] S07 행사 상세 (내 행사 정산 — `event_summary`, 미확정·답례 진행)
- [ ] S09 받은돈 연속 입력 ("저장 후 다음", 직전 값 유지, 미확정 저장, 인라인 수정)
- [ ] S10 기록 상세/편집 (입력자 표시 — 구성원 2명 이상일 때)
- [ ] S01 홈 (현재 장부 이름, 올해 카드 2개, 다가오는 행사 3개, 최근 기록 10건, FAB, 오프라인 배너)
- [ ] S16 계정 (로그아웃, 장부별 결과를 적은 계정 삭제 다이얼로그 → Edge Function)
- [ ] docs/02 §7 검증 기준 전 항목 통과 (3계정 RLS, 초대·합류·전환·승계, 계정 삭제 장부 규칙, 두 기기, 비행기 모드 포함)

## 6. P1 기능
- [ ] S12 기록 검색/필터 (방향·종류·기간·금액·그룹, 하단 합계)
- [ ] S11 통계 (연도 세그먼트, 총계, 종류별·그룹별 막대 — `stats_by_year`, 사람별 상위, 형태별)
- [ ] 답례 체크·메모, 내 행사 "미완료만 보기"
- [ ] 연락처 피커 1명 가져오기 (expo-contacts, 이름·전화만, 권한 거부 경로)
- [ ] 날짜 정밀도 "월/년" 표시·필터 제외 안내
- [ ] S14 JSON 데이터 내보내기 (현재 장부, 공유 시트, `user_id`·`ledger_id` 제외)
- [ ] (질문 8 답변에 따라) CSV 가져오기

## 7. 출시 준비
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
