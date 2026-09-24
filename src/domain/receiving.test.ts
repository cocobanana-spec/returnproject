// 받은돈 연속 입력 단위 테스트
import test from 'node:test';
import assert from 'node:assert/strict';
import { carryOver, emptyReceivingDraft, switchSide, validateReceiving } from './receiving.ts';

function draft(patch: Partial<ReturnType<typeof emptyReceivingDraft>> = {}) {
  return { ...emptyReceivingDraft('a'), personId: 'p1', amountText: '50000', ...patch };
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

test('공동 부조자가 본인이면 막는다', () => {
  assert.equal(validateReceiving(draft({ coPersonId: 'p1' })).ok, false);
});

test('저장 후 다음은 측·형태·그룹을 유지하고 나머지를 비운다', () => {
  const next = carryOver(
    draft({ newPersonGroup: 'work', method: 'transfer', memo: '메모', coPersonId: 'p2' }),
  );
  assert.equal(next.side, 'a');
  assert.equal(next.newPersonGroup, 'work');
  assert.equal(next.method, 'transfer');
  assert.equal(next.personId, null);
  assert.equal(next.newPersonName, '');
  assert.equal(next.amountText, '');
  assert.equal(next.memo, '');
  assert.equal(next.coPersonId, null);
});

test('만원 단위 토글도 유지된다', () => {
  assert.equal(carryOver(draft({ amountUnit: 'manwon' })).amountUnit, 'manwon');
});

test('측을 바꾸면 관계 그룹 기본값이 초기화된다', () => {
  const next = switchSide(draft({ newPersonGroup: 'work' }), 'b');
  assert.equal(next.side, 'b');
  assert.equal(next.newPersonGroup, 'other');
});
