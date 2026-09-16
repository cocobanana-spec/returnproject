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

## 3. 백엔드 토대 (Supabase)
- [ ] Supabase CLI 설치, `supabase init`, 로컬 `supabase start` 동작 확인
- [ ] `supabase/migrations/0001_init.sql` — ledgers · ledger_members · people · events · entries (docs/03 §8) + `updated_at` 트리거 + `events_lock_is_mine` 트리거 + 같은 장부 검사 트리거
- [ ] 헬퍼 `is_ledger_member` · `is_ledger_owner` (SECURITY DEFINER, docs/03 §5.1)
- [ ] RLS 활성화 + 데이터 테이블 3개 × 정책 4개, `ledgers` SELECT/UPDATE(`GRANT UPDATE (name)`), `ledger_members` SELECT만 (docs/03 §5.2). `anon` 권한 없음 확인
- [ ] `auth.users` 트리거 `handle_new_user` (개인 장부 + owner 구성원 + display_name) — 로컬에서 회원가입으로 검증
- [ ] 장부 RPC — `create_invite_code` · `join_ledger`(빈 개인 장부 정리 포함) · `remove_member`(마지막 구성원 차단, owner 승계) · `prepare_account_deletion` · `ensure_owner` · `random_invite_code` (docs/03 §6.2)
- [ ] 데이터 RPC — `delete_person` · `merge_people`(같은 장부 검사) · `event_summary` · `stats_by_year(p_ledger_id, p_year)`
- [ ] 뷰 `person_balances` (security_invoker, `ledger_id` 포함)
- [ ] Edge Function `delete-account` — 사용자 JWT로 `prepare_account_deletion` 호출 후 service role로 `auth.admin.deleteUser`
- [ ] `supabase gen types typescript` → `src/db/database.types.ts`
- [ ] RLS 검증 스크립트 — 계정 A·B(같은 장부)·C(다른 장부) 세 세션으로 교차 조회·수정·삭제·INSERT, 교차 장부 참조, 초대·합류·탈퇴·승계·계정 삭제 규칙이 docs/02 §7대로 동작하는지

## 4. 앱 토대 (Expo)
- [ ] `ANDROID_HOME` 환경변수 설정, `npx expo` 실행 확인
- [ ] Expo 앱 스캐폴드 (TypeScript, Expo Router, npm), dev client 빌드 (`expo run:ios` / `run:android`)
- [ ] supabase-js 클라이언트 + 세션 저장 (AsyncStorage), 인증 그룹 라우팅 `(auth)` / `(app)`
- [ ] Apple 로그인 (`expo-apple-authentication` → `signInWithIdToken`), Google 로그인 (`@react-native-google-signin`), Kakao 로그인 (2단계 검증 결과에 따라 네이티브 SDK 또는 `signInWithOAuth` + `expo-web-browser` + 딥링크)
- [ ] 현재 장부 컨텍스트 — 로그인 후 `ledger_members` 조회, AsyncStorage에 저장된 id가 유효하면 유지, 아니면 owner 장부 우선 선택. 장부 0권이면 S17로
- [ ] TanStack Query + `persistQueryClient`(AsyncStorage), 키 규칙 `[domain, action, { ledgerId, ... }]`, 오프라인 배너
- [ ] `src/domain/` 순수 함수 — 이름 정규화(DB와 동일 규칙), 금액 파싱(만원 토글 → 원), 자동 제목, 통계 결과 접기, 초대 코드 입력 정규화
- [ ] `node --test`로 도메인 단위 테스트 (Node 26 타입 스트리핑, `.ts` 확장자 import)
- [ ] 리포지토리 계층 — 모든 함수가 `ledgerId` 필수 인자. people / events / entries CRUD + 뷰·RPC 호출 + 장부·구성원 함수
- [ ] 디자인 토큰 파일 1개 (색·간격·글꼴 크기), 라이트/다크

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
