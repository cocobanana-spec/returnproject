// 가져오기 파일(xlsx·xls·csv)을 기기 안에서 표로 읽는다. 서버에 올리지 않는다(docs/02 §3.14)
//
// 플랫폼 중립이라 Node 테스트가 fixture 파일을 그대로 읽는다. 파일 접근(문서 선택기·base64 읽기)은
// 화면이 하고 여기에는 바이트만 들어온다. SheetJS는 순수 JS라 React Native에서도 같은 코드가 돈다.
// CSV 인코딩은 UTF-8(BOM 포함)과 EUC-KR(코드페이지 949) 둘 다 받는다. 한국 엑셀의 CSV 저장은
// EUC-KR인 경우가 많다. 자동 감지가 틀리면 화면에서 바꿀 수 있다.
import * as XLSX from 'xlsx';
import * as cptableModule from 'xlsx/dist/cpexcel.full.mjs';

// cpexcel의 타입 선언에는 utils가 없다. 실제 모듈에는 있다(2026-09-25 실측).
const cptable = cptableModule as unknown as {
  utils: { decode: (codepage: number, data: Uint8Array) => string; encode: (codepage: number, data: string) => Uint8Array };
};
import type { Table } from './importPlan.ts';

XLSX.set_cptable(cptableModule);

export type FileKind = 'xlsx' | 'csv';
export type Encoding = 'utf8' | 'euckr';

export const ENCODING_LABEL: Record<Encoding, string> = { utf8: 'UTF-8', euckr: 'EUC-KR' };

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Hermes에 atob가 없는 판이 있어 직접 푼다. 표준 base64(패딩 포함)만 받는다.
export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const len = clean.length;
  const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((len * 3) / 4 - pad);
  let o = 0;
  for (let i = 0; i < len; i += 4) {
    const a = BASE64.indexOf(clean[i] as string);
    const b = BASE64.indexOf(clean[i + 1] as string);
    const c = BASE64.indexOf(clean[i + 2] as string);
    const d = BASE64.indexOf(clean[i + 3] as string);
    const n = (a << 18) | (b << 12) | ((c & 63) << 6) | (d & 63);
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (clean[i + 2] !== '=' && o < out.length) out[o++] = (n >> 8) & 255;
    if (clean[i + 3] !== '=' && o < out.length) out[o++] = n & 255;
  }
  return out;
}

export function fileKindOf(fileName: string): FileKind | null {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext === 'csv') return 'csv';
  return null;
}

export function hasUtf8Bom(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}

// UTF-8로 온전히 읽히는 바이트열인지. EUC-KR 한글은 거의 항상 여기서 걸린다.
export function isValidUtf8(bytes: Uint8Array): boolean {
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i] as number;
    let need = 0;
    if (b < 0x80) need = 0;
    else if ((b & 0xe0) === 0xc0) need = 1;
    else if ((b & 0xf0) === 0xe0) need = 2;
    else if ((b & 0xf8) === 0xf0) need = 3;
    else return false;
    for (let k = 1; k <= need; k += 1) {
      const c = bytes[i + k];
      if (c === undefined || (c & 0xc0) !== 0x80) return false;
    }
    i += need + 1;
  }
  return true;
}

export function detectEncoding(bytes: Uint8Array): Encoding {
  if (hasUtf8Bom(bytes)) return 'utf8';
  return isValidUtf8(bytes) ? 'utf8' : 'euckr';
}

function decodeText(bytes: Uint8Array, encoding: Encoding): string {
  const body = hasUtf8Bom(bytes) ? bytes.subarray(3) : bytes;
  const codepage = encoding === 'utf8' ? 65001 : 949;
  return cptable.utils.decode(codepage, body);
}

function sheetToTable(wb: XLSX.WorkBook): Table {
  const name = wb.SheetNames[0];
  if (!name) return [];
  const ws = wb.Sheets[name];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '' });
  return rows.map((row) =>
    row.map((cell) => {
      if (typeof cell === 'number') return cell;
      if (cell === null || cell === undefined) return '';
      if (typeof cell === 'boolean') return cell ? 'true' : 'false';
      if (cell instanceof Date) return cell.toISOString().slice(0, 10);
      return String(cell);
    }),
  );
}

// 파일 바이트를 표로. csv는 인코딩을 먼저 풀어 문자열로 읽는다(SheetJS의 codepage 옵션은 raw 경로에서
// 조용히 무시되는 것을 2026-09-25에 실측했다).
export function readTable(bytes: Uint8Array, kind: FileKind, encoding: Encoding = 'utf8'): Table {
  if (kind === 'csv') {
    const text = decodeText(bytes, encoding);
    return sheetToTable(XLSX.read(text, { type: 'string', raw: true }));
  }
  return sheetToTable(XLSX.read(bytes, { type: 'array', cellDates: false }));
}

// 고른 인코딩이 바이트와 맞지 않으면 한글이 깨져 보인다. 디코더는 대체 문자를 내지 않고 엉뚱한
// 글자를 내므로(2026-09-25 실측) 결과 문자열이 아니라 바이트로 판정한다. 화면이 안내를 띄운다.
export function encodingMismatch(bytes: Uint8Array, chosen: Encoding): boolean {
  const hasNonAscii = bytes.some((b) => b >= 0x80);
  if (!hasNonAscii) return false;
  const utf8 = detectEncoding(bytes) === 'utf8';
  return chosen === 'utf8' ? !utf8 : utf8;
}
