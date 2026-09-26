# 스토어 스크린샷 (6.9인치, 1320×2868)

2026-09-26 촬영. 빌드 19 릴리스 구성, iPhone 17 Pro Max 시뮬레이터.
데이터는 전부 가상이며 촬영용 계정은 촬영 직후 지웠다.

| 파일 | 화면 | 캡션 |
|---|---|---|
| `01-home.png` | 홈 대시보드 | 준 돈, 받은 돈을 한눈에 |
| `02-records.png` | 기록 목록(준 돈) | 사람 단위로 주고받은 내역 |
| `05-stats.png` | 통계 | 연도별·종류별·행사별 |
| `06-more.png` | 더보기 | 장부 공유와 관리 |

## 못 찍은 화면

사람 원장·준돈 기록 입력·가져오기 미리보기는 화면 안쪽이라 탭이 필요하다.
시뮬레이터에 탭을 보낼 수단이 없고(`simctl`에 입력 명령이 없다), 딥링크(`ppurin://`)는
iOS 26부터 "이 앱에서 열겠습니까?" 확인 창이 떠서 그 창이 화면에 찍힌다.
네 장으로 제출하고, 나머지는 실기기에서 직접 찍어 채우면 된다.

## 다시 찍는 법

1. 릴리스 구성으로 시뮬레이터용 빌드 — `-sdk iphonesimulator -derivedDataPath /tmp/ppurin-store CODE_SIGNING_ALLOWED=NO`
2. 테스트 계정을 만들고 가상 데이터를 넣는다(실명 금지)
3. 로그인 상태는 AsyncStorage에 세션을 직접 넣어 만든다.
   `<앱 데이터 컨테이너>/Library/Application Support/com.cocobanana.ppurin/RCTAsyncLocalStorage_V1/manifest.json`
   키는 `sb-<프로젝트ref>-auth-token`, 값은 세션 JSON 문자열
4. 탭 화면은 같은 파일의 `ppurin.lastTab`에 `/`·`/records`·`/stats`·`/more`를 넣고 앱을 다시 띄운다
5. 촬영 뒤 계정을 **안전장치를 거쳐** 지운다(메일 도메인 확인)
