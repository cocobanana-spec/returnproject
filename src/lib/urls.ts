// 앱 밖의 우리 주소 모음. 주소가 바뀌면 여기 한 곳만 고친다
//
// 2026-10 에 ppurin.com 으로 이전한다(docs/08 ①). 이전이 끝나면 아래 두 값을 바꾸고
// 랜딩(site/index.html)의 링크도 같이 본다.
export const WEB_APP_URL = 'https://cocobanana-spec.github.io/returnproject/app/';
export const LANDING_URL = 'https://cocobanana-spec.github.io/returnproject/';
export const APP_STORE_URL = 'https://apps.apple.com/kr/app/id6815605969';

// 화면에 보여 줄 짧은 꼴. 프로토콜과 끝 슬래시를 뗀다.
export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
