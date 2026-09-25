// 홈 방향 탭과 목록 행 조립 규칙 검증
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_DIRECTION,
  daysUntil,
  directionOf,
  entryRowName,
  entryRowNames,
  entryRowSubtitle,
  isMineOf,
  upcomingHint,
} from './home.ts';

test('기본 탭은 준돈이다', () => {
  assert.equal(DEFAULT_DIRECTION, 'given');
});

test('준돈은 내 행사가 아니고 받은돈은 내 행사다', () => {
  assert.equal(isMineOf('given'), false);
  assert.equal(isMineOf('received'), true);
});

test('방향 변환은 양쪽이 서로 뒤집힌다', () => {
  assert.equal(directionOf(false), 'given');
  assert.equal(directionOf(true), 'received');
  assert.equal(isMineOf(directionOf(true)), true);
  assert.equal(isMineOf(directionOf(false)), false);
});

test('부제는 행사 이름과 날짜를 잇는다', () => {
  assert.equal(
    entryRowSubtitle({ title: '김철수 결혼식', date: '2026-05-18', date_precision: 'day' }),
    '김철수 결혼식 · 2026.05.18',
  );
});

test('정밀도가 낮으면 날짜도 줄여 적는다', () => {
  assert.equal(
    entryRowSubtitle({ title: '이영희 조부상', date: '2025-09-01', date_precision: 'month' }),
    '이영희 조부상 · 2025.09',
  );
  assert.equal(
    entryRowSubtitle({ title: '옛 기록', date: '2022-01-01', date_precision: 'year' }),
    '옛 기록 · 2022년',
  );
});

test('행사가 없어도 빈 줄을 돌려주지 않는다', () => {
  assert.equal(entryRowSubtitle(null), '행사 정보 없음');
});

test('행사 이름만 있어도 구분자가 남지 않는다', () => {
  assert.equal(entryRowSubtitle({ title: '제목만', date: null }), '제목만');
});

test('공동 부조자는 이름 뒤에 붙는다', () => {
  assert.equal(entryRowName({ name: '이영희' }, { name: '박민수' }), '이영희 (+박민수)');
  assert.equal(entryRowName({ name: '이영희' }, null), '이영희');
});

test('이름이 비어도 빈 문자열을 그리지 않는다', () => {
  assert.equal(entryRowName(null, null), '(이름 없음)');
});

test('이름 조각은 각자 id를 들고 있어 화면이 문자열을 쪼개지 않는다', () => {
  const parts = entryRowNames({ id: 'p1', name: '이영희' }, { id: 'p2', name: '박민수' });
  assert.deepEqual(parts, [
    { id: 'p1', name: '이영희', co: false },
    { id: 'p2', name: '박민수', co: true },
  ]);
});

test('공동 부조자가 없으면 조각은 하나다', () => {
  assert.deepEqual(entryRowNames({ id: 'p1', name: '이영희' }, null), [
    { id: 'p1', name: '이영희', co: false },
  ]);
});

test('사람이 없어도 조각은 하나 남고 id는 null이다', () => {
  assert.deepEqual(entryRowNames(null, null), [{ id: null, name: '(이름 없음)', co: false }]);
});

test('남은 날짜는 날짜 경계로 센다', () => {
  assert.equal(daysUntil('2026-09-24', '2026-09-24'), 0);
  assert.equal(daysUntil('2026-09-24', '2026-09-25'), 1);
  assert.equal(daysUntil('2026-09-24', '2026-10-01'), 7);
});

test('다가오는 행사 문구는 오늘·내일을 따로 적는다', () => {
  assert.equal(upcomingHint('2026-09-24', '2026-09-24'), '오늘');
  assert.equal(upcomingHint('2026-09-24', '2026-09-25'), '내일');
  assert.equal(upcomingHint('2026-09-24', '2026-09-30'), '6일 뒤');
});

test('이미 지난 날짜도 오늘로 적는다', () => {
  assert.equal(upcomingHint('2026-09-24', '2026-09-20'), '오늘');
});

