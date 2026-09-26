// 가져오기 판단 로직 단위 테스트 — 제목 감지, 열 추정, 종류·날짜 매핑, 행 상태, 저장 계획
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRows,
  canSave,
  detectHeader,
  guessMapping,
  mapEventType,
  mappingErrors,
  applyDupChoice,
  attachedDisplayName,
  chooseExisting,
  chooseNewPerson,
  refreshFileDuplicates,
  rowLabelNeeded,
  issueLabel,
  markSameNames,
  parseImportedDate,
  planSave,
  rowStatus,
  summarize,
  trimTable,
  type ImportRow,
  type Table,
} from './importPlan.ts';

// 견본과 같은 모양 — A열 비어 있음, 제목 행, No·이름·금액·구분
const sample: Table = [
  ['', 'No', '이름', '금액', '구분'],
  ['', 1, '홍길동', 100000, '결혼식'],
  ['', 2, '김영희', 50000, '결혼식'],
  ['', 3, '이몽룡', 100000, '결혼식'],
];

test('비어 있는 선행 열과 빈 행을 걷어낸다', () => {
  const t = trimTable([...sample, ['', '', '', '', '']]);
  assert.equal(t.length, 4);
  assert.deepEqual(t[0], ['No', '이름', '금액', '구분']);
});

test('첫 행이 열 이름으로 읽히면 제목 행이다', () => {
  assert.equal(detectHeader(trimTable(sample)), true);
  assert.equal(detectHeader([['홍길동', 100000], ['김영희', 50000]]), false);
});

test('열 역할을 제목으로 추정한다 — No는 무시 열', () => {
  const m = guessMapping(trimTable(sample));
  assert.equal(m.hasHeader, true);
  assert.deepEqual(m.roles, ['ignore', 'name', 'amount', 'type']);
  assert.deepEqual(mappingErrors(m), []);
});

test('제목이 없으면 숫자가 많은 열이 금액, 문자열 열이 이름이다', () => {
  const m = guessMapping([['홍길동', '₩100,000'], ['김영희', '50,000']]);
  assert.equal(m.hasHeader, false);
  assert.deepEqual(m.roles, ['name', 'amount']);
});

test('이름·금액 열이 없거나 겹치면 매핑 오류다', () => {
  assert.ok(mappingErrors({ hasHeader: true, roles: ['ignore', 'amount'] }).some((e) => e.includes('이름')));
  assert.ok(mappingErrors({ hasHeader: true, roles: ['name', 'name', 'amount'] }).some((e) => e.includes('둘 이상')));
});

test('구분 열의 글자를 행사 종류로 바꾼다', () => {
  assert.equal(mapEventType('결혼식'), 'wedding');
  assert.equal(mapEventType('웨딩'), 'wedding');
  assert.equal(mapEventType('돌잔치'), 'first_birthday');
  assert.equal(mapEventType('조문'), 'funeral');
  assert.equal(mapEventType('칠순'), 'senior_birthday');
  assert.equal(mapEventType('개소식'), 'opening');
  assert.equal(mapEventType('기타'), 'other');
  assert.equal(mapEventType('집들이'), null);
});

test('날짜 셀은 엑셀 일련번호와 문자열 표기를 받는다', () => {
  assert.equal(parseImportedDate(46067), '2026-02-14');
  assert.equal(parseImportedDate('2026-02-14'), '2026-02-14');
  assert.equal(parseImportedDate('2026.2.14'), '2026-02-14');
  assert.equal(parseImportedDate('2026년 2월 14일'), '2026-02-14');
  assert.equal(parseImportedDate('어제'), null);
});

function rowsOf(table: Table, target: 'given' | 'received' = 'given') {
  const t = trimTable(table);
  return buildRows(t, guessMapping(t), { target, defaultDate: '2026-05-18', eventType: target === 'received' ? 'wedding' : null });
}

test('준돈 가져오기는 행마다 이름·금액·종류·날짜를 만든다', () => {
  const rows = rowsOf(sample);
  assert.equal(rows.length, 3);
  assert.equal(rows[0]?.index, 2);
  assert.equal(rows[0]?.name, '홍길동');
  assert.equal(rows[0]?.amount, 100000);
  assert.equal(rows[0]?.type, 'wedding');
  assert.equal(rows[0]?.date, '2026-05-18');
  assert.deepEqual(rows[0]?.issues, []);
});

