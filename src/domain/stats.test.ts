// 집계 접기 단위 테스트. 공동 부조가 행사 합계에서 중복되지 않는다는 규칙이 여기서 드러난다
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  foldEventSummary,
  foldYearStats,
  foldYearStatsFor,
  defaultYear,
  filterEventTotals,
  filterStatsRows,
  sortEventTotals,
  topPeopleScopeLabel,
  typesOf,
  yearsOf,
  type EventTotalRow,
  type EventSummaryRow,
  type StatsRow,
} from './stats.ts';

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

test('연도 목록은 최신 연도부터 내림차순으로 중복 없이 나온다', () => {
  const rows: StatsRow[] = [
    { year: 2025, is_mine: false, type: 'wedding', relation_group: 'friend', cnt: 1, total: 50000, unconfirmed: 0 },
    { year: 2026, is_mine: false, type: 'wedding', relation_group: 'friend', cnt: 1, total: 100000, unconfirmed: 0 },
    { year: 2025, is_mine: true, type: 'wedding', relation_group: 'work', cnt: 2, total: 300000, unconfirmed: 1 },
  ];
  assert.deepEqual(yearsOf(rows), [2026, 2025]);
});

test('행이 없으면 연도 목록도 비어 있다', () => {
  assert.deepEqual(yearsOf([]), []);
});

test('연도를 고르면 그 해만 접고 null이면 전체를 접는다', () => {
  const rows: StatsRow[] = [
    { year: 2025, is_mine: false, type: 'wedding', relation_group: 'friend', cnt: 1, total: 50000, unconfirmed: 0 },
    { year: 2026, is_mine: false, type: 'wedding', relation_group: 'friend', cnt: 1, total: 100000, unconfirmed: 0 },
  ];
  assert.equal(foldYearStatsFor(rows, 2026).givenTotal, 100000);
  assert.equal(foldYearStatsFor(rows, 2025).givenTotal, 50000);
  assert.equal(foldYearStatsFor(rows, null).givenTotal, 150000);
  assert.equal(foldYearStatsFor(rows, null).givenCount, 2);
});

test('없는 연도를 고르면 0이 나오고 터지지 않는다', () => {
  const rows: StatsRow[] = [
    { year: 2026, is_mine: true, type: 'wedding', relation_group: 'friend', cnt: 1, total: 100000, unconfirmed: 0 },
  ];
  const stats = foldYearStatsFor(rows, 1999);
  assert.equal(stats.receivedTotal, 0);
  assert.deepEqual(stats.receivedByType, []);
});

test('미확정 건수는 방향별로도 나뉜다', () => {
  const split: StatsRow[] = [
    { year: 2026, is_mine: false, type: 'wedding', relation_group: 'friend', cnt: 2, total: 150000, unconfirmed: 1 },
    { year: 2026, is_mine: true, type: 'wedding', relation_group: 'work', cnt: 3, total: 300000, unconfirmed: 2 },
  ];
  const stats = foldYearStats(split);
  assert.equal(stats.givenUnconfirmed, 1);
  assert.equal(stats.receivedUnconfirmed, 2);
  assert.equal(stats.unconfirmedCount, 3);
});

test('올해 기록이 있으면 기본 연도는 올해다', () => {
  assert.equal(defaultYear([2026, 2025], 2026), 2026);
});

test('올해 기록이 없으면 가장 최근 기록 연도를 고른다', () => {
  assert.equal(defaultYear([2025, 2023], 2026), 2025);
});

test('기록이 아예 없으면 전체(null)다', () => {
  assert.equal(defaultYear([], 2026), null);
});

test('사람별 상위의 기간 표시는 null이면 전체 기간이다', () => {
  assert.equal(topPeopleScopeLabel(null), '전체 기간');
  assert.equal(topPeopleScopeLabel(2026), '2026년');
});

const mixed: StatsRow[] = [
  { year: 2026, is_mine: false, type: 'wedding', relation_group: 'friend', cnt: 2, total: 150000, unconfirmed: 0 },
  { year: 2026, is_mine: false, type: 'funeral', relation_group: 'work', cnt: 1, total: 300000, unconfirmed: 0 },
  { year: 2026, is_mine: true, type: 'wedding', relation_group: 'work', cnt: 3, total: 200000, unconfirmed: 1 },
  { year: 2025, is_mine: false, type: 'wedding', relation_group: 'family', cnt: 1, total: 50000, unconfirmed: 0 },
];

test('종류 목록은 기록이 있는 것만 정해진 순서로 나온다', () => {
  assert.deepEqual(typesOf(mixed), ['wedding', 'funeral']);
  assert.deepEqual(typesOf([]), []);
});

test('연도와 종류로 함께 거른다', () => {
  assert.equal(filterStatsRows(mixed, 2026, null).length, 3);
  assert.equal(filterStatsRows(mixed, null, 'wedding').length, 3);
  assert.equal(filterStatsRows(mixed, 2026, 'wedding').length, 2);
  assert.equal(filterStatsRows(mixed, null, null).length, 4);
});

const eventRows: EventTotalRow[] = [
  { event_id: 'e1', title: '내 결혼식', type: 'wedding', is_mine: true, event_date: '2026-02-14', cnt: 3, total: 200000, unconfirmed: 1 },
  { event_id: 'e2', title: '김철수 결혼식', type: 'wedding', is_mine: false, event_date: '2026-05-18', cnt: 1, total: 100000, unconfirmed: 0 },
  { event_id: 'e3', title: '이영희 조부상', type: 'funeral', is_mine: false, event_date: '2025-09-03', cnt: 5, total: 50000, unconfirmed: 0 },
];

test('행사별은 방향과 종류로 걸러진다', () => {
  assert.equal(filterEventTotals(eventRows, 'all', null).length, 3);
  assert.deepEqual(filterEventTotals(eventRows, 'received', null).map((e) => e.event_id), ['e1']);
  assert.deepEqual(filterEventTotals(eventRows, 'given', null).map((e) => e.event_id), ['e2', 'e3']);
  assert.deepEqual(filterEventTotals(eventRows, 'given', 'funeral').map((e) => e.event_id), ['e3']);
});

test('행사별은 최신순으로 정렬되고 원본을 건드리지 않는다', () => {
  assert.deepEqual(sortEventTotals(eventRows).map((e) => e.event_id), ['e2', 'e1', 'e3']);
  assert.equal(eventRows[0]?.event_id, 'e1');
});

test('같은 날 행사는 제목 순으로 고정된다', () => {
  const same: EventTotalRow[] = [
    { event_id: 'b', title: '나 행사', type: 'wedding', is_mine: true, event_date: '2026-02-14', cnt: 1, total: 1, unconfirmed: 0 },
    { event_id: 'a', title: '가 행사', type: 'wedding', is_mine: true, event_date: '2026-02-14', cnt: 1, total: 1, unconfirmed: 0 },
  ];
  assert.deepEqual(sortEventTotals(same).map((e) => e.event_id), ['a', 'b']);
});

test('종류별·관계별 버킷은 접는 시점에 이미 금액 내림차순이다', () => {
  const stats = foldYearStats(filterStatsRows(mixed, 2026, null));
  assert.deepEqual(stats.givenByType.map((b) => b.key), ['funeral', 'wedding']);
  assert.ok((stats.givenByType[0]?.total ?? 0) >= (stats.givenByType[1]?.total ?? 0));
});
