// 빠른 기록 검증·후보 선택 단위 테스트
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDraft, pickClosestEvent, undoPlan, validateQuickRecord } from './quickRecord.ts';

function draft(patch: Partial<ReturnType<typeof emptyDraft>> = {}) {
  return { ...emptyDraft('2026-03-10'), type: 'wedding' as const, amountText: '100000', ...patch };
}

test('기존 사람을 고르면 통과한다', () => {
  const result = validateQuickRecord(draft({ personId: 'p1' }));
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.plan.amount, 100000);
});

test('새 사람 이름으로도 통과한다', () => {
  const result = validateQuickRecord(draft({ newPersonName: ' 김 철수 ' }));
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.plan.personName, '김 철수');
});

test('사람이 비면 막는다', () => {
  const result = validateQuickRecord(draft());
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.some((e) => e.includes('이름')));
});

test('행사 종류가 비면 막는다', () => {
  const result = validateQuickRecord(draft({ personId: 'p1', type: null }));
  assert.equal(result.ok, false);
});

test('만원 단위 입력이 원으로 바뀐다', () => {
  const result = validateQuickRecord(draft({ personId: 'p1', amountText: '10', amountUnit: 'manwon' }));
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.plan.amount, 100000);
});

test('숫자가 아니면 막는다', () => {
  const result = validateQuickRecord(draft({ personId: 'p1', amountText: '십만원' }));
  assert.equal(result.ok, false);
});

test('금액이 비면 막는다', () => {
  const result = validateQuickRecord(draft({ personId: 'p1', amountText: '' }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.some((e) => e.includes('금액')));
});

test('0원은 유효하다', () => {
  const result = validateQuickRecord(draft({ personId: 'p1', amountText: '0' }));
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.plan.amount, 0);
});

test('초안은 다섯 필드와 새 사람 정보만 가진다', () => {
  assert.deepEqual(Object.keys(emptyDraft('2026-03-10')).sort(), [
    'amountText',
    'amountUnit',
    'date',
    'memo',
    'newPersonGroup',
    'newPersonName',
    'personId',
    'type',
  ]);
});

test('후보가 없으면 null', () => {
  assert.equal(pickClosestEvent([], '2026-03-10'), null);
});

test('날짜가 가장 가까운 행사를 고른다', () => {
  const picked = pickClosestEvent(
    [{ date: '2026-03-04' }, { date: '2026-03-09' }, { date: '2026-03-16' }],
    '2026-03-10',
  );
  assert.equal(picked?.date, '2026-03-09');
});

test('거리가 같으면 이른 쪽을 고른다', () => {
  const picked = pickClosestEvent([{ date: '2026-03-13' }, { date: '2026-03-07' }], '2026-03-10');
  assert.equal(picked?.date, '2026-03-07');
});

test('새 사람을 만들었으면 사람만 지우면 전부 따라 사라진다', () => {
  assert.deepEqual(undoPlan({ personId: 'p1', eventId: 'e1', entryId: 'n1' }), { kind: 'person', id: 'p1' });
});

test('행사만 새로 만들었으면 행사를 지운다', () => {
  assert.deepEqual(undoPlan({ personId: null, eventId: 'e1', entryId: 'n1' }), { kind: 'event', id: 'e1' });
});

test('기존 사람·기존 행사면 기록만 지운다', () => {
  assert.deepEqual(undoPlan({ personId: null, eventId: null, entryId: 'n1' }), { kind: 'entry', id: 'n1' });
});
