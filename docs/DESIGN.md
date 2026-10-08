# 뿌린대로거두리라 — 디자인 기준

> 2026-10-06 저녁 리뉴얼(토스 콘텐츠 + 리퀴드 글라스 내비)이 현재 기준이다. 아래 '레이어 규칙'·'토큰'·'컴포넌트 규칙'이 이긴다. 아침의 올리브그린 기준은 맨 아래 기록용.
> 2026-10-06 사장님 지시로 정한 기준. 토큰은 `src/theme/tokens.ts` 한 곳에 있고, 화면은 `useTokens()` 로 꺼내 쓴다.
> 출발점은 `green-deck-DESIGN.md` 의 라이트 모드였고, 이 문서가 그 위에 우리 앱의 방향과 판단 규칙을 얹는다. 충돌하면 이 문서가 이긴다.

## 방향

이 앱은 경조사비 장부다. 두 개의 레이어로 본다. 콘텐츠는 토스 스타일 — 연회색 바닥 위 순백 카드, 큰 글자와 더 큰 숫자, 비운 여백,
사람 같은 말투. 네비게이션은 iOS 26 리퀴드 글라스 — 탭바·툴바·떠 있는 버튼이 유리처럼 콘텐츠 위에 뜬다. 핵심은 색이 아니라 구조다.

## 레이어 규칙 (2026-10-06 리뉴얼)

두 개의 레이어로 생각한다. **콘텐츠 레이어**는 토스(Toss) 스타일 — 연회색 배경 위에 순백 카드, 구분선 대신 간격과 카드로
구역을 나눈다. 글자는 크고 굵고, 숫자는 더 크고 굵다. 한 화면에 정보를 많이 넣지 않는다. 말투는 사람처럼.
**네비게이션 레이어**는 iOS 26 리퀴드 글라스 — 탭바·툴바·떠 있는 버튼은 유리 재질로 콘텐츠 위에 떠 있고 스크롤하는 콘텐츠가 비친다.

- 콘텐츠 레이어(카드, 리스트, 텍스트, 입력 필드): 토스 토큰 그대로. 글라스 금지.
- 네비게이션 레이어(탭바, 툴바, 떠 있는 버튼, 시트 상단 바): 리퀴드 글라스.
- 글라스가 적용되는 커스텀 요소는 `expo-glass-effect` 의 `GlassView` 만 쓴다. 직접 만든 blur/material/반투명 배경 금지.
- 글라스 요소가 한 화면에 둘 이상이면 반드시 `GlassContainer` 로 묶는다.
- 글라스 아래에는 항상 스크롤되는 콘텐츠가 있어야 한다. 빈 배경 위의 글라스는 의미 없음.
- `isInteractive` 는 primary 떠 있는 버튼(기록하기) 하나에만.
- 글라스 위 텍스트/아이콘은 text-primary 또는 흰색. brand 틴트는 `tintColor` 로 primary 버튼에만.
- 플랫폼: 글라스는 iOS 26 에서만 OS 가 그린다. 안드로이드·웹·옛 iOS 는 같은 모양의 불투명 면(탭바는 순백, primary 는 브랜드 캡슐). Deployment target 은 16.4 유지.

## 토큰 (2026-10-06 리뉴얼 1단계)

색 — `src/theme/tokens.ts`. 브랜드는 `BRAND` 한 줄로 관리. **앱 아이콘 초록 #00DC64**(2026-10-08 사장님 결정. 그 전엔 블루 #3182F6).

| 토큰 | 값 | 쓰임 |
|---|---|---|
| `bg` | #F2F4F6 | 화면 배경(순백 아님) |
| `card` | #FFFFFF | 카드 |
| `surface2` / `bgSubtle` | #F9FAFB | 카드 안 하위 영역, 비활성 칩, 입력칸 |
| `text` | #191F28 | 본문·금액 기본색 |
| `textMuted` | #6B7684 | 보조 |
| `textFaint` | #8B95A1 | 부가 |
| `border` | #E5E8EB | 꼭 필요할 때만, 카드 안에서만 |
| `accent` | brand | primary 버튼 틴트, 아이콘, 받은 돈 |
| `accentSoft` | brand 10% | 아이콘 원 배경, 상태 배지 |
| `given` / `givenSoft` | #F04452 / #FDECEE | 준 돈 — **요약에서만**. 목록에서는 안 쓴다 |
| `received` | = accent | 받은 돈 |
| `danger` / `dangerSoft` | #F04452 / #FDECEE | 파괴 동작 |

타이포 — 시스템 폰트. `font.display` 32 (한 화면의 주인공 숫자) / `font.heading` 24 (화면 제목) / `font.title` 18 (카드·목록 행 제목) /
`font.body` 15 medium / `font.caption` 13 regular + textMuted. 숫자는 전부 `amountText`(tabular-nums, 자간 -0.5).

형태 — 카드 `radius.lg` 20, 버튼 `radius.md` 16, 입력칸 `radius.sm` 12, 칩·캡슐 `radius.pill`. **카드 그림자 없음**(배경 대비로만 띄운다. `cardShadow` 는 이름만 남은 흰 면 토큰). 카드 안쪽 20, 화면 좌우 20(`space.xl`), 카드 사이 12(`space.md`), 섹션 사이 32(`space.xxl`).

## 컴포넌트 규칙

- `ListRow`: [40pt 원형 아이콘(accentSoft 바탕 + accent 아이콘)] [제목 title + 캡션] [우측 값 title bold]. 높이 64 이상, 행 사이 구분선 없음.
- 모든 리스트는 `Card` 안에 들어간다. 배경에 바로 올리지 않는다.
- `SectionHeader`: 카드 바깥, 카드 위 12pt, title. 우측에 "더보기" 글자 버튼 허용.
- `Button` primary: 떠 있는 캡슐(iOS 26 글라스 + brand 틴트, 그 밖은 brand 면). 높이 56, 흰 글자 17 bold. `interactive` 는 기록하기 하나에만.
- `Button` secondary: surface2 채우기, text 글자, radius 16.
- `Chip`: 선택 시 text 채우기 + 흰 글자(brand 아님). 비활성 surface2 + textMuted. `tone="accent"` 는 상태 배지용.
- 세그먼트/탭: 밑줄 없이, 선택 항목만 text bold, 나머지 textFaint.
- 탭바: 네이티브 탭(`expo-router/unstable-native-tabs`). 커스텀으로 그리지 않는다(웹만 JS 탭).

금지 — 아이보리/크림 배경, 카드 그림자, 전체 폭 구분선, 리스트 안 금액에 색, 한 화면에 brand 큰 덩어리 2개 이상, 콘텐츠 레이어에 글라스/블러/반투명.

문구 — "준 돈/받은 돈" → "보낸 돈/받은 돈"으로 통일. "더 받은 금액" → "받은 게 더 많아요 / 보낸 게 더 많아요". 안내는 "~해 보세요", "~할 수 있어요".

## 이전 기준 (2026-10-06 아침, 올리브그린) — 기록용

### 방향(옛)

이 앱은 경조사비 장부다. 차분하고 신뢰감 있는 금융 앱 느낌을 목표로 한다.
브랜드 컬러는 올리브그린이며, 화면 전체의 인상은 그린이 지배해야 한다.
따뜻한 아이보리 배경 위에 흰 카드가 또렷하게 떠 있고,
화면마다 시선을 끄는 진한 요소가 딱 하나 있다.
나머지는 조용하다.

### 판단 규칙(옛)

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
