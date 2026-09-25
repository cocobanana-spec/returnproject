// 가져오기 판단 로직 단위 테스트 — 제목 감지, 열 추정, 종류·날짜 매핑, 행 상태, 저장 계획
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRows,
  canSave,
  detectHeader,
  guessMapping,
  mapEventType,
  mappingErrors,
  markSameNames,
  parseImportedDate,
  planSave,
  rowStatus,
  summarize,
  trimTable,
  type ImportRow,
  type Table,
} from './importPlan.ts';

// 견본과 같은 모양 — A열 비어 있음, 제목 행, No·이름·금액·구분
const sample: Table = [
  ['', 'No', '이름', '금액', '구분'],
  ['', 1, '홍길동', 100000, '결혼식'],
  ['', 2, '김영희', 50000, '결혼식'],
  ['', 3, '이몽룡', 100000, '결혼식'],
];

test('비어 있는 선행 열과 빈 행을 걷어낸다', () => {
  const t = trimTable([...sample, ['', '', '', '', '']]);
  assert.equal(t.length, 4);
  assert.deepEqual(t[0], ['No', '이름', '금액', '구분']);
});

test('첫 행이 열 이름으로 읽히면 제목 행이다', () => {
  assert.equal(detectHeader(trimTable(sample)), true);
  assert.equal(detectHeader([['홍길동', 100000], ['김영희', 50000]]), false);
});

test('열 역할을 제목으로 추정한다 — No는 무시 열', () => {
  const m = guessMapping(trimTable(sample));
  assert.equal(m.hasHeader, true);
  assert.deepEqual(m.roles, ['ignore', 'name', 'amount', 'type']);
  assert.deepEqual(mappingErrors(m), []);
});

test('제목이 없으면 숫자가 많은 열이 금액, 문자열 열이 이름이다', () => {
  const m = guessMapping([['홍길동', '₩100,000'], ['김영희', '50,000']]);
  assert.equal(m.hasHeader, false);
  assert.deepEqual(m.roles, ['name', 'amount']);
});

test('이름·금액 열이 없거나 겹치면 매핑 오류다', () => {
  assert.ok(mappingErrors({ hasHeader: true, roles: ['ignore', 'amount'] }).some((e) => e.includes('이름')));
  assert.ok(mappingErrors({ hasHeader: true, roles: ['name', 'name', 'amount'] }).some((e) => e.includes('둘 이상')));
});

test('구분 열의 글자를 행사 종류로 바꾼다', () => {
  assert.equal(mapEventType('결혼식'), 'wedding');
  assert.equal(mapEventType('웨딩'), 'wedding');
  assert.equal(mapEventType('돌잔치'), 'first_birthday');
  assert.equal(mapEventType('조문'), 'funeral');
  assert.equal(mapEventType('칠순'), 'senior_birthday');
  assert.equal(mapEventType('개소식'), 'opening');
  assert.equal(mapEventType('기타'), 'other');
  assert.equal(mapEventType('집들이'), null);
});

test('날짜 셀은 엑셀 일련번호와 문자열 표기를 받는다', () => {
  assert.equal(parseImportedDate(46067), '2026-02-14');
  assert.equal(parseImportedDate('2026-02-14'), '2026-02-14');
  assert.equal(parseImportedDate('2026.2.14'), '2026-02-14');
  assert.equal(parseImportedDate('2026년 2월 14일'), '2026-02-14');
  assert.equal(parseImportedDate('어제'), null);
});

function rowsOf(table: Table, target: 'given' | 'received' = 'given') {
  const t = trimTable(table);
  return buildRows(t, guessMapping(t), { target, defaultDate: '2026-05-18', eventType: target === 'received' ? 'wedding' : null });
}

test('준돈 가져오기는 행마다 이름·금액·종류·날짜를 만든다', () => {
  const rows = rowsOf(sample);
  assert.equal(rows.length, 3);
  assert.equal(rows[0]?.index, 2);
  assert.equal(rows[0]?.name, '홍길동');
  assert.equal(rows[0]?.amount, 100000);
  assert.equal(rows[0]?.type, 'wedding');
  assert.equal(rows[0]?.date, '2026-05-18');
  assert.deepEqual(rows[0]?.issues, []);
});

