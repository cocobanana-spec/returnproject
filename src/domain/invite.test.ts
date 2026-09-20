// 초대 코드 입력 정규화 단위 테스트. 서버 join_ledger의 정규화와 같은 결과여야 한다
import test from 'node:test';
import assert from 'node:assert/strict';
import { INVITE_CODE_ALPHABET, isValidInviteCode, normalizeInviteCode } from './invite.ts';

test('소문자와 공백이 섞여도 정규화된다', () => {
  assert.equal(normalizeInviteCode(' k7pm 3xq2 '), 'K7PM3XQ2');
});

test('올바른 코드는 통과한다', () => {
  assert.equal(isValidInviteCode('K7PM3XQ2'), true);
  assert.equal(isValidInviteCode(' k7pm3xq2'), true);
});

test('길이가 8이 아니면 거부한다', () => {
  assert.equal(isValidInviteCode('K7PM3XQ'), false);
  assert.equal(isValidInviteCode('K7PM3XQ23'), false);
});

test('혼동 문자 0·O·1·I는 코드에 쓰이지 않는다', () => {
  for (const ch of ['0', 'O', '1', 'I']) {
    assert.equal(INVITE_CODE_ALPHABET.includes(ch), false, `${ch} 가 알파벳에 있으면 안 된다`);
  }
  assert.equal(isValidInviteCode('K7PM3XQO'), false);
  assert.equal(isValidInviteCode('K7PM3XQ0'), false);
});
