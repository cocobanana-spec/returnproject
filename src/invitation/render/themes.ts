// 청첩장 테마 '브라운'·'꾸러기' — 봄(spring.ts)의 본문 구조 위에 덧입히는 CSS 와 글꼴 (2026-10-08 사장님 요청)
//
// 브라운: 나무·앤티크·고풍. 양피지 바탕, 나무 액자 사진, 금빛 장식, 송명·Cinzel·Pinyon Script.
//         인트로는 나무 문 두 짝이 닫혀 있다가 금빛 문구가 써진 뒤 양쪽으로 열린다.
// 짜잔: 8비트 레트로 게임. 파란 하늘·픽셀 구름·벽돌 땅·코인, 픽셀 글씨, 게임 시작 화면 인트로(PRESS START).
// 꾸러기: 만화·웹툰. 망점 바탕, 굵은 검은 테두리와 엇갈린 그림자, 말풍선, 주아·Bangers.
//         인트로는 노란 망점 위에 말풍선이 톡 튀어나와 글자가 찍히고 하트가 터진다.
// 외부 자원은 구글 폰트뿐이다(봄과 같은 원칙).
import { SPRING_CSS } from './spring.ts';
import type { RichTheme } from './spring.ts';

const FONT_HEAD = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>';

export const THEME_FONTS: Record<RichTheme, string> = {
  spring: `${FONT_HEAD}\n<link href="https://fonts.googleapis.com/css2?family=Allura&family=Nanum+Myeongjo:wght@400;700&display=swap" rel="stylesheet">`,
  brown: `${FONT_HEAD}\n<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Nanum+Myeongjo:wght@400;700&family=Pinyon+Script&family=Song+Myung&display=swap" rel="stylesheet">`,
  cartoon: `${FONT_HEAD}\n<link href="https://fonts.googleapis.com/css2?family=Bangers&family=Jua&display=swap" rel="stylesheet">`,
  // 영문·숫자는 Press Start 2P(픽셀), 한글은 각진 도현으로 받친다(구글 폰트에 한글 픽셀체가 없다)
  game: `${FONT_HEAD}\n<link href="https://fonts.googleapis.com/css2?family=Do+Hyeon&family=Press+Start+2P&display=swap" rel="stylesheet">`,
};

// 나무결 — 그림 없이 줄무늬 겹으로
const WOOD =
  'repeating-linear-gradient(90deg, rgba(0,0,0,.08) 0 2px, transparent 2px 9px), repeating-linear-gradient(90deg, #5b3920 0 18px, #67422549 18px 30px, #573620 30px 46px), linear-gradient(#5e3b22, #4e3019)';