test('빈 이름·금액 오류·종류 미확인·단위 없는 금액을 표시한다', () => {
  const rows = rowsOf([
    ['이름', '금액', '구분'],
    ['', 50000, '결혼식'],
    ['박민수', '화환', '결혼식'],
    ['최수진', 30000, '집들이'],
    ['정우성', '10', '결혼식'],
  ]);
  assert.deepEqual(rows[0]?.issues, ['empty_name']);
  assert.deepEqual(rows[1]?.issues, ['bad_amount']);
  assert.deepEqual(rows[2]?.issues, ['unknown_type']);
  assert.equal(rows[2]?.type, 'other');
  assert.deepEqual(rows[3]?.issues, ['unitless_amount']);
  assert.equal(rowStatus(rows[0] as ImportRow), 'fix');
  assert.equal(rowStatus(rows[1] as ImportRow), 'fix');
  assert.equal(rowStatus(rows[2] as ImportRow), 'warn');
  assert.equal(rowStatus(rows[3] as ImportRow), 'warn');
});

test('명부 가져오기는 구분 열이 행사 종류와 다르면 경고만 한다', () => {
  const rows = rowsOf([['이름', '금액', '구분'], ['홍길동', 50000, '돌잔치'], ['김영희', 50000, '결혼식']], 'received');
  assert.deepEqual(rows[0]?.issues, ['type_mismatch']);
  assert.equal(rows[0]?.type, 'wedding');
  assert.equal(rowStatus(rows[0] as ImportRow), 'warn');
  assert.deepEqual(rows[1]?.issues, []);
});

test('장부에 같은 이름이 있으면 구분할 말이나 기존 사람 선택이 필요하다', () => {
  const rows = markSameNames(rowsOf(sample), new Map([['홍길동', ['p1']]]));
  const hong = rows[0] as ImportRow;
  assert.ok(hong.issues.includes('same_name_in_ledger'));
  assert.equal(rowStatus(hong), 'fix');
  assert.equal(rowStatus({ ...hong, label: '회사' }), 'ok');
  assert.equal(rowStatus({ ...hong, attachTo: 'p1' }), 'ok');
});

test('파일 안 중복은 같은 사람인지 다른 사람인지 골라야 한다', () => {
  const rows = markSameNames(rowsOf([['이름', '금액', '구분'], ['김철수', 50000, '결혼식'], ['김철수', 30000, '결혼식']]), new Map());
  const [a, b] = rows as [ImportRow, ImportRow];
  assert.ok(a.issues.includes('same_name_in_file'));
  assert.equal(rowStatus(a), 'fix');
  assert.equal(rowStatus({ ...a, dupChoice: 'same' }), 'ok');
  assert.equal(rowStatus({ ...a, dupChoice: 'different' }), 'fix');
  assert.equal(rowStatus({ ...a, dupChoice: 'different', label: '회사' }), 'ok');
  // 같은 사람으로 고르면 저장 계획에서 한 사람 키로 묶이고, 다른 사람이면 행마다 갈린다
  const same = planSave([{ ...a, dupChoice: 'same' }, { ...b, dupChoice: 'same' }], 'given');
  assert.equal(same[0]?.personKey, same[1]?.personKey);
  const diff = planSave([{ ...a, dupChoice: 'different', label: '회사' }, { ...b, dupChoice: 'different', label: '학교' }], 'given');
  assert.notEqual(diff[0]?.personKey, diff[1]?.personKey);
});

test('요약은 저장·건너뜀·수정 필요를 세고 수정 필요가 0이어야 저장할 수 있다', () => {
  const rows = rowsOf([['이름', '금액', '구분'], ['홍길동', 50000, '결혼식'], ['', 50000, '결혼식'], ['김영희', 30000, '결혼식']]);
  assert.deepEqual(summarize(rows), { save: 2, skip: 0, fix: 1, total: 3, totalAmount: 80000 });
  assert.equal(canSave(rows), false);
  const fixed = rows.map((r, i) => (i === 1 ? { ...r, skip: true } : r));
  assert.deepEqual(summarize(fixed), { save: 2, skip: 1, fix: 0, total: 3, totalAmount: 80000 });
  assert.equal(canSave(fixed), true);
  assert.equal(planSave(fixed, 'given').length, 2);
});
