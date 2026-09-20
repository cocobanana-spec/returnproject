// 행사 제목·날짜 정밀도 단위 테스트
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  autoEventTitle,
  coerceDateToPrecision,
  dateWindow,
  formatEventDate,
  todayISO,
} from './title.ts';

test('남의 행사 제목에는 당사자 이름과 연도가 들어간다', () => {
  assert.equal(
    autoEventTitle({ type: 'wedding', isMine: false, hostName: '김철수', date: '2025-05-18' }),
    '김철수 결혼식 2025',
  );
});

test('같은 사람의 같은 종류 행사는 연도로 구분된다', () => {
  const a = autoEventTitle({ type: 'funeral', isMine: false, hostName: '김철수', date: '2024-11-11' });
  const b = autoEventTitle({ type: 'funeral', isMine: false, hostName: '김철수', date: '2026-02-02' });
  assert.notEqual(a, b);
});

test('내 행사 제목에는 당사자가 없다', () => {
  assert.equal(
    autoEventTitle({ type: 'first_birthday', isMine: true, hostName: null, date: '2026-03-01' }),
    '내 돌잔치',
  );
});

test('당사자 이름이 비어도 제목은 만들어진다', () => {
  assert.equal(
    autoEventTitle({ type: 'opening', isMine: false, hostName: '  ', date: '2026-01-01' }),
    '개업 2026',
  );
});

test('정밀도에 따라 날짜 표기가 달라진다', () => {
  assert.equal(formatEventDate('2024-05-18', 'day'), '2024.05.18');
  assert.equal(formatEventDate('2024-05-01', 'month'), '2024.05');
  assert.equal(formatEventDate('2022-01-01', 'year'), '2022년');
});

test('정밀도를 낮추면 저장 날짜가 맞춰진다', () => {
  assert.equal(coerceDateToPrecision('2022-07-19', 'year'), '2022-01-01');
  assert.equal(coerceDateToPrecision('2022-07-19', 'month'), '2022-07-01');
  assert.equal(coerceDateToPrecision('2022-07-19', 'day'), '2022-07-19');
});

test('오늘 날짜는 로컬 기준 YYYY-MM-DD다', () => {
  assert.equal(todayISO(new Date(2026, 0, 5)), '2026-01-05');
  assert.match(todayISO(), /^\d{4}-\d{2}-\d{2}$/);
});

test('기존 행사 판정 범위는 앞뒤 7일이다', () => {
  assert.deepEqual(dateWindow('2026-03-10'), { from: '2026-03-03', to: '2026-03-17' });
});

test('판정 범위는 달을 넘어도 맞는다', () => {
  assert.deepEqual(dateWindow('2026-03-02'), { from: '2026-02-23', to: '2026-03-09' });
});