const BROWN_CSS = `
:root{--ink:#3d2a1c;--green:#7a4a22;--rose:#9c4f3c;--line:#6b4426}
body{background-color:#efe2c8;font-family:"Song Myung","Nanum Myeongjo",serif;color:var(--ink)}
.hero{width:calc(100% - 36px);height:auto;aspect-ratio:3/4;margin:18px;border:12px solid #6b4426;outline:2px solid #c9a46a;outline-offset:-20px;box-shadow:0 10px 24px rgba(61,42,28,.35);filter:sepia(.15) saturate(.95)}
h2.g{font-family:"Song Myung",serif;color:var(--green);font-size:1.5rem}
h2.g::before{content:"❦";display:block;font-size:1.05rem;color:#a7783f;margin-bottom:8px}
.when{border-top:3px double var(--line);border-bottom:3px double var(--line)}
.names .nl strong{color:#5a3a22}
.cal-title{font-family:"Song Myung",serif;color:#5a3a22}
.cal-grid{border-top:3px double var(--line);border-bottom:3px double var(--line);font-family:"Nanum Myeongjo",serif}
.cal-grid .wk.sun{color:#9c4f3c}
.cal-grid .on b{background:#6b4426;box-shadow:0 0 0 2px #c9a46a inset}
.dials b{background:#6b4426;box-shadow:0 0 0 3px #c9a46a inset;font-family:"Cinzel",serif}
.dials small{font-family:"Cinzel",serif;color:#6b4426}
.gal .grid{gap:6px;padding:0 10px}
.gal img{border:3px solid #fff8ea;box-shadow:0 2px 6px rgba(61,42,28,.25);filter:sepia(.12)}
.mapbtns a{background:rgba(255,248,232,.7);border:1px solid #c9a46a;box-shadow:none;color:#5a3a22;font-family:"Nanum Myeongjo",serif}
.tr h4{color:#7a4a22;font-family:"Song Myung",serif}
.tr p,.gb-card p{font-family:"Nanum Myeongjo",serif}
button.dark{background:#5a3a22;border:1px solid #c9a46a;border-radius:2px;font-family:"Song Myung",serif}
button.outline{border:1px solid #a7783f;color:#5a3a22;border-radius:2px;background:rgba(255,248,232,.5)}
.acc{border:1px solid #c9a46a;background:rgba(255,248,232,.55)}
.gb-card{background:rgba(255,248,232,.65);border:1px solid #d6bd8f;box-shadow:0 1px 3px rgba(61,42,28,.12)}
.gb-head b{color:#7a4a22;font-family:"Song Myung",serif}
.fabs button{background:rgba(90,58,34,.85)}
.sheet-card{background:#f7ecd6}
.sheet-card h4{color:#7a4a22}
.seg input:checked+span{background:#5a3a22;border-color:#5a3a22}
.brown-intro{background:#2b1a0e}
.brown-intro .door{position:absolute;top:0;bottom:0;width:50.5%;background:${WOOD};box-shadow:inset 0 0 0 6px #3e2513, inset 0 0 0 9px #8a6235}
.brown-intro .door.l{left:0;border-right:2px solid #2b1a0e;animation:door-l 1.1s cubic-bezier(.6,.05,.3,1) 2.4s forwards}
.brown-intro .door.r{right:0;border-left:2px solid #2b1a0e;animation:door-r 1.1s cubic-bezier(.6,.05,.3,1) 2.4s forwards}
.brown-intro .door::after{content:"";position:absolute;top:62%;width:12px;height:12px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#f3d58c,#a77a2c);box-shadow:0 0 6px rgba(0,0,0,.5)}
.brown-intro .door.l::after{right:16px}
.brown-intro .door.r::after{left:16px}
.brown-intro .script{z-index:2;font-family:"Pinyon Script",cursive;color:#f1d9a7;text-shadow:0 2px 10px rgba(0,0,0,.6);animation:fade-out .35s ease 2.3s forwards}
@keyframes door-l{to{transform:translateX(-102%)}}
@keyframes door-r{to{transform:translateX(102%)}}
@keyframes fade-out{to{opacity:0}}
`;

// 망점 — 원 하나를 반복
const DOTS = (c: string, size = 14) => `radial-gradient(${c} 1.3px, transparent 1.5px) 0 0/${size}px ${size}px`;

