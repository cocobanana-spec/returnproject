# 뿌린대로거두리라 — 작업 체크리스트

> 상태: 기획 완료, 스택 3건 확정(Expo · 클라우드 · iOS+Android 동시) — 2026-09-15.
> 백엔드는 CTO 추천 Supabase(docs/02 §8 14번 확인 대기). 나머지 확인 질문은 docs/02 §8.2·8.3.

## 0. 기획 (완료)
- [x] 로컬 환경·기존 프로젝트 스택 실측 → context-notes.md "기술 환경 발견"
- [x] docs/01-product-overview.md — 비전·타깃·차별점·로드맵
- [x] docs/04-tech-stack.md — 스택 후보 비교 + CTO 추천안
- [x] docs/02-prd-phase1.md — 1단계 PRD (product-planner 작성, CTO 검토)
- [x] docs/03-data-model.md — 1단계 데이터 모델 + 2단계 확장 영향 (product-planner 작성, CTO 검토)
- [x] CTO 검토 — `entries.direction` 제거, `events.host_person_id` 추가, 금액 단위 규칙 명문화
- [x] 사용자 확인 질문 정리 (docs/02 §8)
- [x] 사용자 결정 1~3 반영 — 클라우드 전제로 docs/01~04 개정 (2026-09-15)

## 1. 기획 확정 (사용자)
- [x] 질문 1~3 답변 — Expo · 클라우드 · iOS+Android 동시
- [ ] 질문 14 — 백엔드 Supabase 확정 (착수 전 필수)
- [ ] 질문 11 — 부부 공동 장부 1단계 필요 여부 (예라면 소유 축을 `ledger_id`로 재설계 후 착수)
- [ ] 질문 12·13 — Kakao 로그인 포함 여부, 첫 실행 방식(로그인 먼저 / 익명 시작)
- [ ] 질문 4~10 답변 (앱 잠금, 공동 부조 표시, 관계 그룹, 화환 합산, 기존 기록 규모, 알림, 참석 필드)
- [ ] 답변을 context-notes.md "확정된 제품 결정"에 반영하고 문서의 "가정" 표시를 확정으로 갱신
- [ ] 경쟁 앱 5개 이상 설치·비교해 docs/01 §5 표를 실측값으로 교체
- [ ] 스토어 표시명·번들 ID 결정 (예 `com.<조직>.ppurin`), 앱 아이콘 방향 결정

## 2. 백엔드 토대 (Supabase)
- [ ] Supabase 프로젝트 생성 (서울 리전), 플랜 확인 (무료 플랜 일시정지 조건 → 출시 전 Pro)
- [ ] Supabase CLI 설치, `supabase init`, 로컬 `supabase start` 동작 확인
- [ ] `supabase/migrations/0001_init.sql` — people · events · entries (docs/03 §8) + `updated_at` 트리거 + `events_lock_is_mine` 트리거
- [ ] RLS 활성화 + 테이블당 정책 4개 (SELECT/INSERT/UPDATE/DELETE, docs/03 §4). `anon` 권한 없음 확인
- [ ] 뷰 `person_balances` (security_invoker) + RPC `event_summary` · `stats_by_year` (docs/03 §5)
- [ ] RPC `delete_person` · `merge_people` (docs/03 §6)
- [ ] Auth 프로바이더 설정 — Apple, Google (Kakao는 질문 12 답변 후)
- [ ] Edge Function `delete-account` (service role, 사용자 삭제 → CASCADE)
- [ ] `supabase gen types typescript` → `src/db/database.types.ts`
- [ ] RLS 검증 스크립트 — 계정 A·B 두 세션으로 교차 조회·수정·삭제·INSERT 시도가 전부 차단되는지 (docs/02 §7)

## 3. 앱 토대 (Expo)
- [ ] `ANDROID_HOME` 환경변수 설정, `npx expo` 실행 확인
- [ ] Expo 앱 스캐폴드 (TypeScript, Expo Router, npm), dev client 빌드 (`expo run:ios` / `run:android`)
- [ ] supabase-js 클라이언트 + 세션 저장 (AsyncStorage), 인증 그룹 라우팅 `(auth)` / `(app)`
- [ ] Apple 로그인 (`expo-apple-authentication` → `signInWithIdToken`), Google 로그인 (`@react-native-google-signin`)
- [ ] TanStack Query + `persistQueryClient`(AsyncStorage), 키 규칙 `[domain, action, params]`, 오프라인 배너
- [ ] `src/domain/` 순수 함수 — 이름 정규화(DB와 동일 규칙), 금액 파싱(만원 토글 → 원), 자동 제목, 통계 결과 접기
- [ ] `node --test`로 도메인 단위 테스트 (Node 26 타입 스트리핑, `.ts` 확장자 import)
- [ ] 리포지토리 계층 — people / events / entries CRUD + 뷰·RPC 호출 함수
- [ ] 디자인 토큰 파일 1개 (색·간격·글꼴 크기), 라이트/다크

