// 받은돈 가져오기의 종류별 행사 분배 테스트
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRows, guessMapping, markSameNames, trimTable, type ImportRow } from './importPlan.ts';
import {
  carryOverTargets,
  groupRowsByType,
  groupSummaryLine,
  planByType,
  setGroupTarget,
} from './importEvents.ts';

function rowsOf(table: (string | number)[][]): ImportRow[] {
  const t = trimTable(table);
  // 행사가 정해지지 않은 받은돈이다. eventType이 null이라 파일의 구분 열을 따른다.
  return markSameNames(
    buildRows(t, guessMapping(t), { target: 'received', defaultDate: '2026-07-07', eventType: null }),
    new Map(),
  );
}

const mixed = [
  ['이름', '금액', '구분'],
  ['가나다', 50000, '결혼식'],
  ['라마바', 100000, '결혼식'],
  ['사아자', 30000, '장례식'],
  ['차카타', 70000, '돌잔치'],
];

test('행사가 정해지지 않은 받은돈은 파일의 구분 열을 종류로 쓴다', () => {
  const rows = rowsOf(mixed);
  assert.deepEqual(
    rows.map((r) => r.type),
    ['wedding', 'wedding', 'funeral', 'first_birthday'],
  );
  // 대상이 고정되지 않았으므로 "행사 종류와 다름" 경고는 붙지 않는다
  assert.equal(rows.some((r) => r.issues.includes('type_mismatch')), false);
});

test('종류별로 묶이고 건수가 많은 묶음이 위로 온다', () => {
  const groups = groupRowsByType(rowsOf(mixed), [], '2026-07-07');
  assert.deepEqual(
    groups.map((g) => [g.type, g.count, g.total]),
    [
      ['wedding', 2, 150000],
      ['first_birthday', 1, 70000],
      ['funeral', 1, 30000],
    ],
  );
});

test('같은 종류의 내 행사가 있으면 그것을 기본 대상으로 잡는다', () => {
  const groups = groupRowsByType(rowsOf(mixed), [
    { id: 'e1', title: '내 결혼식', type: 'wedding', date: '2020-05-05' },
    { id: 'e2', title: '내 결혼식(재)', type: 'wedding', date: '2024-05-05' },
    { id: 'e3', title: '남의 행사', type: 'funeral', date: '2026-01-01' },
  ], '2026-07-07');
  const wedding = groups.find((g) => g.type === 'wedding');
  // 여럿이면 가장 최근 것
  assert.equal(wedding?.attachTo, 'e2');
  assert.equal(wedding?.options.length, 2);
  const funeral = groups.find((g) => g.type === 'funeral');
  assert.equal(funeral?.attachTo, 'e3');
});

test('같은 종류의 내 행사가 없으면 새로 만들 계획이 선다', () => {
  const groups = groupRowsByType(rowsOf(mixed), [], '2026-07-07');
  const funeral = groups.find((g) => g.type === 'funeral');
  assert.equal(funeral?.attachTo, null);
  assert.equal(funeral?.newTitle, '내 장례식');
  assert.equal(funeral?.newDate, '2026-07-07');
  assert.equal(groupSummaryLine(funeral!), '장례식 1건 → 내 장례식 (새로 만듦)');
});

test('파일에 날짜가 있으면 새 행사는 가장 이른 날짜로 만든다', () => {
  const table = [
    ['이름', '금액', '구분', '날짜'],
    ['가나다', 50000, '장례식', '2024-03-05'],
    ['라마바', 50000, '장례식', '2024-03-03'],
  ];
  const t = trimTable(table);
  const rows = markSameNames(
    buildRows(t, guessMapping(t), { target: 'received', defaultDate: '2026-07-07', eventType: null }),
    new Map(),
  );
  const groups = groupRowsByType(rows, [], '2026-07-07');
  assert.equal(groups[0]?.newDate, '2024-03-03');
});

test('건너뛴 행과 수정 필요 행은 묶음 건수에서 빠진다', () => {
  const rows = rowsOf(mixed).map((r) => (r.name === '라마바' ? { ...r, skip: true } : r));
  const groups = groupRowsByType(rows, [], '2026-07-07');
  const wedding = groups.find((g) => g.type === 'wedding');
  assert.equal(wedding?.count, 1);
  assert.equal(wedding?.total, 50000);
});

test('대상을 바꾸면 그 묶음만 바뀌고 러너에 넘길 계획에 반영된다', () => {
  const groups = groupRowsByType(rowsOf(mixed), [
    { id: 'e1', title: '내 결혼식', type: 'wedding', date: '2020-05-05' },
  ], '2026-07-07');
  const changed = setGroupTarget(groups, 'wedding', null);
  assert.equal(changed.find((g) => g.type === 'wedding')?.attachTo, null);
  assert.equal(changed.find((g) => g.type === 'funeral')?.attachTo, null);
  const plan = planByType(changed);
  assert.equal(plan.get('wedding')?.id, null);
  assert.equal(plan.get('wedding')?.title, '내 결혼식');
  assert.equal(plan.get('funeral')?.title, '내 장례식');
  assert.equal(plan.size, 3);
});

test('행사가 고정된 경우에는 파일 종류가 달라도 그 행사의 종류로 저장하고 경고만 한다', () => {
  const t = trimTable([['이름', '금액', '구분'], ['가나다', 50000, '장례식']]);
  const rows = buildRows(t, guessMapping(t), {
    target: 'received',
    defaultDate: '2026-07-07',
    eventType: 'wedding',
  });
  assert.equal(rows[0]?.type, 'wedding');
  assert.ok(rows[0]?.issues.includes('type_mismatch'));
});

test('사용자가 고른 대상은 이어지되, 사라진 행사를 가리키면 버린다', () => {
  const options = [{ id: 'e1', title: '내 결혼식', type: 'wedding', date: '2020-05-05' }];
  const first = groupRowsByType(rowsOf(mixed), options, '2026-07-07');
  // 사용자가 결혼식을 "새 행사로" 바꿨다 — 그 선택은 이어져야 한다
  const chosen = setGroupTarget(first, 'wedding', null);
  const again = carryOverTargets(groupRowsByType(rowsOf(mixed), options, '2026-07-07'), chosen);
  assert.equal(again.find((g) => g.type === 'wedding')?.attachTo, null);

  // 그 사이 다른 기기에서 e1이 지워졌다면, e1을 가리키던 선택은 버린다
  const pinned = setGroupTarget(first, 'wedding', 'e1');
  const gone = carryOverTargets(groupRowsByType(rowsOf(mixed), [], '2026-07-07'), pinned);
  assert.equal(gone.find((g) => g.type === 'wedding')?.attachTo, null);
});
