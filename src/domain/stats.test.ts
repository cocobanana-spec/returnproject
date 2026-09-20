// 집계 접기 단위 테스트. 공동 부조가 행사 합계에서 중복되지 않는다는 규칙이 여기서 드러난다
import test from 'node:test';
import assert from 'node:assert/strict';
import { foldEventSummary, foldYearStats, type EventSummaryRow, type StatsRow } from './stats.ts';

const rows: StatsRow[] = [
  { year: 2025, is_mine: false, type: 'wedding', relation_group: 'work', cnt: 2, total: 200000, unconfirmed: 0 },
  { year: 2025, is_mine: false, type: 'funeral', relation_group: 'friend', cnt: 1, total: 70000, unconfirmed: 0 },
  { year: 2025, is_mine: true, type: 'first_birthday', relation_group: 'work', cnt: 3, total: 150000, unconfirmed: 1 },
];

test('준돈과 받은돈을 방향별로 나눠 합산한다', () => {
  const s = foldYearStats(rows);
  assert.equal(s.givenTotal, 270000);
  assert.equal(s.receivedTotal, 150000);
  assert.equal(s.balance, 120000);
  assert.equal(s.givenCount, 3);
  assert.equal(s.receivedCount, 3);
});

test('미확정 건수는 방향과 무관하게 모두 센다', () => {
  assert.equal(foldYearStats(rows).unconfirmedCount, 1);
});

test('종류별·그룹별 버킷은 합계 내림차순이다', () => {
  const s = foldYearStats(rows);
  assert.deepEqual(s.givenByType.map((b) => b.key), ['wedding', 'funeral']);
  assert.equal(s.givenByType[0]?.label, '결혼식');
  assert.equal(s.receivedByGroup[0]?.label, '직장');
});

test('같은 키가 여러 행으로 와도 하나로 합쳐진다', () => {
  const s = foldYearStats([
    { year: 2025, is_mine: false, type: 'wedding', relation_group: 'work', cnt: 1, total: 100000, unconfirmed: 0 },
    { year: 2025, is_mine: false, type: 'wedding', relation_group: 'friend', cnt: 1, total: 50000, unconfirmed: 0 },
  ]);
  assert.equal(s.givenByType.length, 1);
  assert.equal(s.givenByType[0]?.total, 150000);
  assert.equal(s.givenByGroup.length, 2);
});

test('빈 결과도 0으로 접힌다', () => {
  const s = foldYearStats([]);
  assert.equal(s.givenTotal, 0);
  assert.equal(s.balance, 0);
  assert.deepEqual(s.givenByType, []);
});

const summaryRows: EventSummaryRow[] = [
  { side: 'a', method: 'cash', cnt: 2, total: 150000, unconfirmed: 0, returned: 1 },
  { side: 'a', method: 'transfer', cnt: 1, total: 50000, unconfirmed: 0, returned: 0 },
  { side: 'b', method: 'cash', cnt: 1, total: 0, unconfirmed: 1, returned: 0 },
  { side: null, method: 'wreath', cnt: 1, total: 0, unconfirmed: 1, returned: 0 },
];

test('행사 전체 합계', () => {
  const s = foldEventSummary(summaryRows);
  assert.equal(s.total, 200000);
  assert.equal(s.cnt, 5);
});

test('측별 합계는 손으로 더한 값과 같다', () => {
  const s = foldEventSummary(summaryRows);
  // 같은 측의 여러 형태(현금 15만 + 이체 5만)가 하나로 합쳐져야 한다
  const a = s.bySide.find((b) => b.side === 'a');
  const b = s.bySide.find((b) => b.side === 'b');
  const none = s.bySide.find((x) => x.side === null);
  assert.deepEqual([a?.total, a?.cnt], [200000, 3]);
  assert.deepEqual([b?.total, b?.cnt], [0, 1]);
  assert.deepEqual([none?.total, none?.cnt], [0, 1]);
});

test('미확정과 답례 건수가 따로 집계된다', () => {
  const s = foldEventSummary(summaryRows);
  assert.equal(s.unconfirmed, 2);
  assert.equal(s.returned, 1);
});

test('측은 a → b → 미지정 순서로 고정된다', () => {
  const s = foldEventSummary(summaryRows);
  assert.deepEqual(s.bySide.map((b) => b.side), ['a', 'b', null]);
});

test('형태별 버킷에 한국어 라벨이 붙는다', () => {
  const s = foldEventSummary(summaryRows);
  assert.equal(s.byMethod[0]?.label, '현금');
  assert.equal(s.byMethod.find((b) => b.key === 'wreath')?.label, '화환·조화');
});
