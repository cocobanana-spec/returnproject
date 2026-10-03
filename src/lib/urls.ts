// 앱 밖의 우리 주소 모음. 주소가 바뀌면 여기 한 곳만 고친다
//
// 2026-10-04 ppurin.com 으로 이전했다(docs/08 ①). 옛 github.io 주소는 안내 페이지가 받는다.
export const WEB_APP_URL = 'https://app.ppurin.com/';
export const LANDING_URL = 'https://ppurin.com/';
export const APP_STORE_URL = 'https://apps.apple.com/kr/app/id6815605969';

// 화면에 보여 줄 짧은 꼴. 프로토콜과 끝 슬래시를 뗀다.
export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
