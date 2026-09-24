// 행사 폼·목록 단위 테스트
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultSideLabels,
  emptyEventDraft,
  groupEventsByYear,
  isMineLocked,
  validateEvent,
} from './event.ts';

function draft(patch: Partial<ReturnType<typeof emptyEventDraft>> = {}) {
  return { ...emptyEventDraft('2026-03-10'), type: 'wedding' as const, title: '내 결혼식', ...patch };
}

test('내 행사 기본형은 통과한다', () => {
  const r = validateEvent(draft());
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.payload.is_mine, true);
    assert.equal(r.payload.host_person_id, null);
  }
});

test('종류가 없으면 막는다', () => {
  assert.equal(validateEvent(draft({ type: null })).ok, false);
});

test('이름이 비면 막는다', () => {
  assert.equal(validateEvent(draft({ title: '   ' })).ok, false);
});

test('남의 행사는 당사자가 필수다', () => {
  const r = validateEvent(draft({ isMine: false, hostPersonId: null }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.some((e) => e.includes('당사자')));
});

test('남의 행사에 당사자가 있으면 통과하고 그대로 실린다', () => {
  const r = validateEvent(draft({ isMine: false, hostPersonId: 'p1' }));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.payload.host_person_id, 'p1');
});

test('내 행사로 저장하면 당사자를 버린다', () => {
  const r = validateEvent(draft({ isMine: true, hostPersonId: 'p1' }));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.payload.host_person_id, null);
});

test('남의 행사에는 측 라벨이 실리지 않는다', () => {
  const r = validateEvent(draft({ isMine: false, hostPersonId: 'p1', sideALabel: '신랑측' }));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.payload.side_a_label, null);
});

test('두 번째 측만 넣으면 막는다', () => {
  const r = validateEvent(draft({ sideALabel: '', sideBLabel: '신부측' }));
  assert.equal(r.ok, false);
});

test('날짜 정밀도를 낮추면 저장 날짜가 맞춰진다', () => {
  const r = validateEvent(draft({ date: '2026-03-10', datePrecision: 'year' }));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.payload.date, '2026-01-01');
});

test('빈 문자열 필드는 null로 간다', () => {
  const r = validateEvent(draft({ place: '  ', memo: '' }));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.payload.place, null);
    assert.equal(r.payload.memo, null);
  }
});

test('결혼식만 측 라벨 기본값이 있다', () => {
  assert.deepEqual(defaultSideLabels('wedding'), { a: '신랑측', b: '신부측' });
  assert.deepEqual(defaultSideLabels('funeral'), { a: '', b: '' });
  assert.deepEqual(defaultSideLabels(null), { a: '', b: '' });
});

test('기록이 있으면 내 행사 토글이 잠긴다', () => {
  assert.equal(isMineLocked(0), false);
  assert.equal(isMineLocked(1), true);
});

test('연도별로 묶는다', () => {
  const groups = groupEventsByYear([
    { date: '2026-03-10' },
    { date: '2026-01-02' },
    { date: '2025-12-31' },
    { date: '2024-05-18' },
  ]);
  assert.deepEqual(groups.map((g) => g.year), ['2026', '2025', '2024']);
  assert.equal(groups[0]?.events.length, 2);
});

test('빈 목록은 빈 그룹', () => {
  assert.deepEqual(groupEventsByYear([]), []);
});

test('같은 연도가 떨어져 있으면 따로 묶인다(정렬 전제를 드러낸다)', () => {
  const groups = groupEventsByYear([{ date: '2026-01-01' }, { date: '2025-01-01' }, { date: '2026-06-01' }]);
  assert.deepEqual(groups.map((g) => g.year), ['2026', '2025', '2026']);
});