test('빈 이름·금액 오류·종류 미확인·단위 없는 금액을 표시한다', () => {
  const rows = rowsOf([
    ['이름', '금액', '구분'],
    ['', 50000, '결혼식'],
    ['박민수', '화환', '결혼식'],
    ['최수진', 30000, '집들이'],
    ['정우성', '10', '결혼식'],
  ]);
  assert.deepEqual(rows[0]?.issues, ['empty_name']);
  assert.deepEqual(rows[1]?.issues, ['bad_amount']);
  assert.deepEqual(rows[2]?.issues, ['unknown_type']);
  assert.equal(rows[2]?.type, 'other');
  assert.deepEqual(rows[3]?.issues, ['unitless_amount']);
  assert.equal(rowStatus(rows[0] as ImportRow), 'fix');
  assert.equal(rowStatus(rows[1] as ImportRow), 'fix');
  assert.equal(rowStatus(rows[2] as ImportRow), 'warn');
  assert.equal(rowStatus(rows[3] as ImportRow), 'warn');
});

test('명부 가져오기는 구분 열이 행사 종류와 다르면 경고만 한다', () => {
  const rows = rowsOf([['이름', '금액', '구분'], ['홍길동', 50000, '돌잔치'], ['김영희', 50000, '결혼식']], 'received');
  assert.deepEqual(rows[0]?.issues, ['type_mismatch']);
  assert.equal(rows[0]?.type, 'wedding');
  assert.equal(rowStatus(rows[0] as ImportRow), 'warn');
  assert.deepEqual(rows[1]?.issues, []);
});

test('장부에 같은 이름이 한 명이면 그 사람에게 자동 연결되고 그대로 저장된다', () => {
  // 명부를 가져오면 이름이 겹치는 것이 정상이고 대개 같은 사람이다. 막지 않는다.
  const rows = markSameNames(rowsOf(sample), new Map([['홍길동', [{ id: 'p1', name: '홍길동' }]]]));
  const hong = rows[0] as ImportRow;
  assert.ok(hong.issues.includes('same_name_in_ledger'));
  assert.equal(hong.attachTo, 'p1');
  assert.equal(rowStatus(hong), 'ok');
  assert.equal(attachedDisplayName(hong), '홍길동');
  // 조용히 붙이지 않는다. 미리보기 문구로 알린다.
  assert.equal(issueLabel(hong, 'same_name_in_ledger'), '기존 "홍길동"에 연결');
  // 저장 계획도 기존 사람 키로 묶인다 — 사람이 새로 생기지 않는다
  const plan = planSave([hong], 'given');
  assert.equal(plan[0]?.attachTo, 'p1');
  assert.equal(plan[0]?.personKey, 'id:p1');
});

test('장부에 같은 이름이 둘 이상이면 그때만 골라야 한다', () => {
  const rows = markSameNames(
    rowsOf(sample),
    new Map([['홍길동', [{ id: 'p1', name: '홍길동', label: '회사' }, { id: 'p2', name: '홍길동' }]]]),
  );
  const hong = rows[0] as ImportRow;
  assert.equal(hong.attachTo, null);
  assert.equal(rowStatus(hong), 'fix');
  assert.ok(issueLabel(hong, 'same_name_in_ledger').includes('2명'));
  assert.equal(rowStatus({ ...hong, attachTo: 'p2' }), 'ok');
});

test('"다른 사람이에요"로 바꾼 경우에만 구분할 말을 요구한다', () => {
  const rows = markSameNames(rowsOf(sample), new Map([['홍길동', [{ id: 'p1', name: '홍길동' }]]]));
  const hong = rows[0] as ImportRow;
  const asNew = { ...hong, attachTo: null, wantsNew: true };
  assert.equal(rowStatus(asNew), 'fix');
  assert.equal(issueLabel(asNew, 'same_name_in_ledger'), '새 사람으로 만들려면 구분할 말이 필요합니다');
  assert.equal(rowStatus({ ...asNew, label: '회사' }), 'ok');
  // 새 사람이면 기존 사람 키로 묶이지 않는다
  const plan = planSave([{ ...asNew, label: '회사' }], 'given');
  assert.equal(plan[0]?.attachTo, null);
  assert.equal(plan[0]?.label, '회사');
});

test('같은 이름이 장부에 없으면 아무것도 묻지 않는다', () => {
  const rows = markSameNames(rowsOf(sample), new Map());
  const hong = rows[0] as ImportRow;
  assert.equal(hong.issues.includes('same_name_in_ledger'), false);
  assert.equal(hong.attachTo, null);
  assert.equal(rowStatus(hong), 'ok');
});

