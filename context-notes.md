# 뿌린대로거두리라 — 컨텍스트 노트

작업 중 내린 결정과 근거를 계속 누적한다. 다음 세션(사람/에이전트)이 재유도 없이 이어받기 위한 문서다.

## 0. 확정된 제품 결정 (사용자 답변)

| # | 항목 | 결정 | 날짜 | 비고 |
|---|---|---|---|---|
| 1 | 모바일 프레임워크 | **React Native + Expo(TypeScript)** | 09-15 | CTO 추천안 그대로 |
| 2 | 저장 방식 | **클라우드** (서버가 처음부터 SoT) | 09-15 | CTO 추천안은 "로컬 우선". 영향은 §3.2 |
| 3 | 출시 플랫폼 | **iOS · Android 동시** | 09-15 | CTO 추천안 그대로 |
| 11 | 부부(가족) 공동 장부 | **예, 1단계에 필요** | 09-16 | CTO 추천안은 "아니오". 소유 축을 장부로 재설계, §3.5 |
| 12 | 로그인 수단 | **Apple + Google + Kakao, 첫 출시부터** | 09-16 | CTO 추천안은 "Kakao 후속". Kakao 사실 확인은 §3.6 |
| 13 | 첫 실행 | **로그인 먼저** (익명 시작 없음) | 09-16 | CTO 추천안 그대로 |
| 14 | 백엔드 | **Supabase 확정** | 09-16 | CTO 추천안 그대로 |

답변 대기 — docs/02 §8.2의 4~10번(앱 잠금, 공동 부조 표시, 관계 그룹, 화환 합산, 기존 기록 규모, 알림, 참석 필드). 착수를 막지 않으며 P0 화면 구현 전까지 답하면 된다.

## 1. 세션 이력

### 1.1 2026-09-14 기획 세션

**무엇을** — 경조사 준돈/받은돈 장부 모바일 앱의 1단계 기획 문서 일체. **왜** — "기획부터 잡아줘". 2단계(청첩장) 확장을 1단계 데이터 모델이 막지 않는지까지 점검.

| 단계 | 목적 | 산출물 | 검증 기준 |
|---|---|---|---|
| 1 | 환경·경험 실측 | §2 | 툴체인 버전과 기존 프로젝트 스택을 파일 근거로 확인 |
| 2 | 제품 방향 확정 | docs/01, docs/04 | 로드맵 3단계, 스택 후보 3개 이상 비교 |
| 3 | 상세 기획 위임 | docs/02, docs/03 (product-planner) | 엣지 케이스 전부, 금액 integer, UUID 키 |
| 4 | CTO 검토 | 수정본 | 정체성 축·단위·2단계 확장 영향 직접 점검 |
| 5 | 보고 | 최종 보고 + 메모리 | 확인 질문 6~10개, 이유와 선택지 |

### 1.2 2026-09-15 개정 — 저장 방식 클라우드
질문 1~3 답변 반영. CTO가 영향 범위를 정리한 뒤 docs/01~04, checklist, 이 문서를 직접 개정.

### 1.3 2026-09-16 개정 — 공동 장부·로그인 3종·Supabase 확정
질문 11~14 답변 반영. 11번이 소유 축을 바꾸는 변경이라 docs/03을 전면 재작성하고, Kakao 로그인은 Supabase 공식 문서를 조회해 사실을 확인한 뒤 docs/04에 반영. 위임 없이 CTO가 직접 개정. 커밋은 하지 않았다(사용자가 한다).

## 2. 기술 환경 발견 (2026-09-14 실측)

- 로컬 툴체인 — Node **v26.4.0**, npm 11.17, **Bun 1.3.12**, Xcode **26.6**(Swift 6.3.3), CocoaPods 1.17, Android Studio + SDK(`~/Library/Android/sdk`, 단 `ANDROID_HOME` 미설정), Ruby 4.0.6.
- 없음 — Flutter/Dart, pnpm/yarn, 전역 expo/eas CLI(npx로 대체 가능), watchman, gradle/kotlin CLI. Supabase CLI 설치 여부는 미확인(착수 시 확인).
- 사용자의 기존 프로젝트 스택(파일 근거).
  - `~/projects/321go` — iOS Swift(App Store 출시) + Android Kotlin/Compose(클로즈드 베타) + Supabase. 네이티브 양쪽을 따로 만들어 본 경험이 있고 그 유지 비용도 겪었다.
  - `~/projects/FluencC` — **Expo SDK 57 / RN 0.86** 앱. `~/projects/scentilique` — Expo + Supabase 모노레포(Auth·RLS·Edge Function 사용).
  - `~/projects/coco-finance` 등 — Next.js + Supabase 웹.
