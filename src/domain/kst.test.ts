// 접속 기록의 날짜 기준 검증 — 서버(0011)와 같은 한국 날짜여야 "오늘"이 어긋나지 않는다
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { kstDay } from '../domain/kst.ts';

test('UTC 자정 직전은 한국에서는 이미 다음 날이다', () => {
  assert.equal(kstDay(new Date('2026-10-04T15:30:00Z')), '2026-10-05');
  assert.equal(kstDay(new Date('2026-10-04T14:59:00Z')), '2026-10-04');
});

test('한국 자정 직후', () => {
  assert.equal(kstDay(new Date('2026-10-03T15:00:00Z')), '2026-10-04');
});