## 4. P0 화면 (docs/02 §4)
- [ ] S00 로그인 (Apple·Google 버튼, 처리방침 링크, 네트워크 없음 안내)
- [ ] 탭 셸 4개 (홈·사람·행사·더보기) + 빈 상태 문구
- [ ] S02 준돈 빠른 기록 — 이름 자동완성(최근 5명 칩, prefix 8명), 종류 칩, 금액 프리셋, 날짜, 형태, "더 입력", ±7일 기존 행사 판정, 실행 취소 토스트, 저장 실패 시 폼 유지·재시도
- [ ] S15 동명이인 선택 시트
- [ ] S05 사람 생성/편집 (개인/단체, 관계 그룹, 라벨)
- [ ] S03 사람 목록 (검색, 그룹 필터, 정렬 3종, 차액 표시 — `person_balances`)
- [ ] S04 사람 상세·원장 (수지 카드, 기록 목록, 공동 배지, 병합·삭제 메뉴 → RPC)
- [ ] S08 행사 생성/편집 (내 행사 토글 잠금 규칙, 당사자, 날짜 정밀도, 측 라벨)
- [ ] S06 행사 목록 (세그먼트, 연도 헤더)
- [ ] S07 행사 상세 (내 행사 정산 — `event_summary`, 미확정·답례 진행)
- [ ] S09 받은돈 연속 입력 ("저장 후 다음", 직전 값 유지, 미확정 저장, 인라인 수정)
- [ ] S10 기록 상세/편집
- [ ] S01 홈 (올해 카드 2개, 다가오는 행사 3개, 최근 기록 10건, FAB, 오프라인 배너)
- [ ] S16 계정 (로그아웃, 계정 삭제 다이얼로그 → Edge Function)
- [ ] docs/02 §7 검증 기준 전 항목 통과 (RLS 교차 검증, 두 기기 동일 표시, 계정 삭제 후 0건, 비행기 모드 캐시·재시도 포함)

## 5. P1 기능
- [ ] S12 기록 검색/필터 (방향·종류·기간·금액·그룹, 하단 합계)
- [ ] S11 통계 (연도 세그먼트, 총계, 종류별·그룹별 막대 — `stats_by_year`, 사람별 상위, 형태별)
- [ ] 답례 체크·메모, 내 행사 "미완료만 보기"
- [ ] 연락처 피커 1명 가져오기 (expo-contacts, 이름·전화만, 권한 거부 경로)
- [ ] 날짜 정밀도 "월/년" 표시·필터 제외 안내
- [ ] S14 JSON 데이터 내보내기 (공유 시트, `user_id` 제외)
- [ ] (질문 8 답변에 따라) CSV 가져오기
- [ ] (질문 12 답변에 따라) Kakao 로그인

## 6. 출시 준비
- [ ] 개인정보 처리방침 작성·호스팅 (서버 보관·서울 리전·수집 항목·연락처 권한·계정 삭제 절차 명시)
- [ ] Supabase Pro 전환, 백업 설정 확인
- [ ] 앱 아이콘·스플래시·스토어 스크린샷
- [ ] EAS Build 설정 (또는 로컬 빌드), EAS Update 설정
- [ ] iOS TestFlight 내부 테스트 → 심사 제출 (계정 삭제 기능 심사 항목 확인)
- [ ] Android 내부 테스트 → (필요 시) 클로즈드 테스트 요건 충족 → 프로덕션
- [ ] 사용자 본인 최근 1년치 기록 + 내 행사 1건 실입력 (docs/02 완료 기준)

## 7. 2단계 착수 전 (청첩장)
- [ ] 모노레포 재편 (`apps/mobile`, `apps/web`, `packages/domain`), 웹은 같은 Supabase 프로젝트 사용
- [ ] `invitations`·`rsvps`·`bank_accounts` 설계 확정 (docs/03 §9.1 초안 기반) + 첫 `anon` 정책 설계
