// 기록 표시 단위 테스트
import test from 'node:test';
import assert from 'node:assert/strict';
import { directionLabel, entrySubtitle, isCoEntryFor } from './entry.ts';

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