- 사용자는 1인 개발자다(CTO 메모리 project_moni_android_kickoff 근거).
- git — `main`에 99a787f(기획 문서), 1ccfa58(클라우드 개정) 푸시됨. 원격 https://github.com/cocobanana-spec/returnproject.git. 2026-09-16 개정분은 미커밋.

## 3. 결정과 근거

### 3.1 제품 방향 (docs/01)
- **원장의 축은 금액이 아니라 사람이다.** 가계부와의 차별점이며 앱 이름의 약속이다. 사람별 수지가 핵심 화면.
- 장부는 "우리 집"의 원장이다. 공동 장부 확정으로 완료 기준도 "사용자 부부가 한 장부에" 기록을 옮기는 것으로 바뀌었다.
- 타깃 우선순위 — 1차 남의 행사에 내는 30~50대, 2차 내 행사 당사자, 3차 상주.
- 경쟁 비교는 카테고리 수준. 실측은 체크리스트에.

### 3.2 스택 (docs/04)
- **Expo 확정.** Expo 프로젝트 2개 경험, 2단계 웹과 TypeScript 타입 공유, 네이티브 두 벌 유지 비용 회피.
- **클라우드 확정(09-15).** 원래 추천은 "로컬 우선 + 2단계 1회 업로드"였다. 얻는 것 — 기기 변경 시 로그인만으로 복원, 업로드 마이그레이션 소멸, 소프트 삭제·tombstone·가져오기 소멸로 모델 단순화. 잃는 것 — 첫 실행 로그인, 처리방침 항목 증가, 계정 삭제 필수, 오프라인 쓰기 불가, 운영 비용. 하지 않기로 한 것 — 오프라인 쓰기 큐, 로컬 DB, 동기화, 실시간, 충돌 해결.
- **Supabase 확정(09-16).** 사용자 경험 3건, SQL 집계, RLS 헬퍼 하나로 공동 장부 규칙 강제, 2단계 동일 프로젝트.
- 스키마는 Supabase CLI 마이그레이션 SQL + `supabase gen types`. ORM 없음. 모노레포·전역 상태 라이브러리·UI 프레임워크는 1단계에 없음. npm. `node --test`.

### 3.3 데이터 모델 — 09-14·09-15 결정 (유지)
- `entries.direction` 없음(`events.is_mine`에서 파생), `events.host_person_id`(남의 행사 당사자), 공동 부조 `co_person_id` 1명, 미확정 금액 NULL, 측 2개 고정, 대리 부조는 메모, 단체는 `people.kind`, 날짜 불명은 `date_precision`.
- 물리 삭제 + FK 규칙, `name_normalized` generated column, 집계는 뷰 + RPC, 사람 삭제·병합은 RPC. 오프라인은 읽기 캐시만.
- **금액 단위 규칙** — 원 단위 정수만. 만원 토글 변환은 입력 컴포넌트 안에서만.

### 3.4 PRD 범위 (docs/02)
- P0 — 계정(로그인 3종·계정 삭제), **장부 공유**, 이벤트 등록, 준돈 빠른 기록, 받은돈 연속 입력, 사람 원장·수지, 이름 검색.
- P1 — 필터, 통계 분해, 답례 체크, 연락처 피커, 날짜 정밀도, JSON 내보내기.
- P2 — 로컬 알림, 앱 잠금(질문 4).
- 화면 — S00 로그인, S16 계정, **S17 장부**. 시나리오 C(초대·합류).

