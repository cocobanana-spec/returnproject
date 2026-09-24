// 인증 오류 한국어 매핑 단위 테스트. 영문 원문이 화면에 새지 않는지 본다
import test from 'node:test';
import assert from 'node:assert/strict';
import { mapAuthError, repeatedFailureHint } from './errors.ts';

test('잘못된 자격 증명', () => {
  const r = mapAuthError({ message: 'Invalid login credentials', status: 400 });
  assert.equal(r.kind, 'invalid_credentials');
  assert.ok(r.message.includes('비밀번호가 올바르지'));
});

test('메일 미확인', () => {
  assert.equal(mapAuthError({ message: 'Email not confirmed', status: 400 }).kind, 'email_not_confirmed');
  assert.equal(mapAuthError({ code: 'email_not_confirmed' }).kind, 'email_not_confirmed');
});

test('이미 가입된 메일', () => {
  assert.equal(mapAuthError({ message: 'User already registered' }).kind, 'already_registered');
});

test('약한 비밀번호', () => {
  assert.equal(
    mapAuthError({ message: 'Password should be at least 6 characters' }).kind,
    'weak_password',
  );
  assert.equal(mapAuthError({ code: 'weak_password' }).kind, 'weak_password');
});

test('이전과 같은 비밀번호', () => {
  assert.equal(
    mapAuthError({ message: 'New password should be different from the old password.' }).kind,
    'same_password',
  );
});

test('속도 제한은 다른 무엇보다 먼저 잡는다', () => {
  assert.equal(mapAuthError({ status: 429, message: 'Invalid login credentials' }).kind, 'rate_limited');
  assert.equal(
    mapAuthError({ message: 'For security purposes, you can only request this after 46 seconds' }).kind,
    'rate_limited',
  );
});

test('만료된 링크', () => {
  assert.equal(mapAuthError({ code: 'otp_expired' }).kind, 'expired_link');
});

test('네트워크', () => {
  assert.equal(mapAuthError({ message: 'Network request failed' }).kind, 'network');
});

test('모르는 오류는 원문을 버리고 일반 문구로 바꾼다', () => {
  const r = mapAuthError({ message: 'Something exploded on the server' });
  assert.equal(r.kind, 'unknown');
  // 원문 조각이 섞여 나가지 않는지가 핵심이다.
  assert.ok(!r.message.includes('exploded'));
  assert.ok(!r.message.includes('server'));
  assert.equal(r.message, '문제가 생겼습니다. 잠시 뒤에 다시 시도해 주세요.');
});

test('null 입력도 안전하다', () => {
  assert.equal(mapAuthError(null).kind, 'unknown');
});

test('연속 실패 안내는 3회부터', () => {
  assert.equal(repeatedFailureHint(2), null);
  assert.ok(repeatedFailureHint(3)?.includes('재설정'));
});