test('파일 안에 같은 이름이 둘이면 장부 후보가 하나여도 자동 연결하지 않는다', () => {
  // 그 둘이 같은 사람인지 모르는 채 둘 다 기존 한 사람에게 붙이면 남의 기록이 섞인다.
  const table = [['이름', '금액', '구분'], ['홍길동', 50000, '결혼식'], ['홍길동', 30000, '결혼식']];
  const rows = markSameNames(rowsOf(table), new Map([['홍길동', [{ id: 'p1', name: '홍길동' }]]]));
  const first = rows[0] as ImportRow;
  assert.equal(first.attachTo, null);
  assert.equal(rowStatus(first), 'fix');

  assert.equal(
    issueLabel(first, 'same_name_in_ledger'),
    '장부에도 같은 이름이 있음 — 같은 사람으로 정하면 그 사람에게 연결됩니다',
  );

  // "같은 사람"이라고 하면 그제야 장부의 한 명에게 연결된다
  const same = applyDupChoice(rows, '홍길동', 'same');
  assert.equal((same[0] as ImportRow).attachTo, 'p1');
  assert.equal((same[1] as ImportRow).attachTo, 'p1');
  assert.equal(rowStatus(same[0] as ImportRow), 'ok');
  const plan = planSave(same, 'given');
  assert.equal(plan[0]?.personKey, plan[1]?.personKey);
  assert.equal(plan[0]?.personKey, 'id:p1');

  // "다른 사람"이면 각자 구분할 말이 필요하고 서로 다른 사람으로 저장된다
  const diff = applyDupChoice(rows, '홍길동', 'different');
  assert.equal(rowStatus(diff[0] as ImportRow), 'fix');
  const labelled = diff.map((r, i) => ({ ...r, label: i === 0 ? '회사' : '학교' }));
  assert.equal(rowStatus(labelled[0] as ImportRow), 'ok');
  const plan2 = planSave(labelled, 'given');
  assert.notEqual(plan2[0]?.personKey, plan2[1]?.personKey);
});

test('파일 안 중복은 같은 사람인지 다른 사람인지 골라야 한다', () => {
  const rows = markSameNames(rowsOf([['이름', '금액', '구분'], ['김철수', 50000, '결혼식'], ['김철수', 30000, '결혼식']]), new Map());
  const [a, b] = rows as [ImportRow, ImportRow];
  assert.ok(a.issues.includes('same_name_in_file'));
  assert.equal(rowStatus(a), 'fix');
  assert.equal(rowStatus({ ...a, dupChoice: 'same' }), 'ok');
  assert.equal(rowStatus({ ...a, dupChoice: 'different' }), 'fix');
  assert.equal(rowStatus({ ...a, dupChoice: 'different', label: '회사' }), 'ok');
  // 같은 사람으로 고르면 저장 계획에서 한 사람 키로 묶이고, 다른 사람이면 행마다 갈린다
  const same = planSave([{ ...a, dupChoice: 'same' }, { ...b, dupChoice: 'same' }], 'given');
  assert.equal(same[0]?.personKey, same[1]?.personKey);
  const diff = planSave([{ ...a, dupChoice: 'different', label: '회사' }, { ...b, dupChoice: 'different', label: '학교' }], 'given');
  assert.notEqual(diff[0]?.personKey, diff[1]?.personKey);
});

test('요약은 저장·건너뜀·수정 필요를 세고 수정 필요가 0이어야 저장할 수 있다', () => {
  const rows = rowsOf([['이름', '금액', '구분'], ['홍길동', 50000, '결혼식'], ['', 50000, '결혼식'], ['김영희', 30000, '결혼식']]);
  assert.deepEqual(summarize(rows), { save: 2, skip: 0, fix: 1, total: 3, totalAmount: 80000 });
  assert.equal(canSave(rows), false);
  const fixed = rows.map((r, i) => (i === 1 ? { ...r, skip: true } : r));
  assert.deepEqual(summarize(fixed), { save: 2, skip: 1, fix: 0, total: 3, totalAmount: 80000 });
  assert.equal(canSave(fixed), true);
  assert.equal(planSave(fixed, 'given').length, 2);
});