### 3.5 공동 장부 재설계 (09-16, docs/03) — 결정과 근거
- **소유 축 = 장부.** `ledgers` + `ledger_members(ledger_id, user_id, role, display_name)` 추가, people·events·entries의 `user_id`를 `ledger_id`로 교체. RLS는 `is_ledger_member(ledger_id)` SECURITY DEFINER 헬퍼 하나로 통일(ledger_members 정책의 자기 참조 재귀 회피). 이유 — 부부가 한 장부를 쓰려면 행의 주인이 사람이 아니라 장부여야 한다.
- **역할 owner/member, 차이는 초대·제거만.** 부부 장부에서 데이터 권한 차이는 의미가 없다.
- **초대는 8자·24시간·1회용 코드.** 딥링크(유니버설 링크·도메인), 전화번호 매칭(수집·인증), 이메일 초대(발송 인프라)보다 서버 함수 하나 + 입력창 하나로 끝난다. 부부는 카톡으로 이어져 있어 코드 전달이 자연스럽다.
- **장부 생성은 `auth.users` 트리거만.** "장부 만들기" UI 없음. 모든 사용자가 장부 1권을 보장받고 클라이언트 코드가 필요 없다.
- **여러 장부 허용 + 전환 UI, 합치기 없음.** 합류 전 개인 장부에 기록이 있던 경우를 강제로 합치거나 버리게 하는 것보다 단순. `join_ledger`가 빈 개인 장부(유일 구성원·데이터 0건)만 자동 정리 — 주 흐름(배우자 설치 → 빈 장부 → 코드 입력)에서 쓸모없는 장부가 남는 것을 막기 위함.
- **구성원 변경은 SECURITY DEFINER RPC만**(`create_invite_code`·`join_ledger`·`remove_member`·`prepare_account_deletion`). "마지막 구성원은 못 나감", "owner 승계(가장 먼저 합류한 구성원)" 같은 규칙은 정책식보다 함수 안 IF문이 명확하다.
- **계정 삭제 = 혼자면 장부와 데이터 삭제, 아니면 구성원만 제거.** Edge Function이 사용자 JWT로 RPC를 먼저 호출한 뒤 service role로 사용자 삭제.
- **입력자는 `entries.created_by`만.** 공동 장부에서 "누가 넣었지"는 실제 질문이지만 사람·행사는 공유 자산이라 입력자가 의미 없다. 필터·통계 축으로 쓰지 않는다.
- **구성원 표시 이름은 `ledger_members.display_name`에 합류 시 복사.** `auth.users`는 클라이언트가 못 읽고, `profiles` 테이블보다 컬럼 하나가 싸다.
- **"공동 부조"(상대방 부부, `co_person_id`)와 "공동 장부"(우리 부부)는 독립 개념**으로 docs/03 §4·docs/02 §5에 명시.
- **구현 필수 조건 두 가지** — (a) 모든 조회에 `ledger_id = 현재 장부` 필터(RLS는 내 모든 장부를 허용하므로 빠지면 섞인다), (b) entries의 event_id·person_id가 같은 장부인지 검사하는 트리거(두 장부 구성원의 교차 참조 차단).
- **알려진 한계(문서화)** — 구성원에서 제거된 사용자는 장부 0권이 될 수 있고 새 개인 장부를 만들 UI가 없다(계정 삭제 후 재로그인이 유일 경로). 드문 경우라 "장부 만들기"를 추가하지 않았다. 관계 그룹 "직장"이 남편·아내 어느 쪽인지 구분하는 축이 없다(구분 라벨로 대체).
- **2단계 영향** — `invitations`·`rsvps`·`bank_accounts`도 `ledger_id` 소유. "가족 공동 장부"는 이후 후보에서 빠지고 "장부 합치기"가 들어갔다.

### 3.6 Kakao 로그인 사실 확인 (09-16, Supabase 공식 문서 auth-kakao 조회)
- 확인됨 — Kakao는 Supabase Auth **기본 제공 프로바이더**. REST API 키 = client_id, Client Secret 활성화 필요, Redirect URI에 Supabase 콜백 등록, 동의 항목 `profile_nickname`·`profile_image`·`account_email`(선택). **`account_email`은 비즈 앱에서만** 사용 가능. 문서에 `signInWithOAuth` 외에 ID 토큰을 `signInWithIdToken`으로 넘기는 경로도 기술됨.
- 검증 필요(지어내지 않음) — (a) React Native 네이티브 Kakao SDK + OIDC ID 토큰 → `signInWithIdToken({ provider: 'kakao' })`가 실제 동작하는지(JS 레퍼런스 페이지에는 프로바이더 목록이 없었다). 로컬 Supabase에서 1회 시도, 안 되면 브라우저 OAuth 경로. (b) 개인 개발자의 비즈 앱 전환 조건. (c) 이메일 없는 Kakao 사용자를 Supabase가 어떻게 만드는지.
- 설계상 이메일은 식별에 쓰지 않으므로(사용자 id 기준, 표시 이름은 닉네임) 비즈 앱 전환 없이도 기능상 문제가 없다.

