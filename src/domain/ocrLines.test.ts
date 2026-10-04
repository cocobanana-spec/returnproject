// 사진 글줄 → 가져오기 표 검증 — 이름·금액 분리, 단위, 못 읽은 줄 보존, 머리글 제거
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { linesToTable, parseOcrLine } from './ocrLines.ts';

test('이름 뒤 금액 — 쉼표·만원·만·원 전부', () => {
  assert.deepEqual(parseOcrLine('김철수 100,000'), { name: '김철수', amount: '100,000', raw: '김철수 100,000' });
  assert.equal(parseOcrLine('이영희 10만원')?.amount, '10만원');
  assert.equal(parseOcrLine('박지호 5만')?.amount, '5만');
  assert.equal(parseOcrLine('최수아 50000원')?.amount, '50000원');
  assert.equal(parseOcrLine('한지우  :  30,000')?.name, '한지우');
});

test('금액이 앞에 와도 되고, 구분 기호는 이름에서 뺀다', () => {
  assert.deepEqual(parseOcrLine('100,000 · 김철수'), { name: '김철수', amount: '100,000', raw: '100,000 · 김철수' });
  assert.equal(parseOcrLine('김철수 - 10만원')?.name, '김철수');
});

test('3자리 이하 숫자는 금액이 아니다 — 번호·순번', () => {
  assert.deepEqual(parseOcrLine('12 김철수 100,000'), { name: '12 김철수', amount: '100,000', raw: '12 김철수 100,000' });
  assert.equal(parseOcrLine('3 박지호')?.amount, '');
});

test('금액을 못 읽은 줄은 이름만 남겨 사용자가 고치게 한다', () => {
  assert.deepEqual(parseOcrLine('김철수 축의'), { name: '김철수 축의', amount: '', raw: '김철수 축의' });
  assert.equal(parseOcrLine('   '), null);
});

test('표로 — 머리글·빈 줄은 빠지고 두 열이다', () => {
  const t = linesToTable(['이름  금액', '김철수 100,000', '', '이영희 10만원', '합계', '박지호']);
  assert.deepEqual(t, [['김철수', '100,000'], ['이영희', '10만원'], ['박지호', '']]);
});
