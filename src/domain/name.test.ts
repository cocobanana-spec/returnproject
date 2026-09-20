// 이름 정규화 단위 테스트. DB와의 실제 대조는 supabase/tests/app_integration.mjs 가 따로 한다
import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidName, normalizeName, toSearchPrefix, trimName } from './name.ts';

test('정규화는 공백을 모두 지우고 소문자로 만든다', () => {
  assert.equal(normalizeName(' 김 철수 '), '김철수');
  assert.equal(normalizeName('Kim Chulsoo'), 'kimchulsoo');
  assert.equal(normalizeName('\t김\n철수\r'), '김철수');
});

test('정규화는 NFC를 적용해 분해된 한글을 합친다', () => {
  const decomposed = '김철수'.normalize('NFD');
  assert.notEqual(decomposed, '김철수');
  assert.equal(normalizeName(decomposed), '김철수');
});

test('정규화는 멱등이다', () => {
  const once = normalizeName(' 김 철 수 ');
  assert.equal(normalizeName(once), once);
});

test('trimName은 앞뒤 공백을 없애고 가운데 공백을 하나로 줄인다', () => {
  assert.equal(trimName('  김   철수  '), '김 철수');
  assert.equal(trimName('영업1팀 일동'), '영업1팀 일동');
});

test('공백뿐인 이름은 저장할 수 없다', () => {
  assert.equal(isValidName('   '), false);
  assert.equal(isValidName('\t\n'), false);
  assert.equal(isValidName(''), false);
});

test('50자를 넘는 이름은 저장할 수 없다', () => {
  assert.equal(isValidName('가'.repeat(50)), true);
  assert.equal(isValidName('가'.repeat(51)), false);
});

test('검색 prefix는 저장된 정규화 값과 같은 규칙을 쓴다', () => {
  assert.equal(toSearchPrefix('김 ㅊ'), normalizeName('김 ㅊ'));
  assert.equal(toSearchPrefix('KIM'), 'kim');
});