const CARTOON_CSS = `
:root{--ink:#111;--green:#111;--rose:#ff4d8d;--line:#111}
body{background:#fffdf5;background-image:radial-gradient(#ffe8a3 1.2px, transparent 1.4px);background-size:16px 16px;font-family:"Jua",sans-serif;color:#111;font-size:17px}
section{padding:44px 22px}
.hero{width:calc(100% - 40px);height:auto;aspect-ratio:3/4;margin:26px 20px 10px;border:4px solid #111;border-radius:8px;box-shadow:8px 8px 0 #111;transform:rotate(-1.5deg)}
h2.g{display:inline-block;font-family:"Jua",sans-serif;font-size:1.3rem;color:#111;background:#ffd43b;border:3px solid #111;border-radius:999px;padding:6px 22px;box-shadow:4px 4px 0 #111}
.when{border:3px solid #111;border-radius:18px;background:#fff;box-shadow:6px 6px 0 #111;margin:30px 24px 0;padding:18px}
.greet .body{position:relative;background:#fff;border:3px solid #111;border-radius:24px;padding:22px 18px;box-shadow:5px 5px 0 #111;line-height:1.9}
.greet .body::after{content:"";position:absolute;left:44px;bottom:-16px;width:22px;height:22px;background:#fff;border-right:3px solid #111;border-bottom:3px solid #111;transform:rotate(45deg)}
.names .nl strong{background:#ffd43b;padding:0 6px;border-radius:6px}
a.tel{color:#1c7ed6}
button.outline{border:3px solid #111;background:#fff;color:#111;border-radius:999px;box-shadow:3px 3px 0 #111;font-family:"Jua",sans-serif}
button.dark{background:#ff4d8d;color:#fff;border:3px solid #111;border-radius:999px;box-shadow:4px 4px 0 #111;font-family:"Jua",sans-serif}
.cal-title{font-family:"Jua",sans-serif;color:#111}
.cal-grid{border:3px solid #111;border-radius:18px;background:#fff;box-shadow:6px 6px 0 #111;padding:16px 6px 24px;font-family:"Jua",sans-serif}
.cal-grid .wk.sun{color:#ff4d8d}
.cal-grid .on b{background:#ff4d8d;border:3px solid #111}
.count .heart{color:#ff4d8d}
.dials b{background:#4dabf7;color:#111;border:3px solid #111;box-shadow:3px 3px 0 #111;font-family:"Bangers",cursive;font-size:1.6rem;letter-spacing:.04em}
.dials small{font-family:"Bangers",cursive;font-size:.95rem;letter-spacing:.06em;color:#111}
.gal .grid{gap:10px;padding:0 16px}
.gal img{border:3px solid #111;border-radius:10px;box-shadow:3px 3px 0 #111}
.mapbtns a{background:#fff;border:3px solid #111;border-radius:12px;box-shadow:3px 3px 0 #111;color:#111;font-family:"Jua",sans-serif}
.tr h4{color:#ff4d8d;font-family:"Jua",sans-serif}
.acc{border:3px solid #111;border-radius:16px;background:#fff;box-shadow:4px 4px 0 #111}
.acc.groom summary{color:#1c7ed6}
.acc.bride summary{color:#ff4d8d}
.gb-card{background:#fff;border:3px solid #111;border-radius:18px;box-shadow:4px 4px 0 #111}
.gb-head b{color:#1c7ed6;font-family:"Jua",sans-serif}
.fabs button{background:#ffd43b;color:#111;border:3px solid #111;box-shadow:3px 3px 0 #111}
.sheet-card{border-top:4px solid #111}
.seg span{border:2px solid #111}
.seg input:checked+span{background:#ffd43b;color:#111;border-color:#111}
.toon-intro{background:#ffd43b;background-image:${DOTS('#f0a500')}}
.toon-intro .bubble{position:relative;max-width:82%;background:#fff;border:4px solid #111;border-radius:40px;padding:22px 26px;box-shadow:8px 8px 0 #111;font-family:"Jua",sans-serif;font-size:min(2.3rem,8.5vw);line-height:1.3;color:#111;text-align:center;transform:scale(0);animation:pop .55s cubic-bezier(.2,1.6,.4,1) .25s forwards}
.toon-intro .bubble::after{content:"";position:absolute;left:30%;bottom:-20px;width:26px;height:26px;background:#fff;border-right:4px solid #111;border-bottom:4px solid #111;transform:rotate(45deg)}
.toon-intro .bubble span{display:inline-block;clip-path:inset(0 100% 0 0);animation:write 1.3s steps(14) .9s forwards}
.toon-intro .pow{position:absolute;top:24%;right:14%;font-size:3.4rem;color:#ff4d8d;-webkit-text-stroke:3px #111;transform:scale(0) rotate(-14deg);animation:pop-tilt .45s cubic-bezier(.2,1.8,.4,1) 2.2s forwards}
@keyframes pop{to{transform:scale(1)}}
@keyframes pop-tilt{to{transform:scale(1) rotate(-14deg)}}
`;

// 픽셀 그림 — 외부 그림 없이 SVG 사각형으로. 닌텐도 캐릭터·물음표 블록·파이프는 쓰지 않는다(저작권·상표)
const svg = (w: number, h: number, body: string) =>
  `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' shape-rendering='crispEdges'>${body}</svg>")`;
