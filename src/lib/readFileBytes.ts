// 고른 파일을 바이트로 읽는다. 앱은 expo-file-system, 웹은 fetch 로 읽는다
//
// 파싱은 플랫폼과 무관하다. importFile.ts·importPlan.ts 는 Uint8Array 만 받으므로
// **읽는 방법만 여기서 갈리고 해석은 그대로 공유한다.**
//
// 앱 — expo-file-system 이 file:// 경로를 base64 문자열로 준다.
// 웹 — DocumentPicker 가 주는 uri 는 blob:/data: 주소다. expo-file-system 의 base64 읽기가
//      웹에서 같은 방식으로 동작하지 않으므로 fetch 로 받아 ArrayBuffer 를 쓴다.
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { base64ToBytes } from '../domain/importFile.ts';
import { isWeb } from './platform.ts';

export async function readFileBytes(uri: string): Promise<Uint8Array> {
  if (isWeb) {
    const response = await fetch(uri);
    return new Uint8Array(await response.arrayBuffer());
  }
  const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
  return base64ToBytes(base64);
}
