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

import { filterRsvp, rsvpCsv, rsvpShareText } from './rsvp.ts';
const rows = [
  { name: '김하객', side: 'groom', attending: true, party_size: 2, meal: 'yes', message: '축하, "진심"', created_at: '2026-10-02T01:48:00Z' },
  { name: '이하객', side: 'bride', attending: true, party_size: 1, meal: null, message: null, created_at: '2026-10-03T01:48:00Z' },
  { name: '박하객', side: 'bride', attending: false, party_size: 0, meal: null, message: null, created_at: '2026-10-04T01:48:00Z' },
];

test('필터 — 측은 참석한 사람만, 불참 따로, 이름 검색', () => {
  assert.deepEqual(filterRsvp(rows, 'bride', '').map((r) => r.name), ['이하객']);
  assert.deepEqual(filterRsvp(rows, 'absent', '').map((r) => r.name), ['박하객']);
  assert.deepEqual(filterRsvp(rows, 'all', '김').map((r) => r.name), ['김하객']);
});

test('CSV — BOM, 머리, 따옴표 이스케이프', () => {
  const csv = rsvpCsv(rows);
  assert.ok(csv.startsWith('﻿이름,측,참석,인원,식사,한마디,보낸 때\n'));
  assert.ok(csv.includes('김하객,신랑측,참석,2,식사,"축하, ""진심""",2026-10-02 01:48'));
  assert.ok(csv.includes('박하객,신부측,불참,0,,,'));
});

test('공유 글 — 요약과 참석자 줄', () => {
  const text = rsvpShareText('우리 결혼식', rows);
  assert.ok(text.startsWith('[우리 결혼식] 참석 여부\n참석 3명 (신랑측 2 · 신부측 1) · 불참 1건'));
  assert.ok(text.includes('· 김하객 (신랑측) 2명 · 식사'));
  assert.ok(!text.includes('박하객'));
});
