// CSV 내보내기 규칙 검증 — 따옴표 처리, 날짜 정밀도, BOM
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCsv, csvCell, exportDate, exportFileName, toCsvRow } from './exportCsv.ts';

test('쉼표·따옴표·줄바꿈이 있으면 감싸고 안쪽 따옴표는 두 번 쓴다', () => {
  assert.equal(csvCell('김철수'), '김철수');
  assert.equal(csvCell('회사, 팀장'), '"회사, 팀장"');
  assert.equal(csvCell('그가 "고맙다"고 했다'), '"그가 ""고맙다""고 했다"');
  assert.equal(csvCell('첫 줄\n둘째 줄'), '"첫 줄\n둘째 줄"');
});

test('날짜 정밀도가 낮으면 모르는 자리를 지어내지 않는다', () => {
  assert.equal(exportDate('2025-11-20', 'day'), '2025-11-20');
  assert.equal(exportDate('2025-11-01', 'month'), '2025-11');
  assert.equal(exportDate('2025-01-01', 'year'), '2025');
  assert.equal(exportDate(null, 'day'), '');
});

test('한 줄은 가져오기와 같은 열 순서로 나온다', () => {
  const row = toCsvRow({
    amount: 100000,
    memo: '축하',
    person: { name: '김철수', label: '회사' },
    event: { type: 'wedding', is_mine: false, date: '2025-11-20', date_precision: 'day' },
  });
  assert.deepEqual(row, ['김철수', '회사', '2025-11-20', '결혼식', '준 돈', '100000', '축하']);
});

test('내 행사의 기록은 받은 돈이다', () => {
  const row = toCsvRow({
    amount: 50000,
    memo: null,
    person: { name: '이영희', label: null },
    event: { type: 'first_birthday', is_mine: true, date: '2026-05-02', date_precision: 'day' },
  });
  assert.equal(row[4], '받은 돈');
  assert.equal(row[1], '');
  assert.equal(row[6], '');
});

test('엑셀이 한글을 읽도록 BOM 으로 시작하고 머리글이 붙는다', () => {
  const csv = buildCsv([]);
  assert.ok(csv.startsWith('﻿'));
  assert.ok(csv.includes('이름,구분,날짜,경조사,방향,금액,메모'));
});

test('파일 이름에서 못 쓰는 글자를 뺀다', () => {
  assert.equal(exportFileName('우리집 장부', '2026-09-26'), '우리집 장부_2026-09-26.csv');
  assert.equal(exportFileName('a/b:c', '2026-09-26'), 'abc_2026-09-26.csv');
  assert.equal(exportFileName('', '2026-09-26'), '장부_2026-09-26.csv');
});

test('금액이 비어 있으면 0으로 적는다 — 빈 칸은 엑셀 합계에서 조용히 빠진다', () => {
  const row = toCsvRow({
    amount: null,
    memo: null,
    person: { name: '박지호', label: null },
    event: { type: 'funeral', is_mine: false, date: '2025-11-20', date_precision: 'day' },
  });
  assert.equal(row[5], '0');
});

test('모르는 경조사 종류는 코드를 그대로 적는다 — 빈 칸으로 잃지 않는다', () => {
  const row = toCsvRow({
    amount: 30000,
    memo: null,
    person: { name: '한지우', label: null },
    event: { type: 'something_new', is_mine: false, date: '2025-01-01', date_precision: 'year' },
  });
  assert.equal(row[3], 'something_new');
  assert.equal(row[2], '2025');
});
