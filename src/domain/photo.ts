// 초대장 사진의 크기 규칙 — 너무 큰 사진은 줄여서 올린다. 어떻게 줄일지만 정하고 실제 변환은 lib 이 한다
//
// 저장소 버킷 한도는 5MB(0009). 요즘 폰 사진은 4,000px 넘고 HEIC 원본이 5~10MB 라 그대로 올리면
// 거부된다. 공개 페이지는 폰 폭(480px 안팎)으로 보니 긴 변 1600px 이면 2배 화면에서도 충분하다.
// 줄였으면 사용자에게 한 줄로 알린다 — 몰래 바꾸지 않는다(2026-10-04 사용자 요청).

export const MAX_EDGE = 1600;
export const MAX_BYTES = 5 * 1024 * 1024;
export const JPEG_QUALITY = 0.82;

export type PhotoPlan = {
  // 변환이 필요한가. 크기(긴 변)가 넘거나 용량이 넘거나 형식이 허용 밖이면 true
  convert: boolean;
  // 줄일 목표 크기. 비율을 지키려고 긴 변 하나만 준다. 안 줄이면 null
  resize: { width: number } | { height: number } | null;
  // 사용자에게 보여 줄 한 줄. 변환이 없으면 ''
  notice: string;
};

export type PhotoInfo = { width: number; height: number; bytes?: number | null; mimeType?: string | null };

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function planPhoto(info: PhotoInfo, maxEdge = MAX_EDGE, maxBytes = MAX_BYTES): PhotoPlan {
  const longest = Math.max(info.width, info.height);
  const tooBig = longest > maxEdge;
  const tooHeavy = typeof info.bytes === 'number' && info.bytes > maxBytes;
  const badType = !!info.mimeType && !ALLOWED.has(info.mimeType);

  const resize = tooBig ? (info.width >= info.height ? { width: maxEdge } : { height: maxEdge }) : null;
  const convert = tooBig || tooHeavy || badType;

  let notice = '';
  if (tooBig) notice = `사진이 커서 긴 변 ${maxEdge}px 로 줄여서 올렸습니다.`;
  else if (tooHeavy) notice = '사진 용량이 커서 압축해서 올렸습니다.';
  else if (badType) notice = '사진 형식을 JPEG 로 바꿔서 올렸습니다.';

  return { convert, resize, notice };
}

// 변환 뒤에도 한도를 넘으면 올리지 않는다. 실제로는 1600px JPEG 가 5MB 를 넘을 일이 없다.
export function photoTooLargeMessage(bytes: number, maxBytes = MAX_BYTES): string | null {
  if (bytes <= maxBytes) return null;
  return `줄인 뒤에도 ${Math.round(bytes / 1024 / 1024)}MB 라 올릴 수 없습니다. 다른 사진을 골라 주세요.`;
}
