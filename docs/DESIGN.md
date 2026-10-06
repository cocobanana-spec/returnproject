# 뿌린대로거두리라 — 디자인 기준

> 2026-10-06 사장님 지시로 정한 기준. 토큰은 `src/theme/tokens.ts` 한 곳에 있고, 화면은 `useTokens()` 로 꺼내 쓴다.
> 출발점은 `green-deck-DESIGN.md` 의 라이트 모드였고, 이 문서가 그 위에 우리 앱의 방향과 판단 규칙을 얹는다. 충돌하면 이 문서가 이긴다.

## 방향

이 앱은 경조사비 장부다. 차분하고 신뢰감 있는 금융 앱 느낌을 목표로 한다.
브랜드 컬러는 올리브그린이며, 화면 전체의 인상은 그린이 지배해야 한다.
따뜻한 아이보리 배경 위에 흰 카드가 또렷하게 떠 있고,
화면마다 시선을 끄는 진한 요소가 딱 하나 있다.
나머지는 조용하다.

## 판단 규칙

- 모든 화면에는 "주인공" 요소가 하나 있다(진한 배경 카드 또는 primary 버튼). 두 개 이상 두지 않는다.
- 금액 텍스트의 기본 색은 진한 회색(`colors.text`)이다. 색은 의미가 있을 때만 쓴다.
- 준 돈/받은 돈 색상은 브랜드 그린과 같은 채도로 맞춘다. 쨍한 빨강 금지.
  - 준 돈: 벽돌색/테라코타 계열 (`colors.given` = #B5553F 근처)
  - 받은 돈: 브랜드 그린 (`colors.received` = `colors.accent`)
- 리스트에서 금액이 전부 같은 색으로 반복되면 안 된다. 리스트 금액은 회색, 요약 카드에서만 색을 쓴다.
- 아이콘은 텍스트와 같은 무게감이어야 한다. 선택 상태는 채움(filled) 변형을 쓴다.
- 같은 종류의 컨트롤(칩 등)을 한 화면에 세 그룹 이상 반복하지 않는다.
- 숫자는 고정폭 숫자(`fontVariant: ['tabular-nums']`, 토큰 `amountText`)를 쓴다. 큰 금액은 자간을 살짝 좁힌다.
- 칩/버튼의 비활성 배경은 화면 배경과 명확히 구분되어야 한다(대비 부족 금지).

## 토큰 (2026-10-06 1단계)

| 토큰 | 값 | 쓰임 |
|---|---|---|
| `bg` | #F6F3EA | 화면 바닥. 따뜻한 아이보리 |
| `card` | #FFFFFF | 카드. 바닥보다 확실히 밝아 떠 보인다 |
| `bgSubtle` / `surface2` | #E9E5DA | 비활성 칩·입력칸·보조 면. 바닥과 한 단계 차이 |
| `border` | #DDD8CC | 구분선 |
| `text` | #1E211C | 본문·금액 기본색 |
| `textMuted` | #6E7268 | 보조 글자 |
| `textFaint` | #9A9E94 | 부가 정보(날짜·행사명 등). 보조보다 한 단계 더 연하다 |
| `accent` | #4F7942 | 브랜드 올리브그린. primary 버튼·요약 카드·탭 선택 |
| `accentSoft` | #E6EDDF | 연한 그린 면. 배지·선택 칸 |
| `given` / `givenSoft` | #B5553F / #F3E4DF | 준 돈 — 테라코타 |
| `received` / `receivedSoft` | = accent / accentSoft | 받은 돈 — 브랜드 그린 |
| `danger` | #A8463A | 삭제 같은 파괴 동작. 빨강이되 채도는 그린과 맞춘다 |
| `nav` | #FFFFFF | 하단 탭 바 |
| `amountText` | `{ fontVariant: ['tabular-nums'] }` | 모든 금액 Text 에 펼친다 |
| `amountTextLarge` | `amountText` + `letterSpacing: -0.5` | 요약 카드의 큰 금액 |

## React Native 대응

지시문의 SwiftUI 용어를 이 앱에서는 이렇게 읽는다.

- SF Symbols weight / `.fill` → Ionicons 는 굵기 옵션이 없다. 선택 상태는 `-outline` 을 뗀 채움 이름(`home`, `calendar`, `stats-chart`)을 쓴다.
- `.monospacedDigit()` → `fontVariant: ['tabular-nums']` (`amountText` 토큰).
- Preview 전후 비교 → 헤드리스 브라우저로 웹 빌드를 찍어 나란히 붙인다(`scratchpad/ui_shots.py`).
- 세그먼트 컨트롤 → 네이티브 컴포넌트를 더하지 않고 `Chip` 과 같은 토큰으로 한 줄 세그먼트를 만든다.
