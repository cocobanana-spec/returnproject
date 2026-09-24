// 금액 파싱 단위 테스트. 원 단위 정수 하나만 밖으로 나가야 한다
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_AMOUNT_WON,
  formatBalance,
  formatWon,
  formatWonShort,
  parseAmountInput,
} from './money.ts';

test('원 단위 입력은 그대로 정수가 된다', () => {
  assert.equal(parseAmountInput('100000'), 100000);
  assert.equal(parseAmountInput('100,000'), 100000);
  assert.equal(parseAmountInput(' 50 000 '), 50000);
});

test('만원 단위 토글은 입력 경계에서만 10000을 곱한다', () => {
  assert.equal(parseAmountInput('10', 'manwon'), 100000);
  assert.equal(parseAmountInput('5', 'manwon'), 50000);
  assert.equal(parseAmountInput('10', 'won'), 10);
});

test('빈 입력은 미확정(null)이다', () => {
  assert.equal(parseAmountInput(''), null);
  assert.equal(parseAmountInput('   '), null);
});

test('숫자가 아니거나 음수면 입력 오류(undefined)다', () => {
  assert.equal(parseAmountInput('abc'), undefined);
  assert.equal(parseAmountInput('-1'), undefined);
  assert.equal(parseAmountInput('1.5'), undefined);
});

test('0원은 유효한 값이다(부조 없음)', () => {
  assert.equal(parseAmountInput('0'), 0);
});

test('상한을 넘으면 입력 오류다', () => {
  assert.equal(parseAmountInput(String(MAX_AMOUNT_WON)), MAX_AMOUNT_WON);
  assert.equal(parseAmountInput(String(MAX_AMOUNT_WON + 1)), undefined);
  assert.equal(parseAmountInput('100001', 'manwon'), undefined);
});

test('표시 형식', () => {
  assert.equal(formatWon(100000), '100,000원');
  assert.equal(formatWon(null), '미확정');
  assert.equal(formatWonShort(100000), '10만원');
  assert.equal(formatWonShort(105000), '105,000원');
  assert.equal(formatWonShort(0), '0원');
});


test('수지 방향 표기', () => {
  assert.equal(formatBalance(50000).direction, 'given');
  assert.equal(formatBalance(-50000).direction, 'received');
  assert.equal(formatBalance(0).direction, 'even');
  assert.equal(formatBalance(-50000).text, '50,000원 더 받음');
});