## 4. 가정 (사용자 답변으로 확정 필요)
- Apple Developer·Google Play 개발자 계정 보유(321go 출시 근거). Play 클로즈드 테스트 요건은 이미 통과했을 가능성이 높음.
- 옮겨 넣을 기존 기록은 수십 건 규모(질문 8).
- 관계 그룹은 고정 6개로 충분(질문 6).
- Supabase 무료 플랜 일시정지 조건·Pro 가격, EAS 무료 빌드 한도, Play 클로즈드 테스트 인원, Kakao 개인 개발자 비즈 앱 조건은 착수 시 현행 기준을 다시 확인한다.

## 5. 미결 사항
- docs/02 §8.2 질문 4~10(착수 비차단).
- 앱 표시명·번들 ID·아이콘 미정. 경쟁 앱 실측 미완.
- 2026-09-16 개정분 미커밋(사용자가 커밋).

## 6. 프로세스 메모
- 09-14 — 비대화형이라 `plan-before-research`를 "계획 먼저, 가정 표시하며 진행, 질문은 말미"로 변형 적용. product-planner는 general-purpose에 역할 파일을 읽혀 동기 호출. CTO 검토에서 잡힌 결함은 둘 다 정체성 축 유형.
- 09-15 — 로컬→클라우드는 소프트 삭제·업로드·가져오기가 사라지는 "단순해지는" 변경이었다.
- 09-16 — 소유 축 확장은 예고한 대로 RLS 정책과 RPC를 전부 다시 쓰는 일이었다. 착수 전에 확인 질문으로 막아 둔 것이 맞았다. 외부 서비스 사실(Kakao)은 공식 문서를 직접 조회하고, 확인 안 된 부분은 "검증 필요 + 확인 방법"으로 남겼다.

## 7. 백엔드 토대 구현 (2026-09-19)

checklist 3단계를 구현했다. 산출물은 `supabase/migrations/0001_init.sql`(정본), `supabase/functions/delete-account/index.ts`, `supabase/tests/`(스텁·검증·러너).

### 7.1 검증 경로를 왜 이렇게 골랐나
- 이 머신에 **컨테이너 런타임이 전혀 없다**(docker·colima·podman·lima 모두 없음). 그래서 `supabase start`·`supabase db lint`·`gen types --local` 등 Docker 의존 명령을 쓸 수 없다. Supabase 클라우드 프로젝트도 아직 없다(checklist 2단계 미완).
- 택한 경로는 **`brew install postgresql@17`(17.11) + auth 스텁**이다. 로컬에 진짜 Postgres를 띄우고, 마이그레이션이 의존하는 Supabase 제공물만 스텁으로 만든 뒤(`auth` 스키마, `auth.users`, `auth.uid()`, 역할 anon/authenticated/service_role, `extensions` 스키마의 pgcrypto, public 스키마 기본 권한) **`0001_init.sql`을 수정 없이 그대로** 적용했다. DDL·생성 컬럼·트리거·plpgsql·RLS·컬럼 권한이 전부 실제로 실행된다.
- 대안이던 colima+docker 설치는 수 GB 다운로드라 느리고, 얻는 것은 "Supabase 이미지와 동일한 환경" 하나뿐이다. 그 차이에서 오는 위험은 checklist 3b로 명시해 관리한다.
- 스텁은 **`supabase/tests/`에 둔다. 마이그레이션 디렉터리에 절대 넣지 않는다.** 프로덕션에 섞이면 `auth` 스키마를 덮어쓴다.

### 7.2 검증 결과
- `./supabase/tests/run.sh` — **154건 전부 통과**, 실패 시 종료 코드 ≠ 0. 계정 A·B(같은 장부), C(다른 장부), D(두 장부 구성원) 네 세션으로 돌린다.
- 하네스의 핵심은 `expect_rows`다. **RLS에 걸린 UPDATE·DELETE는 오류 없이 0건 처리**되므로(CTO 메모리 전례), 모든 쓰기 검사는 영향 행 수를 직접 확인한다. 조회 검사는 관리자 자격(`expect_admin`)과 사용자 자격(`expect_scalar`)을 구분한다.

