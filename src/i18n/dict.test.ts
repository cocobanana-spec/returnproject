// 사전 검증 — 세 언어에 같은 키가 있고, 치환이 되고, 모르는 언어는 한국어로 떨어진다
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DICTS, LOCALES, localeFromTag, translate } from './dict.ts';

test('모든 키가 세 언어에 다 있다 — 한 언어에만 있는 키는 빈 글자로 보이게 된다', () => {
  const ko = Object.keys(DICTS.ko).sort();
  for (const l of LOCALES) {
    const keys = Object.keys(DICTS[l]).sort();
    const missing = ko.filter((k) => !keys.includes(k));
    const extra = keys.filter((k) => !ko.includes(k));
    assert.deepEqual(missing, [], `${l} 에 빠진 키`);
    assert.deepEqual(extra, [], `${l} 에만 있는 키`);
  }
});

test('값이 비어 있는 키가 없다', () => {
  for (const l of LOCALES) {
    for (const [k, v] of Object.entries(DICTS[l])) assert.ok(v.trim().length > 0, `${l}.${k}`);
  }
});

test('자리 치환 — 세 언어의 자리 이름이 같다', () => {
  const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const k of Object.keys(DICTS.ko)) {
    const ref = holes(DICTS.ko[k]!);
    for (const l of LOCALES) assert.deepEqual(holes(DICTS[l][k]!), ref, `${l}.${k} 자리 불일치`);
  }
  assert.equal(translate('en', 'home.unconfirmedExcluded', { n: 3 }), '3 unconfirmed entries are not included.');
  assert.equal(translate('ja', 'more.exportDone', { n: 12 }), '12 件をダウンロードしました。');
});

test('없는 키는 한국어로, 한국어에도 없으면 키 그대로', () => {
  assert.equal(translate('en', 'tab.home'), 'Home');
  assert.equal(translate('en', 'no.such.key'), 'no.such.key');
});

test('기기 언어 태그 → 우리 언어', () => {
  assert.equal(localeFromTag('en-US'), 'en');
  assert.equal(localeFromTag('ja-JP'), 'ja');
  assert.equal(localeFromTag('ko-KR'), 'ko');
  assert.equal(localeFromTag('fr-FR'), 'ko');
  assert.equal(localeFromTag(null), 'ko');
});
