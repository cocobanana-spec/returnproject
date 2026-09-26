// 장부 초기화 확인 규칙 테스트
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canResetLedger,
  isEmptyLedger,
  resetDoneLine,
  resetWarningLine,
} from './resetLedger.ts';

test('장부 이름을 그대로 입력해야 초기화할 수 있다', () => {
  assert.equal(canResetLedger('뿌린대로거두리라', '뿌린대로거두리라'), true);
  assert.equal(canResetLedger('뿌린대로거두리라', '  뿌린대로거두리라  '), true);
  assert.equal(canResetLedger('뿌린대로거두리라', '뿌린대로'), false);
  assert.equal(canResetLedger('뿌린대로거두리라', ''), false);
});

test('가운데 공백까지 무시하지는 않는다 — 확인의 무게가 사라진다', () => {
  assert.equal(canResetLedger('내 장부', '내장부'), false);
  assert.equal(canResetLedger('내 장부', '내 장부'), true);
});

test('장부 이름을 모르면 어떤 입력으로도 켜지지 않는다', () => {
  assert.equal(canResetLedger(null, ''), false);
  assert.equal(canResetLedger(undefined, '아무거나'), false);
  assert.equal(canResetLedger('   ', '   '), false);
});

test('지워질 건수를 실제 숫자로 읽어 준다', () => {
  assert.equal(
    resetWarningLine({ people: 137, events: 3, entries: 260 }),
    '사람 137명 · 행사 3건 · 기록 260건이 사라집니다.',
  );
});

test('빈 장부를 알아보고 지운 뒤 문구도 달라진다', () => {
  assert.equal(isEmptyLedger({ people: 0, events: 0, entries: 0 }), true);
  assert.equal(isEmptyLedger({ people: 0, events: 1, entries: 0 }), false);
  assert.equal(resetDoneLine({ people: 0, events: 0, entries: 0 }), '지울 것이 없었습니다.');
  assert.equal(
    resetDoneLine({ people: 2, events: 1, entries: 5 }),
    '사람 2명 · 행사 1건 · 기록 5건을 지웠습니다.',
  );
});
