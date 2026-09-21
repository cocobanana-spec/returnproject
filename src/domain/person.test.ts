// 사람 요약 표기 단위 테스트
import test from 'node:test';
import assert from 'node:assert/strict';
import { balanceHint, personSubtitle } from './person.ts';

test('구분 라벨이 관계 그룹보다 앞에 온다', () => {
  assert.equal(personSubtitle({ name: '김철수', label: '회사 동기', relation_group: 'work' }), '회사 동기 · 직장');
});

test('라벨이 없으면 관계 그룹만 보인다', () => {
  assert.equal(personSubtitle({ name: '김철수', relation_group: 'friend' }), '친구');
});

test('단체는 따로 표시된다', () => {
  assert.equal(personSubtitle({ name: '영업1팀 일동', relation_group: 'work', kind: 'group' }), '직장 · 단체');
});

test('아무 정보도 없으면 빈 문자열', () => {
  assert.equal(personSubtitle({ name: '김철수' }), '');
});

test('기록이 없으면 기록 없음', () => {
  assert.equal(balanceHint({ name: '김철수', entry_count: 0 }), '기록 없음');
});

test('준 돈과 받은 돈을 함께 요약한다', () => {
  assert.equal(
    balanceHint({ name: '김철수', entry_count: 2, given_total: 100000, received_total: 50000 }),
    '준 10만원 · 받은 5만원',
  );
});

test('한쪽만 있으면 그쪽만 보인다', () => {
  assert.equal(balanceHint({ name: '김철수', entry_count: 1, given_total: 100000 }), '준 10만원');
});

test('기록은 있는데 금액이 0이면 건수만 보인다', () => {
  assert.equal(balanceHint({ name: '김철수', entry_count: 1, given_total: 0, received_total: 0 }), '기록 1건');
});