// 벽돌 한 칸(32×16)
const BRICK = svg(32, 16, "<rect width='32' height='16' fill='%23c84c0c'/><rect width='32' height='2' fill='%23fcbcb0'/><rect y='8' width='32' height='2' fill='%23000'/><rect y='14' width='32' height='2' fill='%23000'/><rect x='14' y='0' width='2' height='8' fill='%23000'/><rect x='30' y='8' width='2' height='8' fill='%23000'/><rect x='0' y='2' width='2' height='6' fill='%23fcbcb0'/>");
// 구름 — 계단 모양
const CLOUD = svg(96, 40, "<g fill='%23fff'><rect x='24' y='8' width='16' height='8'/><rect x='16' y='16' width='64' height='8'/><rect x='8' y='24' width='80' height='8'/><rect x='48' y='0' width='16' height='16'/><rect x='40' y='8' width='32' height='8'/></g><g fill='%2338a8f8'><rect x='8' y='32' width='80' height='4'/></g>");
// 코인
const COIN = svg(16, 16, "<rect x='4' y='0' width='8' height='16' fill='%23f8b800'/><rect x='2' y='2' width='12' height='12' fill='%23f8b800'/><rect x='6' y='3' width='2' height='10' fill='%23fff3b0'/><rect x='10' y='3' width='2' height='10' fill='%23c87800'/>");
// 하트
const HEART = svg(14, 12, "<g fill='%23e40058'><rect x='2' y='0' width='4' height='2'/><rect x='8' y='0' width='4' height='2'/><rect x='0' y='2' width='14' height='4'/><rect x='2' y='6' width='10' height='2'/><rect x='4' y='8' width='6' height='2'/><rect x='6' y='10' width='2' height='2'/></g>");

// 픽셀체는 영문·숫자 자리(인트로·카운트다운·달력 숫자)에만. 한글 제목·버튼은 도현 — 픽셀체 띄어쓰기가 너무 넓다
const PX = '"Press Start 2P", "Do Hyeon", monospace';

