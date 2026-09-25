// 사람 요약 표기 단위 테스트
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  balanceHint,
  displayName,
  distinguishLine,
  duplicateNameKeys,
  needsLabel,
  newPersonLabelRule,
  personSubtitle,
  sameNameCandidates,
} from './person.ts';

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

test('표시 이름은 라벨이 있으면 이름 뒤에 붙인다', () => {
  assert.equal(displayName({ name: '김철수', label: '회사' }), '김철수 · 회사');
  assert.equal(displayName({ name: '김철수', label: '  ' }), '김철수');
  assert.equal(displayName({ name: '김철수' }), '김철수');
  assert.equal(displayName(null), '(이름 없음)');
});

test('같은 이름 두 사람은 라벨이 다르면 구별 줄이 다르다', () => {
  const a = distinguishLine({ name: '김철수', label: '회사', relation_group: 'work', entry_count: 0 });
  const b = distinguishLine({ name: '김철수', label: '고등학교', relation_group: 'work', entry_count: 0 });
  assert.notEqual(a, b);
  assert.ok(a.startsWith('회사'));
});

test('라벨이 없으면 관계 그룹으로 구별된다', () => {
  const a = distinguishLine({ name: '김철수', relation_group: 'work', entry_count: 0 });
  const b = distinguishLine({ name: '김철수', relation_group: 'friend', entry_count: 0 });
  assert.notEqual(a, b);
});

test('라벨도 그룹도 같으면 기록 요약과 최근 시점으로 구별된다', () => {
  const a = distinguishLine({
    name: '김철수', relation_group: 'work', entry_count: 1, given_total: 100000, last_entry_at: '2026-05-18T00:00:00Z',
  });
  const b = distinguishLine({
    name: '김철수', relation_group: 'work', entry_count: 2, given_total: 50000, last_entry_at: '2024-01-03T00:00:00Z',
  });
  assert.notEqual(a, b);
  assert.ok(a.includes('최근 2026.05'));
});

test('데이터로 구별할 수 없는 동명이인에게는 구분 없음을 명시한다', () => {
  const dup = duplicateNameKeys([{ name: '김철수' }, { name: '김철수' }]);
  const line = distinguishLine({ name: '김철수', relation_group: 'work', entry_count: 0 }, dup);
  assert.ok(line.includes('구분 없음'));
});

test('동명이 아니거나 라벨이 있으면 구분 없음이 붙지 않는다', () => {
  const dup = duplicateNameKeys([{ name: '김철수' }, { name: '김철수' }]);
  assert.ok(!distinguishLine({ name: '이영희', relation_group: 'work', entry_count: 0 }, dup).includes('구분 없음'));
  assert.ok(!distinguishLine({ name: '김철수', label: '회사', entry_count: 0 }, dup).includes('구분 없음'));
  assert.ok(!distinguishLine({ name: '김철수', relation_group: 'work', entry_count: 0 }).includes('구분 없음'));
});

test('입력한 이름과 정규화가 같은 사람만 동명 후보다', () => {
  const list = [{ name: '김 철수' }, { name: '김철민' }, { name: '김철수' }];
  assert.deepEqual(sameNameCandidates(list, '김철수').map((p) => p.name), ['김 철수', '김철수']);
  assert.deepEqual(sameNameCandidates(list, ''), []);
});

test('목록에서 두 번 이상 나오는 이름만 중복 키가 된다', () => {
  const keys = duplicateNameKeys([{ name: '김철수' }, { name: '김 철수' }, { name: '이영희' }]);
  assert.equal(keys.size, 1);
  assert.equal(needsLabel({ name: '김철수' }, keys), true);
  assert.equal(needsLabel({ name: '김철수', label: '회사' }, keys), false);
  assert.equal(needsLabel({ name: '이영희' }, keys), false);
});

test('같은 이름이 있으면 라벨이 필수이고 없으면 남은 값을 버린다', () => {
  assert.equal(newPersonLabelRule(false, true, '').error !== null, true);
  assert.deepEqual(newPersonLabelRule(false, true, ' 회사 '), { error: null, label: '회사' });
  assert.deepEqual(newPersonLabelRule(false, false, '회사'), { error: null, label: null });
  assert.deepEqual(newPersonLabelRule(true, true, ''), { error: null, label: null });
});

test('라벨 없는 동명이인은 그룹이 같든 다르든, 끝·가운데 공백이 있든 전부 구분 없음 대상이다', () => {
  const rows = [
    { name: '박지민', relation_group: 'friend' }, { name: '박지민', relation_group: 'friend' },
    { name: '이수진', relation_group: 'work' }, { name: '이수진', relation_group: 'friend' },
    { name: '최민호', relation_group: 'other' }, { name: '최민호 ', relation_group: 'other' },
    { name: '김철수', relation_group: 'work' }, { name: '김 철수', relation_group: 'work' },
    { name: '이영희', relation_group: 'friend' },
  ];
  const keys = duplicateNameKeys(rows);
  assert.deepEqual([...keys].sort(), ['김철수', '박지민', '이수진', '최민호']);
  for (const r of rows) {
    assert.equal(needsLabel(r, keys), r.name !== '이영희', r.name);
  }
});

test('한쪽에만 라벨이 있으면 라벨 없는 쪽만 구분 없음 대상이다 (실계정 모양)', () => {
  const noLabel = { name: '박태준', relation_group: 'friend' };
  const withLabel = { name: '박태준', relation_group: 'friend', label: '회사' };
  const keys = duplicateNameKeys([noLabel, withLabel]);
  assert.equal(needsLabel(noLabel, keys), true);
  assert.equal(needsLabel(withLabel, keys), false);
});
