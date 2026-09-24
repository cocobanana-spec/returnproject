// 비밀번호 규칙과 메일 형식 단위 테스트
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PASSWORD_MAX_BYTES,
  byteLength,
  isLikelyEmail,
  normalizeEmail,
  validatePassword,
  validatePasswordConfirm,
} from './password.ts';

test('영문과 숫자가 모두 있는 8자는 통과한다', () => {
  assert.equal(validatePassword('abcd1234').ok, true);
});

test('8자 미만은 막는다', () => {
  const r = validatePassword('abc1234');
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.some((e) => e.includes('8자 이상')));
});

test('숫자가 없으면 막는다', () => {
  const r = validatePassword('abcdefgh');
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.some((e) => e.includes('숫자')));
});

test('영문이 없으면 막는다', () => {
  const r = validatePassword('12345678');
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.some((e) => e.includes('영문')));
});

test('공백이 있으면 막는다', () => {
  const r = validatePassword('abcd 1234');
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.some((e) => e.includes('공백')));
});

test('bcrypt 바이트 한계 경계', () => {
  // ASCII 72자는 정확히 72바이트라 통과하고, 73자는 막힌다.
  const ok72 = 'a1'.repeat(35) + 'ab'; // 72자
  assert.equal(byteLength(ok72), 72);
  assert.equal(validatePassword(ok72).ok, true);
  assert.equal(validatePassword(ok72 + 'x').ok, false);
});

test('한글은 글자 수가 아니라 바이트로 잰다', () => {
  // 한글 1자는 UTF-8로 3바이트다. 25자면 75바이트라 72를 넘는다.
  const korean = '가'.repeat(25) + 'a1';
  assert.ok(korean.length < PASSWORD_MAX_BYTES, '글자 수로는 한계 안이다');
  assert.ok(byteLength(korean) > PASSWORD_MAX_BYTES, '바이트로는 한계를 넘는다');
  assert.equal(validatePassword(korean).ok, false);
});

test('확인란이 다르면 막는다', () => {
  const r = validatePasswordConfirm('abcd1234', 'abcd12345');
  assert.equal(r.ok, false);
  if (!r.ok) assert.deepEqual(r.errors, ['비밀번호가 서로 다릅니다.']);
});

test('확인란 검사는 규칙 위반을 먼저 알린다', () => {
  const r = validatePasswordConfirm('abc', 'abc');
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.some((e) => e.includes('8자 이상')));
});

test('같으면 통과한다', () => {
  assert.equal(validatePasswordConfirm('abcd1234', 'abcd1234').ok, true);
});

test('메일 형식', () => {
  assert.equal(isLikelyEmail('a@b.com'), true);
  assert.equal(isLikelyEmail('김철수@example.co.kr'), true);
  assert.equal(isLikelyEmail('abc'), false);
  assert.equal(isLikelyEmail('a@b'), false);
  assert.equal(isLikelyEmail('a b@c.com'), false);
  assert.equal(isLikelyEmail('a@@b.com'), false);
});

test('메일은 소문자로 다듬는다', () => {
  assert.equal(normalizeEmail('  Kim@Example.COM '), 'kim@example.com');
});
