// 만든 파일을 사용자에게 건넨다. 웹은 브라우저 내려받기를 쓴다
//
// 웹에만 있다. 앱에서는 파일을 어디에 둘지·공유 시트를 띄울지를 따로 정해야 하는데
// 아직 그 결정을 하지 않았다(2026-09-26 사용자가 "웹에서만 해도 괜찮다"고 했다).
// 그래서 화면에서도 웹에서만 내보내기를 보여 준다.
import { isWeb } from './platform.ts';

export function canDownload(): boolean {
  return isWeb && typeof document !== 'undefined';
}

export function downloadText(fileName: string, text: string, mime = 'text/csv'): void {
  if (!canDownload()) throw new Error('이 환경에서는 파일을 내려받을 수 없습니다.');
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  // 파이어폭스는 문서에 붙어 있지 않은 링크의 클릭을 무시한다.
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 바로 풀면 내려받기가 시작되기 전에 주소가 사라지는 브라우저가 있다.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
