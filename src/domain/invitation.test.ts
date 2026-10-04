// 청첩장·부고장 내용 규칙 검증 — 필수 칸, 길이, 날짜 형식, 종류 대응, 만료 안내, 공유 주소
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  emptyContent,
  expiryLabel,
  invitationKindForEvent,
  maxMonths,
  shareTitle,
  shareUrl,
  templatesFor,
  validateFuneral,
  validateInvitation,
  validateWedding,
  type FuneralContent,
  type WeddingContent,
} from './invitation.ts';

const wedding: WeddingContent = {
  groom: { name: '김철수', father: '김아버지', mother: '박어머니' },
  bride: { name: '이영희' },
  date: '2027-05-01',
  time: '12:30',
  venue: { name: '서울 웨딩홀', hall: '3층 그랜드홀', address: '서울시 강남구 테헤란로 1' },
  greeting: '와 주세요.',
  accounts: [{ side: 'groom', holder: '김철수', bank: '국민', number: '123-456' }],
};

const funeral: FuneralContent = {
  deceased: { name: '김아버지', age: 82, title: '아버지' },
  chiefMourners: [{ relation: '아들', name: '김철수' }],
  mortuary: { name: '서울병원 장례식장', room: '3호실' },
  funeralAt: '2026-11-03 08:00',
  accounts: [{ holder: '김철수', bank: '국민', number: '123-456' }],
};

test('행사 종류가 청첩장 종류를 정한다 — 돌잔치는 아직 없다', () => {
  assert.equal(invitationKindForEvent('wedding'), 'wedding');
  assert.equal(invitationKindForEvent('funeral'), 'funeral');
  assert.equal(invitationKindForEvent('first_birthday'), null);
  assert.equal(invitationKindForEvent('opening'), null);
});

test('종류별 템플릿이 하나 이상 있고 무료 템플릿이 있다', () => {
  for (const kind of ['wedding', 'funeral'] as const) {
    const ts = templatesFor(kind);
    assert.ok(ts.length >= 1);
    assert.ok(ts.some((t) => t.free));
  }
});

test('빈 내용은 발행할 수 없고, 어느 칸이 비었는지 사람 말로 알려 준다', () => {
  const w = validateWedding(emptyContent('wedding'));
  assert.equal(w.ok, false);
  if (!w.ok) {
    assert.ok(w.errors.some((e) => e.includes('신랑 이름')));
    assert.ok(w.errors.some((e) => e.includes('예식 날짜')));
    assert.ok(w.errors.some((e) => e.includes('예식장')));
  }
  const f = validateFuneral(emptyContent('funeral'));
  assert.equal(f.ok, false);
  if (!f.ok) {
    assert.ok(f.errors.some((e) => e.includes('고인 성함')));
    assert.ok(f.errors.some((e) => e.includes('상주')));
    assert.ok(f.errors.some((e) => e.includes('발인')));
  }
});

test('채운 청첩장과 부고장은 통과한다', () => {
  assert.deepEqual(validateInvitation('wedding', wedding), { ok: true });
  assert.deepEqual(validateInvitation('funeral', funeral), { ok: true });
});

test('날짜·시간 형식이 틀리면 막는다', () => {
  const r = validateWedding({ ...wedding, date: '2027/05/01', time: '12시' });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.errors.length, 2);
  const f = validateFuneral({ ...funeral, funeralAt: '2026-11-03' });
  assert.equal(f.ok, false);
});

test('청첩장 계좌는 측이 있어야 하고, 부고장 계좌는 측이 없어도 된다', () => {
  const r = validateWedding({ ...wedding, accounts: [{ holder: '김', bank: '국민', number: '1' }] });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.some((e) => e.includes('신랑 측인지')));
  assert.deepEqual(validateFuneral({ ...funeral, accounts: [{ holder: '김', bank: '국민', number: '1' }] }), { ok: true });
});

test('너무 긴 값은 막는다 — 인사말 1000자, 사진 20장, 상주 12명', () => {
  assert.equal(validateWedding({ ...wedding, greeting: 'a'.repeat(1001) }).ok, false);
  assert.equal(validateWedding({ ...wedding, gallery: new Array(21).fill('p') }).ok, false);
  assert.equal(validateWedding({ ...wedding, gallery: new Array(20).fill('p') }).ok, true);
  const many = new Array(13).fill({ relation: '아들', name: '김' });
  assert.equal(validateFuneral({ ...funeral, chiefMourners: many }).ok, false);
});

test('내용이 아예 없거나 객체가 아니면 한 줄로 거부한다', () => {
  assert.deepEqual(validateInvitation('wedding', null), { ok: false, errors: ['내용이 비어 있습니다.'] });
  assert.deepEqual(validateInvitation('funeral', 'x'), { ok: false, errors: ['내용이 비어 있습니다.'] });
});

test('만료 안내 — 남은 날, 오늘, 만료됨', () => {
  const now = new Date('2026-10-04T00:00:00Z');
  assert.equal(expiryLabel('2026-10-16T00:00:00Z', now), '12일 남음');
  assert.equal(expiryLabel('2026-10-04T00:00:00Z', now), '오늘 만료');
  assert.equal(expiryLabel('2026-10-01T00:00:00Z', now), '만료됨');
  assert.equal(expiryLabel(null, now), '');
});

test('요금제별 최대 개월은 서버와 같다 — 무료 3, 프리미엄 12', () => {
  assert.equal(maxMonths('free'), 3);
  assert.equal(maxMonths('premium'), 12);
});

test('공유 주소는 랜딩 도메인 밑 /i/ 다', () => {
  assert.equal(shareUrl('Ab3xYz9Qw1'), 'https://ppurin.com/i/Ab3xYz9Qw1');
});

test('공유 제목 — 청첩장은 두 이름, 부고장은 호칭과 고인', () => {
  assert.equal(shareTitle('wedding', wedding), '김철수 ♥ 이영희 결혼합니다');
  assert.equal(shareTitle('funeral', funeral), '[부고] 아버지 故 김아버지');
  assert.equal(shareTitle('funeral', { ...funeral, deceased: { name: '김아버지' } }), '[부고] 故 김아버지');
});
