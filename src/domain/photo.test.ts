// 사진 크기 규칙 검증 — 큰 사진은 긴 변 기준으로 줄이고, 무거우면 압축하고, 형식이 다르면 바꾸고, 전부 알린다
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_EDGE, photoTooLargeMessage, planPhoto } from './photo.ts';

test('작고 가벼운 JPEG 는 그대로 올린다', () => {
  const p = planPhoto({ width: 1200, height: 900, bytes: 400_000, mimeType: 'image/jpeg' });
  assert.deepEqual(p, { convert: false, resize: null, notice: '' });
});

test('가로 사진이 크면 폭을 1600 으로 줄인다', () => {
  const p = planPhoto({ width: 4032, height: 3024, bytes: 3_000_000, mimeType: 'image/jpeg' });
  assert.equal(p.convert, true);
  assert.deepEqual(p.resize, { width: MAX_EDGE });
  assert.ok(p.notice.includes('1600px'));
});

test('세로 사진이 크면 높이를 1600 으로 줄인다 — 비율을 지키려고 한 변만 준다', () => {
  const p = planPhoto({ width: 3024, height: 4032, mimeType: 'image/jpeg' });
  assert.deepEqual(p.resize, { height: MAX_EDGE });
});

test('크기는 작아도 용량이 5MB 를 넘으면 압축한다', () => {
  const p = planPhoto({ width: 1500, height: 1000, bytes: 6 * 1024 * 1024, mimeType: 'image/jpeg' });
  assert.equal(p.convert, true);
  assert.equal(p.resize, null);
  assert.ok(p.notice.includes('압축'));
});

test('HEIC 처럼 허용 밖 형식은 JPEG 로 바꾼다', () => {
  const p = planPhoto({ width: 800, height: 600, bytes: 100_000, mimeType: 'image/heic' });
  assert.equal(p.convert, true);
  assert.ok(p.notice.includes('JPEG'));
});

test('용량을 모르면(웹 일부 브라우저) 크기만 본다', () => {
  assert.equal(planPhoto({ width: 1000, height: 1000, bytes: null }).convert, false);
  assert.equal(planPhoto({ width: 5000, height: 1000, bytes: undefined }).convert, true);
});

test('줄인 뒤에도 한도를 넘으면 올리지 않는 문구', () => {
  assert.equal(photoTooLargeMessage(1_000_000), null);
  assert.ok(photoTooLargeMessage(7 * 1024 * 1024)?.includes('7MB'));
});
