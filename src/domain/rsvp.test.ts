// 참석 여부 집계 검증 — 인원은 본인 포함 합, 불참은 인원에서 빠진다
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeRsvp } from './rsvp.ts';

test('참석 인원·측·식사를 인원 단위로 센다', () => {
  const s = summarizeRsvp([
    { side: 'groom', attending: true, party_size: 2, meal: 'yes' },
    { side: 'bride', attending: true, party_size: 3, meal: null },
    { side: 'bride', attending: false, party_size: 0, meal: null },
  ]);
  assert.deepEqual(s, { responses: 3, attendingPeople: 5, absentResponses: 1, bySide: { groom: 2, bride: 3 }, meal: { yes: 2, no: 0, unknown: 3 } });
});

test('빈 목록', () => {
  assert.equal(summarizeRsvp([]).attendingPeople, 0);
});
