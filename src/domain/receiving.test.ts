// 받은돈 연속 입력 단위 테스트
import test from 'node:test';
import assert from 'node:assert/strict';
import { carryOver, emptyReceivingDraft, validateReceiving } from './receiving.ts';

function draft(patch: Partial<ReturnType<typeof emptyReceivingDraft>> = {}) {
  return { ...emptyReceivingDraft(), personId: 'p1', amountText: '50000', ...patch };
}

test('기존 사람과 금액이 있으면 통과한다', () => {
  const r = validateReceiving(draft());
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.plan.amount, 50000);
});

test('새 사람 이름으로도 통과한다', () => {
  const r = validateReceiving(draft({ personId: null, newPersonName: ' 박영수 ' }));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.plan.personName, '박영수');
});

test('이름이 비면 막는다', () => {
  assert.equal(validateReceiving(draft({ personId: null, newPersonName: '' })).ok, false);
});

test('금액이 비면 현금이어도 미확정으로 통과한다', () => {
  // 명부 입력에서는 봉투를 아직 안 센 경우가 흔하다. 빠른 기록과 다른 점이다.
  const r = validateReceiving(draft({ amountText: '' }));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.plan.amount, null);
});

test('숫자가 아니면 막는다', () => {
  assert.equal(validateReceiving(draft({ amountText: '오만원' })).ok, false);
});

test('저장 후 다음은 관계 그룹을 유지하고 나머지를 비운다', () => {
  const next = carryOver(draft({ newPersonGroup: 'work', memo: '메모' }));
  assert.equal(next.newPersonGroup, 'work');
  assert.equal(next.personId, null);
  assert.equal(next.newPersonName, '');
  assert.equal(next.amountText, '');
  assert.equal(next.memo, '');
});

test('만원 단위 토글도 유지된다', () => {
  assert.equal(carryOver(draft({ amountUnit: 'manwon' })).amountUnit, 'manwon');
});

test('초안은 이름·금액·메모와 새 사람 정보만 가진다', () => {
  assert.deepEqual(Object.keys(emptyReceivingDraft()).sort(), [
    'amountText',
    'amountUnit',
    'memo',
    'newPersonGroup',
    'newPersonLabel',
    'newPersonName',
    'personId',
    'sameNameCount',
    'wantsNewPerson',
  ]);
});

test('같은 이름이 하나 있어도 그냥 통과한다 — 명부에서 겹치는 이름은 정상이다', () => {
  const r = validateReceiving(draft({ personId: null, newPersonName: '김철수', sameNameCount: 1 }));
  assert.equal(r.ok, true);
});

test('"새 사람"을 고른 경우에만 구분할 말이 필수다', () => {
  const r = validateReceiving(
    draft({ personId: null, newPersonName: '김철수', sameNameCount: 1, wantsNewPerson: true }),
  );
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.some((e) => e.includes('구분할 말')));
});

test('구분할 말을 적으면 라벨로 저장되고 저장 후 다음에서 비워진다', () => {
  const d = draft({ personId: null, newPersonName: '김철수', sameNameCount: 1, wantsNewPerson: true, newPersonLabel: '회사' });
  const r = validateReceiving(d);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.plan.personLabel, '회사');
  const next = carryOver(d);
  assert.equal(next.newPersonLabel, '');
  assert.equal(next.sameNameCount, 0);
  assert.equal(next.wantsNewPerson, false);
});