const GAME_CSS = `
:root{--ink:#111;--green:#111;--rose:#e40058;--line:#000}
html{image-rendering:pixelated}
body{background:#6888fc;background-image:${CLOUD},${CLOUD};background-size:96px 40px,72px 30px;background-position:12% 140px,82% 420px;background-repeat:no-repeat;background-attachment:scroll;font-family:"Do Hyeon",sans-serif;color:#111;font-size:18px}
.page{background:linear-gradient(#6888fc,#6888fc)}
section{padding:40px 18px}
section > *{position:relative}
.hero{width:calc(100% - 36px);height:auto;aspect-ratio:3/4;margin:24px 18px 0;border:6px solid #000;outline:4px solid #fff;outline-offset:-10px;image-rendering:auto}
.hero + .when{margin-top:0}
.when{background:#fff;border:4px solid #000;box-shadow:6px 6px 0 #000;margin:28px 18px 0;padding:18px 10px;font-family:"Do Hyeon",sans-serif;font-size:1.15rem}
h2.g{display:inline-block;font-family:"Do Hyeon",sans-serif;font-size:1.25rem;line-height:1.4;color:#fff;background:#e45c10;border:4px solid #000;padding:10px 16px;box-shadow:4px 4px 0 #000;letter-spacing:.02em}
h2.g::before{content:"";display:inline-block;width:16px;height:16px;margin-right:10px;vertical-align:-2px;background:${COIN}}
.greet .body,.names,.way,.rsvp .body{color:#111}
.greet .body{background:#fff;border:4px solid #000;box-shadow:6px 6px 0 #000;padding:20px 14px;font-size:1.1rem}
.names{background:#fcd8a8;border:4px solid #000;box-shadow:6px 6px 0 #000;margin:0 18px;padding:24px 10px}
.names .nl strong{color:#e40058}
a.tel{color:#111}
button{font-family:"Do Hyeon",sans-serif!important;font-size:1.05rem!important;line-height:1.4}
button.outline{background:#fff;border:4px solid #000;border-radius:0;box-shadow:4px 4px 0 #000;color:#111;padding:14px 18px}
button.dark{background:#00a800;border:4px solid #000;border-radius:0;box-shadow:4px 4px 0 #000;color:#fff;padding:16px 22px}
.cal{background:#fff;border:4px solid #000;box-shadow:6px 6px 0 #000;margin:0 18px;padding:28px 10px}
.cal-title{font-family:"Do Hyeon",sans-serif;font-size:1.7rem;line-height:1.4;color:#111;margin-left:4px}
.cal-grid{border-top:4px solid #000;border-bottom:4px solid #000;font-family:${PX};font-size:.7rem}
.cal-grid .wk{font-family:"Do Hyeon",sans-serif;font-size:1rem}
.cal-grid .wk.sun{color:#e40058}
.cal-grid .on b{background:#e40058;border-radius:0;box-shadow:3px 3px 0 #000;font-weight:400}
.cal-grid .on small{font-family:"Do Hyeon",sans-serif;font-size:.8rem}
.count{background:#000;color:#fff;border:4px solid #fff;outline:4px solid #000;margin:0 22px;padding:26px 12px}
.count .who{font-family:"Do Hyeon",sans-serif;color:#fff}
.count .heart{display:inline-block;width:14px;height:12px;background:${HEART};color:transparent;overflow:hidden;vertical-align:-1px}
.dials b{width:62px;height:62px;border-radius:0;background:#000;color:#f8b800;border:3px solid #fff;font-family:${PX};font-size:1rem}
.dials small{font-family:${PX};font-size:.5rem;color:#fff}
.gal{padding:40px 0}
.gal .grid{gap:8px;padding:0 18px}
.gal img{border:4px solid #000;box-shadow:4px 4px 0 #000}
.way{background:#fff;border:4px solid #000;box-shadow:6px 6px 0 #000;margin:0 18px}
.mapbtns a{background:#fcbc3c;border:3px solid #000;box-shadow:3px 3px 0 #000;color:#111;font-family:"Do Hyeon",sans-serif;font-size:1rem}
.tr h4{font-family:"Do Hyeon",sans-serif;font-size:1.2rem;color:#e45c10}
.tr p{font-family:"Do Hyeon",sans-serif;font-size:1.05rem}
.rsvp{background:#fff;border:4px solid #000;box-shadow:6px 6px 0 #000;margin:0 18px}
.acc{border:4px solid #000;border-radius:0;background:#fff;box-shadow:4px 4px 0 #000;margin:0 0 14px}
.acc summary{font-family:"Do Hyeon",sans-serif}
.acc.groom summary{color:#0058f8}
.acc.bride summary{color:#e40058}
.gb-card{background:#fff;border:4px solid #000;border-radius:0;box-shadow:4px 4px 0 #000}
.gb-head b{font-family:"Do Hyeon",sans-serif;color:#0058f8}
.gb-card p{font-family:"Do Hyeon",sans-serif;font-size:1.05rem}
.gbs::after{content:"";display:block;height:48px;margin:40px -22px -56px;background:${BRICK};background-size:32px 16px;image-rendering:pixelated}
.footer{background:#000;color:#fff;opacity:1;font-family:"Do Hyeon",sans-serif}
.fabs button{background:#fcbc3c;color:#111;border:3px solid #000;border-radius:0;box-shadow:3px 3px 0 #000}
.sheet-card{border:4px solid #000;border-radius:0;font-family:"Do Hyeon",sans-serif}
.seg span{border:3px solid #000;border-radius:0}
.seg input:checked+span{background:#00a800;color:#fff;border-color:#000}
.sheet-card input[name=name],.sheet-card textarea,.sheet-card input[type=number]{border:3px solid #000;border-radius:0}
.game-intro{background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px;animation:intro-out .5s steps(4) 3.2s forwards}
.game-intro .hud{position:absolute;top:calc(28px + env(safe-area-inset-top));left:22px;margin:0;font-family:${PX};font-size:.6rem;color:#fff;letter-spacing:.05em}
.game-intro .script{font-family:${PX};font-size:min(1.25rem,5.2vw);line-height:1.9;color:#fff;white-space:normal;max-width:86%;text-shadow:none}
.game-intro .script span{animation:write 1.4s steps(18) .35s forwards}
.game-intro .press{margin:0;font-family:${PX};font-size:.7rem;color:#f8b800;opacity:0;animation:blink .5s steps(1) 1.9s 3 forwards}
.game-intro .flash{position:absolute;inset:0;background:#fff;opacity:0;animation:flash .35s steps(2) 2.9s forwards}
@keyframes blink{0%{opacity:1}50%{opacity:0}100%{opacity:1}}
@keyframes flash{50%{opacity:1}100%{opacity:.9}}
`;

// 봄의 CSS 위에 테마 CSS 를 덧입힌다
export function themeCss(theme: RichTheme): string {
  if (theme === 'brown') return SPRING_CSS + BROWN_CSS;
  if (theme === 'cartoon') return SPRING_CSS + CARTOON_CSS;
  if (theme === 'game') return SPRING_CSS + GAME_CSS;
  return SPRING_CSS;
}
