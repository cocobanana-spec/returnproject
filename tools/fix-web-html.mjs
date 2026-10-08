// 웹 빌드가 만든 index.html 에 화면 높이 규칙을 덧붙인다 (expo export 직후에 돈다)
//
// **`height: 100%` 는 모바일에서 화면 아래를 잘라 먹는다.** iOS 사파리에서 100% 는 주소창이
// 숨겨졌을 때의 큰 높이다. 그런데 Expo 껍데기는 `body { overflow: hidden }` 이라 페이지가
// 스크롤되지 않으므로, 주소창에 가려지는 아래쪽이 영영 보이지 않는다. 하단 탭 메뉴가 잘린 채로
// 남는다(2026-09-26 사용자 지적. 안드로이드 크롬도 같다).
//
// `100dvh` 는 지금 실제로 보이는 높이라 주소창이 나타나고 사라지는 데 따라 줄고 늘어난다.
//
// Expo Router 의 `app/+html.tsx` 로 하려 했지만 **`output: single` 에서는 그 파일이 조용히
// 무시된다**(정적 렌더링 전용이다. 경고도 없다 — 빌드 결과를 직접 열어 보고 알았다).
// 그래서 빌드 산출물을 고치는 쪽으로 간다.
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

const FILE = 'dist/web/index.html';
const ANCHOR = '</style>';
const MARK = 'ppurin-visible-height';
const CSS = `<style id="${MARK}">
/* 옛 브라우저는 100%, 그 밖에는 실제로 보이는 높이 */
html, body, #root { height: 100%; height: 100dvh; }
/* 번들이 뜨기 전에도 같은 바닥색 — Green Deck 라이트 */
body { background: #F2F4F6; }
</style>`;

const html0 = readFileSync(FILE, 'utf8');
// 홈 화면에 추가할 때 쓰는 아이콘(흰 바탕). Expo 단일 페이지 출력에는 apple-touch-icon 이 없다
const TOUCH = '<link rel="apple-touch-icon" href="/apple-touch-icon.png">';
const html = html0.includes('apple-touch-icon') ? html0 : html0.replace('</head>', `${TOUCH}\n</head>`);
copyFileSync('assets/apple-touch-icon.png', 'dist/web/apple-touch-icon.png');

if (html.includes(MARK)) {
  writeFileSync(FILE, html);
  console.log('index.html — 높이 규칙이 이미 있다');
  process.exit(0);
}

const at = html.indexOf(ANCHOR);
if (at === -1) {
  console.error(`index.html 에서 ${ANCHOR} 를 찾지 못했다. Expo 가 껍데기를 바꿨는지 확인하라.`);
  process.exit(1);
}

const cut = at + ANCHOR.length;
writeFileSync(FILE, `${html.slice(0, cut)}\n${CSS}${html.slice(cut)}`);
console.log('index.html — 화면 높이 규칙을 넣었다 (100dvh)');
