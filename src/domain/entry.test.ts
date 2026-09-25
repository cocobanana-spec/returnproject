// 기록 표시 단위 테스트
import test from 'node:test';
import assert from 'node:assert/strict';
import { directionLabel, entrySubtitle, isCoEntryFor, amountFieldLabel, validateEntryAmount } from './entry.ts';

test('방향은 행사의 is_mine에서 나온다', () => {
  assert.equal(directionLabel(true), '받은돈');
  assert.equal(directionLabel(false), '준돈');
});

test('공동 부조자 자리에 있으면 공동 기록이다', () => {
  assert.equal(isCoEntryFor({ personId: 'a', coPersonId: 'b', event: null }, 'b'), true);
});

test('대표자면 공동 기록이 아니다', () => {
  assert.equal(isCoEntryFor({ personId: 'a', coPersonId: 'b', event: null }, 'a'), false);
});

test('공동 부조자가 없으면 공동 기록이 아니다', () => {
  assert.equal(isCoEntryFor({ personId: 'a', coPersonId: null, event: null }, 'a'), false);
});

test('부제는 날짜와 종류를 합친다', () => {
  assert.equal(
    entrySubtitle({ title: 'x', type: 'wedding', is_mine: false, date: '2025-05-18', date_precision: 'day' }),
    '2025.05.18 · 결혼식',
  );
});

test('연도만 아는 행사는 연도로 보인다', () => {
  assert.equal(
    entrySubtitle({ title: 'x', type: 'funeral', is_mine: false, date: '2022-01-01', date_precision: 'year' }),
    '2022년 · 장례식',
  );
});

test('행사가 없으면 빈 문자열', () => {
  assert.equal(entrySubtitle(null), '');
});

test('준돈은 빈 금액을 거부한다', () => {
  const r = validateEntryAmount('', false);
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.error.includes('준 돈'));
});

test('받은돈은 빈 금액이 미확정으로 통과한다', () => {
  const r = validateEntryAmount('', true);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.amount, null);
});

test('숫자가 아니면 방향과 무관하게 거부한다', () => {
  assert.equal(validateEntryAmount('십만', false).ok, false);
  assert.equal(validateEntryAmount('십만', true).ok, false);
});

test('콤마가 섞인 금액도 원 단위 정수로 읽는다', () => {
  const r = validateEntryAmount('12,000', false);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.amount, 12000);
});

test('금액 칸 라벨은 받은돈에만 미확정 안내를 붙인다', () => {
  assert.equal(amountFieldLabel(true), '금액 (비워 두면 미확정)');
  assert.equal(amountFieldLabel(false), '금액');
});
