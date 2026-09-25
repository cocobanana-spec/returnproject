// fixture 파일(xlsx·UTF-8 BOM CSV·EUC-KR CSV)을 실제로 읽어 같은 표가 나오는지 확인한다
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { base64ToBytes, detectEncoding, encodingMismatch, fileKindOf, isValidUtf8, readTable } from './importFile.ts';
import { buildRows, guessMapping, summarize, trimTable } from './importPlan.ts';

const dir = path.join(process.cwd(), 'supabase', 'tests', 'fixtures');
const read = (name: string) => new Uint8Array(fs.readFileSync(path.join(dir, name)));

function importAll(name: string) {
  const bytes = read(name);
  const kind = fileKindOf(name);
  assert.ok(kind);
  const table = trimTable(readTable(bytes, kind as 'xlsx' | 'csv', kind === 'csv' ? detectEncoding(bytes) : 'utf8'));
  const mapping = guessMapping(table);
  return { table, mapping, rows: buildRows(table, mapping, { target: 'given', defaultDate: '2026-05-18', eventType: null }) };
}

test('xlsx 견본 — 통화 서식 셀은 숫자로 읽히고 13행 전부 결혼식이다', () => {
  const { table, mapping, rows } = importAll('sample.xlsx');
  assert.deepEqual(table[0], ['No', '이름', '금액', '구분']);
  assert.deepEqual(mapping.roles, ['ignore', 'name', 'amount', 'type']);
  assert.equal(rows.length, 13);
  assert.ok(rows.every((r) => r.type === 'wedding' && r.issues.length === 0));
  assert.equal(summarize(rows).totalAmount, 1500000);
});

test('UTF-8 BOM CSV 견본 — ₩100,000 문자열이 원 단위 정수로 읽힌다', () => {
  const bytes = read('sample-utf8bom.csv');
  assert.equal(detectEncoding(bytes), 'utf8');
  const { rows } = importAll('sample-utf8bom.csv');
  assert.equal(rows.length, 13);
  assert.equal(rows[0]?.amount, 100000);
  assert.equal(summarize(rows).totalAmount, 1500000);
});

test('EUC-KR CSV 견본 — 인코딩이 자동 감지되고 한글이 깨지지 않는다', () => {
  const bytes = read('sample-euckr.csv');
  assert.equal(isValidUtf8(bytes), false);
  assert.equal(detectEncoding(bytes), 'euckr');
  const { rows } = importAll('sample-euckr.csv');
  assert.equal(encodingMismatch(bytes, 'euckr'), false);
  assert.equal(rows[0]?.name, '홍길동');
  assert.equal(rows[0]?.amount, 100000);
  assert.equal(summarize(rows).totalAmount, 1500000);
});

test('인코딩을 잘못 고르면 바이트로 알아챈다', () => {
  assert.equal(encodingMismatch(read('sample-euckr.csv'), 'utf8'), true);
  assert.equal(encodingMismatch(read('sample-utf8bom.csv'), 'euckr'), true);
  assert.equal(encodingMismatch(read('sample-utf8bom.csv'), 'utf8'), false);
  assert.equal(encodingMismatch(new TextEncoder().encode('name,amount\nkim,1000\n'), 'euckr'), false);
});

test('base64 풀기는 표준 패딩을 처리한다', () => {
  assert.deepEqual([...base64ToBytes('aGk=')], [104, 105]);
  assert.deepEqual([...base64ToBytes('aGV5')], [104, 101, 121]);
  assert.deepEqual([...base64ToBytes('YQ==')], [97]);
  const xlsx = read('sample.xlsx');
  assert.deepEqual([...base64ToBytes(Buffer.from(xlsx).toString('base64'))], [...xlsx]);
});

test('확장자로 파일 종류를 고른다', () => {
  assert.equal(fileKindOf('명부.XLSX'), 'xlsx');
  assert.equal(fileKindOf('명부.xls'), 'xlsx');
  assert.equal(fileKindOf('명부.csv'), 'csv');
  assert.equal(fileKindOf('명부.pdf'), null);
});
