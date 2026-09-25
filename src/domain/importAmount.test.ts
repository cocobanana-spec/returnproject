// 가져오기 금액 파싱 단위 테스트
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseImportedAmount } from './importAmount.ts';

function amount(cell: string | number | null | undefined) {
  const r = parseImportedAmount(cell);
  return r.ok ? r.amount : `오류:${r.reason}`;
}

test('통화 서식 문자열을 읽는다', () => {
  assert.equal(amount('₩100,000'), 100000);
  assert.equal(amount('100,000'), 100000);
  assert.equal(amount('100000원'), 100000);
  assert.equal(amount('100,000 원'), 100000);
});

test('한글 단위를 읽는다', () => {
  assert.equal(amount('10만'), 100000);
  assert.equal(amount('10만원'), 100000);
  assert.equal(amount('15만 원'), 150000);
  assert.equal(amount('1만5천'), 15000);
  assert.equal(amount('3천'), 3000);
  assert.equal(amount('1억'), 100000000);
});

test('숫자 셀은 그대로 원이다', () => {
  assert.equal(amount(100000), 100000);
  assert.equal(amount(15000.0), 15000);
});

test('단위 없는 작은 수는 원으로 읽되 unitless로 표시한다', () => {
  const r = parseImportedAmount('10');
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.amount, 10);
    assert.equal(r.unitless, true);
  }
  const big = parseImportedAmount('100000');
  if (big.ok) assert.equal(big.unitless, false);
  const korean = parseImportedAmount('10만');
  if (korean.ok) assert.equal(korean.unitless, false);
});

test('음수·0·해석 불가·빈 값은 오류다', () => {
  assert.equal(amount('-10000'), '오류:negative');
  assert.equal(amount('0'), '오류:zero');
  assert.equal(amount('화환'), '오류:unreadable');
  assert.equal(amount('10.5'), '오류:unreadable');
  assert.equal(amount(''), '오류:empty');
  assert.equal(amount(null), '오류:empty');
  assert.equal(amount('1,00,000'), '오류:unreadable');
});

test('상한을 넘으면 오류다', () => {
  assert.equal(amount('20억'), '오류:too_large');
});
