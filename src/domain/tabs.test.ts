// 마지막 탭 기억 판정 테스트
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TAB, restoredTabRoute, tabRouteFromPath } from './tabs.ts';

test('탭 경로만 탭으로 인정한다', () => {
  assert.equal(tabRouteFromPath('/'), '/');
  assert.equal(tabRouteFromPath('/records'), '/records');
  assert.equal(tabRouteFromPath('/stats'), '/stats');
  assert.equal(tabRouteFromPath('/more'), '/more');
});

test('탭 안에서 더 들어간 화면은 탭이 아니다', () => {
  // 사람 원장을 보다 앱을 닫았다고 그 화면으로 다시 여는 것은 요청이 아니다.
  assert.equal(tabRouteFromPath('/person/abc'), null);
  assert.equal(tabRouteFromPath('/event/receive'), null);
  assert.equal(tabRouteFromPath('/records/extra'), null);
});

test('물음표 뒤와 끝 슬래시는 무시한다', () => {
  assert.equal(tabRouteFromPath('/stats?year=2026'), '/stats');
  assert.equal(tabRouteFromPath('/records/'), '/records');
  assert.equal(tabRouteFromPath('/'), '/');
});

test('저장된 값이 없거나 더 이상 없는 탭이면 홈으로 연다', () => {
  assert.equal(restoredTabRoute(null), DEFAULT_TAB);
  assert.equal(restoredTabRoute(undefined), DEFAULT_TAB);
  assert.equal(restoredTabRoute(''), DEFAULT_TAB);
  // 예전 버전의 탭 이름이 남아 있는 경우
  assert.equal(restoredTabRoute('/people'), DEFAULT_TAB);
  assert.equal(restoredTabRoute('/events'), DEFAULT_TAB);
});

test('아는 탭이면 그 탭으로 연다', () => {
  assert.equal(restoredTabRoute('/records'), '/records');
  assert.equal(restoredTabRoute('/more'), '/more');
});