// ------------------------------------------------- 막다른 길이 생기지 않는지
// "저장은 막히는데 고칠 칸이 없는" 조합이 있으면 사용자는 건너뛰기밖에 못 한다.
test('저장이 막히는 모든 행은 고칠 길이 있다 — 라벨 칸이 뜨거나 고를 후보가 있다', () => {
  const base = markSameNames(rowsOf(sample), new Map())[0] as ImportRow;
  const two = [{ id: 'p1', name: '홍길동' }, { id: 'p2', name: '홍길동' }];
  const cases: ImportRow[] = [];
  for (const people of [[], [{ id: 'p1', name: '홍길동' }], two]) {
    for (const inFile of [false, true]) {
      for (const dup of [null, 'same', 'different'] as const) {
        for (const wantsNew of [false, true]) {
          for (const attachTo of [null, 'p1']) {
            cases.push({
              ...base,
              existingPeople: people,
              issues: inFile ? ['same_name_in_file'] : [],
              dupChoice: inFile ? dup : null,
              wantsNew,
              attachTo,
              label: '',
            });
          }
        }
      }
    }
  }
  for (const row of cases) {
    if (rowStatus(row) !== 'fix') continue;
    const fixable =
      rowLabelNeeded(row) || // 구분할 말 칸이 뜬다
      row.existingPeople.length > 1 || // 후보 칩에서 고를 수 있다
      (row.issues.includes('same_name_in_file') && row.dupChoice === null); // 같은 사람/다른 사람 칩
    assert.ok(fixable, `막다른 길: ${JSON.stringify(row)}`);
  }
});

test('파일 안 중복을 다른 사람으로 나누면 장부에 같은 이름이 없어도 구분 칸이 뜬다', () => {
  // 빈 장부에 첫 명부를 넣는 흔한 경로다. 예전에는 칸이 안 떠서 저장이 영구히 막혔다.
  const table = [['이름', '금액', '구분'], ['홍길동', 50000, '결혼식'], ['홍길동', 30000, '결혼식']];
  const rows = applyDupChoice(markSameNames(rowsOf(table), new Map()), '홍길동', 'different');
  const first = rows[0] as ImportRow;
  assert.equal(first.existingPeople.length, 0);
  assert.equal(rowStatus(first), 'fix');
  assert.equal(rowLabelNeeded(first), true);
  assert.equal(rowStatus({ ...first, label: '회사' }), 'ok');
});

test('파일 안 중복을 다른 사람으로 나눈 뒤 기존 사람에게 붙이면 라벨은 필요 없다', () => {
  const table = [['이름', '금액', '구분'], ['홍길동', 50000, '결혼식'], ['홍길동', 30000, '결혼식']];
  const rows = applyDupChoice(
    markSameNames(rowsOf(table), new Map([['홍길동', [{ id: 'p1', name: '홍길동' }]]])),
    '홍길동',
    'different',
  );
  const attached = chooseExisting(rows[0] as ImportRow, 'p1');
  assert.equal(rowLabelNeeded(attached), false);
  assert.equal(rowStatus(attached), 'ok');
});

test('후보 칩을 누르면 "새 사람" 의사와 적어 둔 라벨이 함께 정리된다', () => {
  const rows = markSameNames(rowsOf(sample), new Map([['홍길동', [{ id: 'p1', name: '홍길동' }]]]));
  const asNew = { ...chooseNewPerson(rows[0] as ImportRow), label: '회사' };
  const back = chooseExisting(asNew, 'p1');
  assert.equal(back.wantsNew, false);
  assert.equal(back.label, '');
  assert.equal(back.attachTo, 'p1');
  assert.equal(rowStatus(back), 'ok');
  // 저장 계획도 기존 사람 키로만 묶인다 — wantsNew가 남아 각자 갈라지면 안 된다
  assert.equal(planSave([back], 'given')[0]?.personKey, 'id:p1');
  assert.equal(planSave([back], 'given')[0]?.label, null);
});

test('같은 사람으로 되돌리면 다른 사람일 때 적어 둔 라벨을 버린다', () => {
  const table = [['이름', '금액', '구분'], ['홍길동', 50000, '결혼식'], ['홍길동', 30000, '결혼식']];
  const rows = markSameNames(rowsOf(table), new Map([['홍길동', [{ id: 'p1', name: '홍길동' }]]]));
  const diff = applyDupChoice(rows, '홍길동', 'different').map((r) => ({ ...r, label: '회사' }));
  const same = applyDupChoice(diff, '홍길동', 'same');
  assert.equal((same[0] as ImportRow).label, '');
  assert.equal((same[0] as ImportRow).attachTo, 'p1');
});

test('같은 사람인데 장부 후보가 둘이면 여전히 골라야 한다', () => {
  const table = [['이름', '금액', '구분'], ['홍길동', 50000, '결혼식'], ['홍길동', 30000, '결혼식']];
  const rows = markSameNames(
    rowsOf(table),
    new Map([['홍길동', [{ id: 'p1', name: '홍길동' }, { id: 'p2', name: '홍길동' }]]]),
  );
  const same = applyDupChoice(rows, '홍길동', 'same');
  assert.equal((same[0] as ImportRow).attachTo, null);
  assert.equal(rowStatus(same[0] as ImportRow), 'fix');
});