### 7.3 구현하며 고친 기획 결함
1. **남의 행사의 당사자 필수를 CHECK로 묶으면 사람 삭제가 불가능하다**(docs/03 CTO 결정 25로 기록). FK의 `ON DELETE SET NULL`이 당사자를 비우는 순간 CHECK에 걸려 삭제 자체가 실패했다(T11.5에서 실제로 터짐). docs/02 §5의 "당사자만 비운다"와 모순이었다. CHECK는 "내 행사는 당사자 없음"만 남기고, "남의 행사는 당사자 필수"는 `events_validate` 트리거가 INSERT일 때만 본다.
2. **데이터 수정 CTE는 서로의 결과를 보지 못한다**(결정 26). 사람·행사·기록을 `with ... insert ... insert` 하나로 묶으면 뒤 문장이 앞 CTE의 행을 못 봐 FK와 같은 장부 트리거가 전부 실패한다. 앱의 빠른 기록은 순차 INSERT(왕복 3회)여야 한다. docs/02 §3.2에 구현 주의로 적었다.
3. **`ledger_id`를 UPDATE로 바꿔 공유 장부의 행을 개인 장부로 빼낼 수 있었다**(QA가 잡음). RLS의 USING(옛 장부)과 WITH CHECK(새 장부)가 두 장부 모두의 구성원에게는 둘 다 참이라 정책으로는 막히지 않는다. `forbid_ledger_change` 트리거를 people·events·entries에 달았다. 기밀성 유출은 아니지만(두 장부 모두의 구성원이어야 함) 배우자가 보던 데이터가 조용히 사라지는 경로였다.
4. **`delete_person`이 무관한 예정 행사까지 지웠다**(QA가 잡음). 장부 전체의 "당사자 NULL + 기록 0건" 행사를 쓸어 담았다. "지운 사람이 당사자이던" 행사로 한정했다.
5. 검증 스크립트의 **가짜 통과 1건**(QA가 잡음). "소멸한 코드 재사용 불가" 검사가 실제로는 없는 코드를 넣고 있어, `join_ledger`의 코드 소멸 로직이 사라져도 통과했다. 실제로 소비된 코드를 넣도록 고쳤다.

### 7.4 의식적으로 하지 않은 것 (QA 지적 중)
- **`entries.created_by` 위조 방지.** 같은 장부 구성원끼리는 서로의 입력자 값을 바꿀 수 있다. 막으려면 INSERT/UPDATE 권한을 컬럼 단위로 열거해야 해서 컬럼이 늘 때마다 유지비가 든다. 읽기 권한은 어차피 동등하므로 **입력자는 표시용이며 감사 근거가 아니다**로 문서화하고 넘어간다.
- **초대 코드 동시 사용 잠금(`for update`)과 시도 횟수 제한.** 카톡으로 1명에게 보내는 40비트 코드라 현실성이 낮다.
- **Edge Function의 부분 실패 보상.** `prepare_account_deletion` 성공 후 `deleteUser`가 실패하면 데이터는 사라졌는데 계정이 남는다. RPC가 멱등이라 재호출로 복구되며, "데이터가 주인 없이 남는" 위험한 방향은 아니다.
- 앱이 다룰 몫 — 이름 trim(공백만인 이름이 CHECK를 통과한다), 측 라벨 없는 행사에 `side` 넣지 않기, `host_person_id`를 UPDATE 페이로드에 넣지 않기.

### 7.5 검증하지 못한 것
- **실제 Supabase 전부.** `db push` 권한, `auth.users` 트리거 생성 가능 여부, 호스티드의 기본 권한·pgcrypto 설치 스키마·로케일. checklist 3b로 목록화했다.
- **Edge Function 런타임.** Deno와 Supabase 런타임이 없어 코드만 작성했다. 타입 체크도 못 했다.
- **타입 생성.** `supabase gen types typescript --db-url`은 CLI 2.90.0에서도 postgres-meta 컨테이너를 띄운다. Docker 없이는 경로가 없다. 손으로 쓰지 않고 미실시로 둔다.
- **Supabase CLI 버전** — 설치본 2.90.0, 최신 2.117.0. 업데이트 권고가 뜬다.
