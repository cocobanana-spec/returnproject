// 인증 딥링크 해석 단위 테스트. 개발용 exp:// 와 배포용 ppurin:// 둘 다 본다
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAuthLink } from './links.ts';

test('개발용 exp 주소의 재설정 링크', () => {
  const r = parseAuthLink('exp://127.0.0.1:8081/--/auth/reset?code=abc123');
  assert.equal(r.kind, 'reset');
  assert.equal(r.code, 'abc123');
});

test('배포용 스킴의 재설정 링크', () => {
  const r = parseAuthLink('ppurin://auth/reset?code=abc123');
  assert.equal(r.kind, 'reset');
  assert.equal(r.code, 'abc123');
});

test('확인 메일 링크', () => {
  assert.equal(parseAuthLink('ppurin://auth/confirm?code=xyz').kind, 'confirm');
  assert.equal(parseAuthLink('exp://10.0.0.2:8081/--/auth/confirm?code=xyz').kind, 'confirm');
});

test('인증과 무관한 딥링크', () => {
  assert.equal(parseAuthLink('ppurin://person/abc').kind, 'other');
  assert.equal(parseAuthLink('exp://127.0.0.1:8081/--/people').kind, 'other');
});

test('코드가 없으면 null', () => {
  assert.equal(parseAuthLink('ppurin://auth/reset').code, null);
  assert.equal(parseAuthLink('ppurin://auth/reset?code=').code, null);
});

test('오류를 달고 돌아오는 경우', () => {
  const r = parseAuthLink(
    'ppurin://auth/confirm?error=access_denied&error_description=Email+link+is+invalid+or+has+expired',
  );
  assert.equal(r.code, null);
  assert.equal(r.errorDescription, 'Email link is invalid or has expired');
});

test('여러 파라미터가 섞여도 코드를 찾는다', () => {
  const r = parseAuthLink('ppurin://auth/reset?foo=1&code=zzz&bar=2');
  assert.equal(r.code, 'zzz');
});

test('경로 끝에 슬래시가 있어도 된다', () => {
  assert.equal(parseAuthLink('ppurin://auth/reset/?code=q').kind, 'reset');
});

test('비슷한 이름의 경로는 걸리지 않는다', () => {
  assert.equal(parseAuthLink('ppurin://myauth/reset?code=q').kind, 'other');
});

test('오류가 프래그먼트로 와도 읽는다', () => {
  const r = parseAuthLink(
    'ppurin://auth/reset#error=access_denied&error_description=Email+link+is+invalid+or+has+expired',
  );
  assert.equal(r.kind, 'reset');
  assert.equal(r.errorDescription, 'Email link is invalid or has expired');
});

test('값에 =가 들어가도 뒤를 버리지 않는다', () => {
  assert.equal(parseAuthLink('ppurin://auth/reset?code=a=b=c').code, 'a=b=c');
});

test('깨진 퍼센트 인코딩에도 터지지 않는다', () => {
  const r = parseAuthLink('ppurin://auth/reset?code=%zz');
  assert.equal(r.kind, 'reset');
  assert.equal(r.code, '%zz');
});

test('OAuth 복귀 주소는 callback 으로 읽는다 — 앱·웹 모두', () => {
  assert.equal(parseAuthLink('ppurin://auth/callback?code=abc').kind, 'callback');
  assert.equal(
    parseAuthLink('https://user.github.io/returnproject/app/auth/callback?code=abc').kind,
    'callback',
  );
  // 프로바이더가 거부하면 code 없이 error_description 만 온다. 이것이 화면에 떠야 한다.
  const denied = parseAuthLink(
    'https://user.github.io/returnproject/app/auth/callback?error=access_denied&error_description=User+denied',
  );
  assert.equal(denied.kind, 'callback');
  assert.equal(denied.code, null);
  assert.equal(denied.errorDescription, 'User denied');
});

test('웹 주소의 메일 링크도 종류를 알아본다', () => {
  assert.equal(parseAuthLink('https://user.github.io/returnproject/app/auth/reset?code=a').kind, 'reset');
  assert.equal(parseAuthLink('https://user.github.io/returnproject/app/auth/confirm?code=a').kind, 'confirm');
  // 비슷하지만 다른 경로는 걸리지 않는다
  assert.equal(parseAuthLink('https://user.github.io/app/myauth/reset?code=a').kind, 'other');
});