test('짝을 건너뛰면 남은 한 행은 더 묻지 않고 장부 후보에 자동 연결된다', () => {
  const table = [['이름', '금액', '구분'], ['홍길동', 50000, '결혼식'], ['홍길동', 30000, '결혼식']];
  const rows = markSameNames(rowsOf(table), new Map([['홍길동', [{ id: 'p1', name: '홍길동' }]]]));
  const after = refreshFileDuplicates(rows.map((r, i) => (i === 1 ? { ...r, skip: true } : r)));
  const left = after[0] as ImportRow;
  assert.equal(left.issues.includes('same_name_in_file'), false);
  assert.equal(left.attachTo, 'p1');
  assert.equal(rowStatus(left), 'ok');
});

test('건너뛰기는 다른 모든 문제보다 앞선다', () => {
  const base = markSameNames(rowsOf(sample), new Map())[0] as ImportRow;
  const broken: ImportRow = {
    ...base,
    issues: ['empty_name', 'bad_amount', 'same_name_in_file'],
    existingPeople: [{ id: 'p1', name: '홍길동' }],
    wantsNew: true,
  };
  assert.equal(rowStatus(broken), 'fix');
  assert.equal(rowStatus({ ...broken, skip: true }), 'skip');
  assert.equal(rowLabelNeeded({ ...broken, skip: true }), false);
});

// 2026-09-26 QA가 찾은 경로 — '같은 사람'이라고 답한 뒤 짝을 건너뛰었다 되살리면
// 연결만 풀리고 선택은 남아, 상태는 정상인데 한 사람이 둘로 갈렸다.
test("중복이 되살아나면 앞선 '같은 사람' 선택도 함께 되돌아간다", () => {
  const table = [
    ['이름', '금액', '구분'],
    ['홍길동', 50000, '결혼식'],
    ['홍길동', 30000, '결혼식'],
    ['홍길동', 20000, '결혼식'],
  ];
  let rows = markSameNames(rowsOf(table), new Map([['홍길동', [{ id: 'p1', name: '홍길동' }]]]));
  rows = refreshFileDuplicates(rows.map((r, i) => (i === 2 ? { ...r, skip: true } : r)));
  rows = applyDupChoice(rows, '홍길동', 'same');
  // 건너뛴 행을 되살린다. 세 행이 다시 중복이므로 앞선 선택은 무효다.
  rows = refreshFileDuplicates(rows.map((r, i) => (i === 2 ? { ...r, skip: false } : r)));
  for (const r of rows) {
    assert.equal(r.dupChoice, null, '되살아난 중복에는 앞선 선택이 남으면 안 된다');
    assert.equal(rowStatus(r), 'fix', '다시 물어야 하므로 수정 필요다');
  }
});

// 2026-09-26 사용자가 보낸 실제 파일 모양. 열 이름에 단위가 붙고 날짜가 미국식이다.
// 이 조합에서 금액 열을 통째로 놓쳐 전 행이 저장 불가였다.
test('실제 사용자 파일 모양을 그대로 읽는다', () => {
  const table = [
    ['No', '성함', '금액(원)', '일자', '종류'],
    [1, '김용우', '\u20a9100,000', '11/15/22', '할아버지 장례식'],
    [2, '이민정(네이버)', '\u20a950,000', '11/15/22', '할아버지 장례식'],
  ];
  const m = guessMapping(table);
  assert.equal(m.hasHeader, true);
  assert.deepEqual(m.roles, ['ignore', 'name', 'amount', 'date', 'type']);

  const rows = buildRows(table, m, { target: 'received', defaultDate: '2026-09-26', eventType: null });
  assert.equal(rows.length, 2);
  for (const r of rows) {
    assert.deepEqual(r.issues, [], `이슈가 없어야 한다: ${JSON.stringify(r.issues)}`);
    assert.equal(r.date, '2022-11-15', '미국식 날짜를 읽어야 한다');
    assert.equal(r.type, 'funeral', '"할아버지 장례식"은 장례식이다');
  }
  assert.equal(rows[0]!.amount, 100000);
  assert.equal(rows[1]!.amount, 50000);
});

test('열 이름의 괄호 꼬리를 떼고 맞춘다', () => {
  assert.equal(guessMapping([['성함 ', '금액 (원)']]).roles[0], 'name');
  assert.equal(guessMapping([['성함 ', '금액 (원)']]).roles[1], 'amount');
});

test('없는 날짜는 버린다', () => {
  assert.equal(parseImportedDate('13/45/22'), null);
  assert.equal(parseImportedDate('2/30/24'), null);
  assert.equal(parseImportedDate('2/29/24'), '2024-02-29');
});
