// 고른 사진을 올릴 수 있는 꼴로 만든다 — 규칙(src/domain/photo.ts)에 따라 줄이고 압축하고 JPEG 로 바꾼다
//
// expo-image-manipulator 는 앱(네이티브)과 웹(캔버스) 둘 다 된다. 결과는 항상 JPEG 다 —
// 아이폰의 HEIC 원본도 여기서 JPEG 가 되어 버킷의 허용 형식(jpeg·png·webp)에 맞는다.
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { JPEG_QUALITY, photoTooLargeMessage, planPhoto, type PhotoInfo } from '../domain/photo.ts';
import { readFileBytes } from './readFileBytes.ts';

export type PreparedPhoto = {
  bytes: Uint8Array;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  ext: 'jpg' | 'png' | 'webp';
  // 사용자에게 보여 줄 안내. 아무것도 안 바꿨으면 ''
  notice: string;
};

export async function preparePhoto(uri: string, info: PhotoInfo): Promise<PreparedPhoto> {
  const plan = planPhoto(info);
  if (!plan.convert) {
    const bytes = await readFileBytes(uri);
    const over = photoTooLargeMessage(bytes.length);
    if (over) throw new Error(over);
    const isPng = info.mimeType === 'image/png';
    const isWebp = info.mimeType === 'image/webp';
    return {
      bytes,
      contentType: isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg',
      ext: isPng ? 'png' : isWebp ? 'webp' : 'jpg',
      notice: '',
    };
  }
  const out = await manipulateAsync(uri, plan.resize ? [{ resize: plan.resize }] : [], {
    compress: JPEG_QUALITY,
    format: SaveFormat.JPEG,
  });
  const bytes = await readFileBytes(out.uri);
  const over = photoTooLargeMessage(bytes.length);
  if (over) throw new Error(over);
  return { bytes, contentType: 'image/jpeg', ext: 'jpg', notice: plan.notice };
}
