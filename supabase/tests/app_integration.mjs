// 앱의 리포지토리·도메인 계층을 실제 Supabase 프로젝트에 붙여 확인하는 통합 검증
//
// 로컬 RLS 검증(run.sh)은 SQL만 본다. 이 스크립트는 앱이 실제로 부르는 TypeScript 함수를
// 그대로 호출해 "리포지토리가 장부 필터를 빠뜨리지 않는가", "도메인 정규화가 DB 생성 컬럼과
// 같은 결과를 내는가"를 확인한다. 만든 계정과 데이터는 끝에 전부 지운다.
//
// 사용법
//   export SUPABASE_URL=https://<ref>.supabase.co
//   export SUPABASE_ANON_KEY=...
//   export SUPABASE_SERVICE_ROLE_KEY=...   # supabase projects api-keys --project-ref <ref>
//   node supabase/tests/app_integration.mjs

import { createClient } from '@supabase/supabase-js';
import { createDb, db, setDb } from '../../src/lib/supabaseClient.ts';
import * as emailAuth from '../../src/auth/email.ts';
import { normalizeName } from '../../src/domain/name.ts';
import { normalizeInviteCode } from '../../src/domain/invite.ts';
import { autoEventTitle, todayISO } from '../../src/domain/title.ts';
import { undoPlan } from '../../src/domain/quickRecord.ts';
import * as ledgersRepo from '../../src/repositories/ledgers.ts';
import * as peopleRepo from '../../src/repositories/people.ts';
import * as eventsRepo from '../../src/repositories/events.ts';
import * as entriesRepo from '../../src/repositories/entries.ts';
import * as statsRepo from '../../src/repositories/stats.ts';

const URL = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
const ANON = process.env.SUPABASE_ANON_KEY ?? '';
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const PW = 'Ppurin-Integration-2026!';

if (!URL || !ANON || !SVC) {
  console.error('SUPABASE_URL · SUPABASE_ANON_KEY · SUPABASE_SERVICE_ROLE_KEY 를 모두 설정해야 한다.');
  process.exit(2);
}

let pass = 0;
let fail = 0;
const failures = [];

function check(name, cond, detail = '') {
  if (cond) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    failures.push(`${name}  ${detail}`);
    console.log(`  FAIL  ${name}  ${detail}`);
  }
}

// Supabase 내장 속도 제한(메일 발송·로그인)에 걸린 결과는 코드 결함이 아니다.
// 같은 원인이 어떤 실행에서는 SKIP, 어떤 실행에서는 FAIL로 나오면 검증 전체를 믿을 수 없게 된다.
// 속도 제한이면 건너뛰고, 그 밖에는 평소대로 판정한다.
let skipped = 0;
function checkUnlessRateLimited(name, result, cond, detail = '') {
  if (result && result.ok === false && result.error?.kind === 'rate_limited') {
    skipped += 1;
    console.log(`  SKIP  ${name} — Supabase 속도 제한(커스텀 SMTP 필요)`);
    return;
  }
  check(name, cond, detail);
}

function eq(name, actual, expected) {
  check(name, Object.is(actual, expected), `실제 ${JSON.stringify(actual)} / 기대 ${JSON.stringify(expected)}`);
}

async function expectError(name, fn, needle) {
  try {
    await fn();
    check(name, false, '오류가 나야 하는데 성공했다');
  } catch (error) {
    const message = error?.message ?? String(error);
    check(name, message.includes(needle), `실제 오류 "${message}" / 기대 문구 "${needle}"`);
  }
}

const admin = createClient(URL, SVC, { auth: { persistSession: false, autoRefreshToken: false } });
const tag = Date.now().toString(36);
const createdUsers = [];
let cleanedUp = 0;

async function makeUser(prefix, displayName) {
  const email = `int-${prefix}-${tag}@ppurin-test.kr`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PW,
    email_confirm: true,
    user_metadata: { name: displayName },
  });
  if (error) throw new Error(`테스트 계정 생성 실패: ${error.message}`);
  createdUsers.push(data.user.id);
  return { id: data.user.id, email };
}

// 지정한 계정으로 로그인한 클라이언트를 리포지토리에 꽂는다.
async function actAs(user) {
  const client = createDb(URL, ANON);
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: PW });
  if (error) throw new Error(`로그인 실패: ${error.message}`);
  setDb(client);
  return client;
}

// 테스트 계정만 삭제한다. 실계정을 지우는 사고를 두 번 내지 않기 위한 안전장치다.
//
// 2026-09-24에 정리 절차가 "모든 사용자를 훑어 전부 삭제"였던 탓에 사용자의 실계정과
// 실기기로 넣은 기록이 지워졌다. 되돌리지 못했다. 그때의 잘못은 "사용자 0명"이라는
// 확인 조건을 삭제 명령으로 바꿔 쓴 것이다.
//
// 규칙 — 이 실행에서 만든 id만 지우고, 지우기 직전에 메일 도메인을 서버에 다시 물어
// 확인한다. 도메인이 다르면 지우지 않고 경고만 남긴다. 목록을 훑어 지우지 않는다.
const TEST_EMAIL_DOMAIN = '@ppurin-test.kr';

async function cleanup() {
  let deleted = 0;
  for (const id of createdUsers) {
    const { data, error } = await admin.auth.admin.getUserById(id);
    if (error || !data?.user) continue;
    const email = data.user.email ?? '';
    if (!email.endsWith(TEST_EMAIL_DOMAIN)) {
      console.error(`  ⛔ 삭제하지 않음 — 테스트 계정이 아니다: ${email}`);
      continue;
    }
    await admin.auth.admin.deleteUser(id).catch(() => {});
    deleted += 1;
  }
  return deleted;
}

async function main() {
  console.log(`\n== 통합 검증 시작 (${URL})\n`);

  // ---------------------------------------------------------------- 계정과 장부
  const alice = await makeUser('a', '김철수');
  const bob = await makeUser('b', '이영희');
  const carol = await makeUser('c', '박민수');

  await actAs(alice);
  const aliceLedgers = await ledgersRepo.listMyLedgers(alice.id);
  eq('첫 로그인 후 장부 1권', aliceLedgers.length, 1);
  eq('첫 구성원은 owner', aliceLedgers[0].role, 'owner');
  eq('장부 기본 이름', aliceLedgers[0].name, '내 장부');
  const LA = aliceLedgers[0].ledgerId;

  await actAs(carol);
  const carolLedgers = await ledgersRepo.listMyLedgers(carol.id);
  const LC = carolLedgers[0].ledgerId;
  check('다른 사용자는 다른 장부를 받는다', LC !== LA, `${LC} vs ${LA}`);

  // ------------------------------------------------------- 이름 정규화 DB 대조
  await actAs(alice);
  // JS의 \s 와 Postgres의 [[:space:]] 가 어긋날 수 있는 문자를 일부러 섞는다.
  const names = [
    '김 철수',
    '  김철수  ',
    'Kim Chulsoo',
    'KIM CHULSOO',
    '\t김\n철수',
    '김철수'.normalize('NFD'),
    '영업1팀 일동',
    'O Brien', // NBSP
    '가　나', // 전각 공백
    'Ä Ö Ü',
    '홍  길동',
  ];
  const parityRows = [];
  for (const raw of names) {
    const created = await peopleRepo.createPerson(LA, { name: raw });
    parityRows.push({ raw, db: created.name_normalized, js: normalizeName(raw) });
  }
  let parityMismatch = 0;
  for (const row of parityRows) {
    if (row.db !== row.js) {
      parityMismatch += 1;
      console.log(
        `        불일치 입력=${JSON.stringify(row.raw)} DB=${JSON.stringify(row.db)} JS=${JSON.stringify(row.js)}`,
      );
    }
  }
  eq(`이름 정규화가 DB 생성 컬럼과 일치한다 (${parityRows.length}종)`, parityMismatch, 0);

  // 대조용으로 만든 사람은 이후 검사에 방해되므로 지운다.
  for (const row of parityRows) {
    const found = await peopleRepo.findByNormalizedName(LA, row.db);
    for (const person of found) {
      if (person.id) await peopleRepo.deletePerson(LA, person.id);
    }
  }
  const afterParity = await peopleRepo.listPeople(LA);
  eq('대조용 데이터 정리됨', afterParity.rows.length, 0);

  // ------------------------------------------------------------ 사람과 자동완성
  const p1 = await peopleRepo.createPerson(LA, { name: '김 철수', relation_group: 'work', label: '회사 동기' });
  const p2 = await peopleRepo.createPerson(LA, { name: '이민호', relation_group: 'friend' });
  eq('저장 시 정규화 컬럼이 채워진다', p1.name_normalized, normalizeName('김 철수'));

  const prefixHits = await peopleRepo.searchPeopleByPrefix(LA, normalizeName('김'));
  eq('prefix 자동완성이 맞는 사람을 찾는다', prefixHits.length, 1);
  eq('자동완성 결과의 이름', prefixHits[0].name, '김 철수');

  const noHits = await peopleRepo.searchPeopleByPrefix(LA, normalizeName('박'));
  eq('없는 prefix는 0건', noHits.length, 0);

  // --------------------------------------------------------------- 행사와 기록
  const title = autoEventTitle({ type: 'wedding', isMine: false, hostName: p1.name, date: '2025-05-18' });
  eq('자동 제목 규칙', title, '김 철수 결혼식 2025');

  const e1 = await eventsRepo.createEvent(LA, {
    type: 'wedding',
    is_mine: false,
    host_person_id: p1.id,
    title,
    date: '2025-05-18',
  });
  const e2 = await eventsRepo.createEvent(LA, {
    type: 'first_birthday',
    is_mine: true,
    title: '내 돌잔치',
    date: '2026-03-01',
    side_a_label: '신랑측',
    side_b_label: '신부측',
  });

  const matched = await eventsRepo.findMatchingEvent(LA, {
    hostPersonId: p1.id,
    type: 'wedding',
    date: '2025-05-20',
  });
  eq('±7일 안의 기존 행사를 찾는다', matched.length, 1);
  const farMatch = await eventsRepo.findMatchingEvent(LA, {
    hostPersonId: p1.id,
    type: 'wedding',
    date: '2025-07-01',
  });
  eq('범위를 벗어나면 못 찾는다', farMatch.length, 0);

  await entriesRepo.createEntry(LA, { event_id: e1.id, person_id: p1.id, amount: 100000 });
  const shared = await entriesRepo.createEntry(LA, {
    event_id: e2.id,
    person_id: p2.id,
    co_person_id: p1.id,
    amount: 50000,
    side: 'a',
  });
  await entriesRepo.createEntry(LA, { event_id: e2.id, person_id: p2.id, amount: null, side: 'b' });

  eq('created_by는 서버가 입력자로 채운다', shared.created_by, alice.id);

  // ------------------------------------------------------------------ 수지 집계
  const b1 = await peopleRepo.getPersonBalance(LA, p1.id);
  eq('준 합계', b1.given_total, 100000);
  eq('공동 부조도 전액 받은 것으로 잡힌다', b1.received_total, 50000);
  eq('차액', b1.balance, 50000);
  eq('공동 기록도 건수에 포함된다', b1.entry_count, 2);

  const b2 = await peopleRepo.getPersonBalance(LA, p2.id);
  eq('미확정은 합계에서 빠진다', b2.received_total, 50000);
  eq('미확정 건수', b2.received_unconfirmed, 1);

  const summary = await eventsRepo.getEventSummary(LA, e2.id);
  eq('행사 합계는 기록 단위라 공동이 중복되지 않는다', summary.total, 50000);
  eq('미확정 건수', summary.unconfirmed, 1);
  eq('측이 둘로 나뉜다', summary.bySide.length, 2);
  eq('측별 합이 전체와 같다', summary.bySide.reduce((a, s) => a + s.total, 0), summary.total);

  const stats = await statsRepo.getYearStats(LA, 2025);
  eq('2025년 준돈 합계', stats.givenTotal, 100000);
  eq('2025년에는 받은돈이 없다', stats.receivedTotal, 0);
  const statsAll = await statsRepo.getYearStats(LA, null);
  eq('연도 전체 받은돈 합계', statsAll.receivedTotal, 50000);

  const recent = await entriesRepo.listRecentEntries(LA);
  eq('최근 기록 3건', recent.length, 3);
  check('최근 기록에 행사가 붙어 온다', recent[0].event !== null, JSON.stringify(recent[0].event));
  check('최근 기록에 사람이 붙어 온다', recent[0].person !== null, JSON.stringify(recent[0].person));

  const ledger1 = await entriesRepo.listEntriesByPerson(LA, p1.id);
  eq('원장은 대표자와 공동 부조자 기록을 모두 본다', ledger1.rows.length, 2);

  // ------------------------------------------------- 홈의 준돈·받은돈 탭 조회
  // 방향 필터는 events를 !inner로 묶어야 걸리고, 정렬은 `event(date)` 문법이어야 부모 행이
  // 정렬된다. 둘 다 틀려도 서버는 오류를 내지 않고 조용히 섞인 결과를 준다. 그래서 검증한다.
  // e1 = 남의 결혼식(2025-05-18, 준돈 1건), e2 = 내 돌잔치(2026-03-01, 받은돈 2건)
  const givenPage = await entriesRepo.listEntriesByDirection(LA, false);
  eq('준돈 탭은 남의 행사 기록만 본다', givenPage.rows.length, 1);
  check(
    '준돈 탭에 내 행사 기록이 섞이지 않는다',
    givenPage.rows.every((row) => row.event?.is_mine === false),
    JSON.stringify(givenPage.rows.map((row) => row.event?.is_mine)),
  );

  const receivedPage = await entriesRepo.listEntriesByDirection(LA, true);
  eq('받은돈 탭은 내 행사 기록만 본다', receivedPage.rows.length, 2);
  check(
    '받은돈 탭에 남의 행사 기록이 섞이지 않는다',
    receivedPage.rows.every((row) => row.event?.is_mine === true),
    JSON.stringify(receivedPage.rows.map((row) => row.event?.is_mine)),
  );

  eq(
    '두 탭을 합치면 전체 기록 수와 같다',
    givenPage.rows.length + receivedPage.rows.length,
    recent.length,
  );

  // 정렬 확인용으로 더 최근 날짜의 남의 행사를 하나 더 넣는다.
  const laterEvent = await eventsRepo.createEvent(LA, {
    type: 'funeral',
    is_mine: false,
    host_person_id: p2.id,
    title: '정렬 확인용 행사',
    date: '2027-01-15',
  });
  await entriesRepo.createEntry(LA, { event_id: laterEvent.id, person_id: p2.id, amount: 30000 });

  const sorted = await entriesRepo.listEntriesByDirection(LA, false);
  eq('새 기록이 준돈 탭에 들어온다', sorted.rows.length, 2);
  const dates = sorted.rows.map((row) => row.event?.date);
  eq('행사 날짜 내림차순으로 온다', JSON.stringify(dates), JSON.stringify(['2027-01-15', '2025-05-18']));

  await entriesRepo.deleteEntry(LA, sorted.rows[0].id);
  await eventsRepo.deleteEvent(LA, laterEvent.id);
  eq(
    '정렬 확인용 기록을 지우면 원래대로 돌아온다',
    (await entriesRepo.listEntriesByDirection(LA, false)).rows.length,
    1,
  );

  // ------------------------------------- 빠른 기록의 3단 순차 저장과 실행 취소
  // 화면(S02)이 하는 것과 같은 순서로 부른다. CTE로 묶으면 실패하는 흐름이라 순차가 맞는지,
  // 그리고 undoPlan이 고른 한 건을 지우면 정말 셋 다 사라지는지 본다.
  const qrPerson = await peopleRepo.createPerson(LA, { name: '빠른기록 상대', relation_group: 'other' });
  const qrEvent = await eventsRepo.createEvent(LA, {
    type: 'senior_birthday',
    is_mine: false,
    host_person_id: qrPerson.id,
    title: autoEventTitle({
      type: 'senior_birthday',
      isMine: false,
      hostName: qrPerson.name,
      date: '2026-04-04',
    }),
    date: '2026-04-04',
    place: '○○웨딩홀',
  });
  const qrEntry = await entriesRepo.createEntry(LA, {
    event_id: qrEvent.id,
    person_id: qrPerson.id,
    amount: 50000,
  });
  eq('빠른 기록 제목 자동 생성', qrEvent.title, '빠른기록 상대 회갑·칠순 2026');
  eq('장소가 행사에 저장된다', qrEvent.place, '○○웨딩홀');

  // 새 사람까지 만든 경우의 실행 취소 — 사람 하나만 지우면 된다.
  const step = undoPlan({ personId: qrPerson.id, eventId: qrEvent.id, entryId: qrEntry.id });
  eq('실행 취소는 새로 만든 사람을 고른다', step.kind, 'person');
  await peopleRepo.deletePerson(LA, step.id);

  eq('실행 취소 후 사람이 사라진다', await peopleRepo.getPerson(LA, qrPerson.id), null);
  eq('실행 취소 후 행사가 사라진다', await eventsRepo.getEvent(LA, qrEvent.id), null);
  const qrGone = await entriesRepo.listEntriesByEvent(LA, qrEvent.id);
  eq('실행 취소 후 기록이 사라진다', qrGone.rows.length, 0);

  // 기존 사람·새 행사만 만든 경우 — 행사를 지우면 기록이 따라간다.
  const ev2 = await eventsRepo.createEvent(LA, {
    type: 'opening',
    is_mine: false,
    host_person_id: p1.id,
    title: '개업 취소용',
    date: '2026-05-05',
  });
  const en2 = await entriesRepo.createEntry(LA, { event_id: ev2.id, person_id: p1.id, amount: 20000 });
  const step2 = undoPlan({ personId: null, eventId: ev2.id, entryId: en2.id });
  eq('기존 사람이면 실행 취소는 행사를 고른다', step2.kind, 'event');
  await eventsRepo.deleteEvent(LA, step2.id);
  eq('행사를 지우면 기록도 사라진다', (await entriesRepo.listEntriesByEvent(LA, ev2.id)).rows.length, 0);
  check('기존 사람은 남는다', (await peopleRepo.getPerson(LA, p1.id)) !== null, '사람이 같이 지워졌다');

  // --------------------------------------------------------------- 페이지네이션
  for (let i = 0; i < 7; i += 1) {
    await peopleRepo.createPerson(LA, { name: `페이지${i}` });
  }
  // 앞 단계에서 만든 사람 수에 기대값이 끌려다니지 않도록 총 건수에서 역산한다.
  const all = await peopleRepo.listPeople(LA, { limit: 100 });
  const total = all.rows.length;
  const half = Math.ceil(total / 2);
  check('페이지 검사에 쓸 사람이 2명 이상이다', total >= 2, `${total}명`);

  const page1 = await peopleRepo.listPeople(LA, { limit: half });
  eq('첫 페이지 행 수', page1.rows.length, half);
  eq('다음 페이지가 있다', page1.hasMore, total > half);
  eq('다음 오프셋', page1.nextOffset, half);
  const page2 = await peopleRepo.listPeople(LA, { limit: half, offset: page1.nextOffset });
  eq('둘째 페이지 행 수', page2.rows.length, total - half);
  eq('마지막 페이지에는 더 없음', page2.hasMore, false);
  eq('마지막 페이지의 다음 오프셋은 없다', page2.nextOffset, null);
  const ids = new Set([...page1.rows, ...page2.rows].map((r) => r.id));
  eq('두 페이지가 겹치지 않고 전부 나온다', ids.size, total);

  // --------------------------------------------------- 다른 장부 계정의 차단
  await actAs(carol);
  const carolSeesPeople = await peopleRepo.listPeople(LA);
  eq('다른 장부 계정은 사람을 못 본다', carolSeesPeople.rows.length, 0);
  const carolSeesEntries = await entriesRepo.listRecentEntries(LA);
  eq('다른 장부 계정은 기록을 못 본다', carolSeesEntries.length, 0);
  const carolStats = await statsRepo.getYearStats(LA, null);
  eq('다른 장부 계정의 통계는 0원', carolStats.givenTotal, 0);
  await expectError(
    '다른 장부에 사람을 넣으면 거부된다',
    () => peopleRepo.createPerson(LA, { name: '침입자' }),
    '권한',
  );
  await expectError(
    '다른 장부의 초대 코드는 발급할 수 없다',
    () => ledgersRepo.createInviteCode(LA),
    '만든 사람만',
  );

  // ------------------------------------------------------------- 초대와 합류
  await actAs(alice);
  const code = await ledgersRepo.createInviteCode(LA);
  eq('초대 코드 길이', code.length, 8);
  eq('초대 코드 정규화는 멱등', normalizeInviteCode(code), code);

  await actAs(bob);
  // 코드는 카톡으로 전달된다. 받는 쪽은 DB에서 읽지 않고 손으로 입력한다.
  const joined = await ledgersRepo.joinLedger(normalizeInviteCode(` ${code.toLowerCase()} `));
  eq('소문자·공백 섞인 코드로도 합류된다', joined, LA);

  const bobLedgers = await ledgersRepo.listMyLedgers(bob.id);
  eq('합류 후 빈 개인 장부는 정리된다', bobLedgers.length, 1);
  eq('합류한 장부가 맞다', bobLedgers[0].ledgerId, LA);
  eq('합류한 사람은 member', bobLedgers[0].role, 'member');

  // 여기가 코디네이터가 지적한 함정이다. user_id 필터를 빼면 배우자 행까지 딸려 온다.
  const members = await ledgersRepo.listMembers(LA);
  eq('구성원 목록은 2명', members.length, 2);
  eq('내 장부 목록은 내 행만 센다', bobLedgers.length, 1);

  const bobSeesPeople = await peopleRepo.listPeople(LA);
  check('같은 장부 구성원은 데이터를 공유한다', bobSeesPeople.rows.length >= 2, `${bobSeesPeople.rows.length}건`);

  await expectError(
    '재사용된 코드는 거부된다',
    () => ledgersRepo.joinLedger(code),
    '올바르지 않거나 만료',
  );

  // ------------------------------------------- 두 장부에 동시에 속한 계정 (가장 위험한 경우)
  // RLS는 "내가 구성원인 모든 장부"를 허용한다. 장부가 한 권뿐인 계정으로만 검사하면
  // 리포지토리에서 ledger_id 필터를 통째로 빼도 전부 통과한다. 그래서 두 장부 계정을 따로 만든다.
  const dave = await makeUser('d', '최수진');
  await actAs(dave);
  const daveLedgers0 = await ledgersRepo.listMyLedgers(dave.id);
  const LD = daveLedgers0[0].ledgerId;

  const dPerson = await peopleRepo.createPerson(LD, { name: '데이브 지인' });
  const dEvent = await eventsRepo.createEvent(LD, {
    type: 'opening',
    is_mine: false,
    host_person_id: dPerson.id,
    title: '데이브 지인 개업 2026',
    date: '2026-06-01',
  });
  await entriesRepo.createEntry(LD, { event_id: dEvent.id, person_id: dPerson.id, amount: 30000 });

  await actAs(alice);
  const code2 = await ledgersRepo.createInviteCode(LA);
  await actAs(dave);
  await ledgersRepo.joinLedger(code2);

  const daveLedgers = await ledgersRepo.listMyLedgers(dave.id);
  eq('데이터가 있는 개인 장부는 정리되지 않는다(장부 2권)', daveLedgers.length, 2);

  // 조회가 장부별로 갈라지는가
  const inLD = await peopleRepo.listPeople(LD);
  const inLA = await peopleRepo.listPeople(LA);
  const idsLD = new Set(inLD.rows.map((r) => r.id));
  const idsLA = new Set(inLA.rows.map((r) => r.id));
  eq('개인 장부에는 내가 넣은 사람만 있다', idsLD.size, 1);
  check('두 장부의 사람이 섞이지 않는다', [...idsLD].every((id) => !idsLA.has(id)), '겹치는 사람이 있다');

  const statsLD = await statsRepo.getYearStats(LD, null);
  eq('개인 장부 통계는 개인 장부 금액만', statsLD.givenTotal, 30000);
  const recentLD = await entriesRepo.listRecentEntries(LD);
  eq('개인 장부 최근 기록은 1건', recentLD.length, 1);
  const upcomingLD = await eventsRepo.listUpcomingEvents(LD, '2026-01-01');
  eq('개인 장부 예정 행사는 1건', upcomingLD.length, 1);

  // 파괴적 RPC가 현재 장부 밖의 행에 닿지 않는가 (서버 RPC는 RLS만 타므로 앱이 막아야 한다)
  await expectError(
    '다른 장부의 사람은 삭제 RPC로 못 지운다',
    () => peopleRepo.deletePerson(LA, dPerson.id),
    '이미 삭제된 사람',
  );
  const stillThere = await peopleRepo.getPerson(LD, dPerson.id);
  check('삭제 시도 후에도 그 사람은 남아 있다', stillThere !== null, '다른 장부의 사람이 지워졌다');

  await expectError(
    '다른 장부의 사람은 병합 대상이 될 수 없다',
    () => peopleRepo.mergePeople(LA, dPerson.id, p1.id),
    '이미 삭제된 사람',
  );
  await expectError(
    '다른 장부의 행사는 집계할 수 없다',
    () => eventsRepo.getEventSummary(LA, dEvent.id),
    '이 장부의 행사가 아닙니다',
  );

  // ----------------------------------------------------- 병합·삭제와 오류 문구
  await actAs(alice);
  const dup = await peopleRepo.createPerson(LA, { name: '김철수', relation_group: 'work' });
  const dupEvent = await eventsRepo.createEvent(LA, {
    type: 'funeral',
    is_mine: false,
    host_person_id: dup.id,
    title: '김철수 부친상 2024',
    date: '2024-11-11',
  });
  await entriesRepo.createEntry(LA, { event_id: dupEvent.id, person_id: dup.id, amount: 70000 });

  await expectError(
    '공동 부조로 묶인 두 사람은 합칠 수 없다',
    () => peopleRepo.mergePeople(LA, p2.id, p1.id),
    '공동 부조로 묶인',
  );

  await peopleRepo.mergePeople(LA, dup.id, p1.id);
  const afterMerge = await peopleRepo.getPersonBalance(LA, p1.id);
  eq('병합 후 준 합계가 합쳐진다', afterMerge.given_total, 170000);
  const goneDup = await peopleRepo.getPerson(LA, dup.id);
  eq('병합된 사람은 사라진다', goneDup, null);
  const movedEvent = await eventsRepo.getEvent(LA, dupEvent.id);
  eq('행사 당사자도 옮겨진다', movedEvent.host_person_id, p1.id);

  await expectError(
    '기록이 있는 행사는 내 행사 여부를 못 바꾼다',
    () => eventsRepo.updateEvent(LA, e1.id, { is_mine: true, host_person_id: null }),
    '바꿀 수 없습니다',
  );

  await eventsRepo.deleteEvent(LA, e1.id);
  const afterEventDelete = await entriesRepo.listEntriesByEvent(LA, e1.id);
  eq('행사를 지우면 기록도 사라진다', afterEventDelete.rows.length, 0);
  const personStill = await peopleRepo.getPerson(LA, p1.id);
  check('사람은 남는다', personStill !== null, '사람이 같이 지워졌다');

  // ------------------------------------------------- 구성원 제거와 계정 삭제
  await actAs(bob);
  await expectError(
    'member는 다른 구성원을 못 내보낸다',
    () => ledgersRepo.removeMember(LA, alice.id),
    '만든 사람만',
  );

  await actAs(carol);
  await expectError(
    '마지막 구성원은 장부를 못 나간다',
    () => ledgersRepo.removeMember(LC, carol.id),
    '유일한 구성원',
  );

  await actAs(alice);
  await ledgersRepo.renameLedger(LA, '우리 집 장부');
  const renamed = await ledgersRepo.getLedger(LA);
  eq('구성원은 장부 이름을 바꿀 수 있다', renamed.name, '우리 집 장부');

  // 앞 단계에서 누가 더 합류했을 수 있으므로 내보내기 전후 차이로 본다.
  const membersBefore = await ledgersRepo.listMembers(LA);
  await ledgersRepo.removeMember(LA, bob.id);
  const membersAfter = await ledgersRepo.listMembers(LA);
  eq('내보내면 구성원이 한 명 줄어든다', membersAfter.length, membersBefore.length - 1);
  check(
    '내보낸 사람이 목록에서 사라진다',
    membersAfter.every((m) => m.user_id !== bob.id),
    '아직 남아 있다',
  );
  const bobAfter = await (async () => {
    await actAs(bob);
    const list = await ledgersRepo.listMyLedgers(bob.id);
    await actAs(alice);
    return list;
  })();
  eq('내보내진 계정은 장부가 0권이 된다', bobAfter.length, 0);

  await actAs(carol);
  await ledgersRepo.prepareAccountDeletion();
  const carolAfter = await ledgersRepo.listMyLedgers(carol.id);
  eq('계정 삭제 준비 후 장부 0권', carolAfter.length, 0);

  // ------------------------------------------------ 메일·비밀번호 인증 한살이
  //
  // 메일을 실제로 보내는 경로(가입·재발송·재설정 요청)는 Supabase 내장 SMTP의 시간당 제한에
  // 걸리면 통째로 실패한다. 메일이 안 가는 정도가 아니라 **가입 API 자체가 429로 거부된다.**
  // 그래서 메일을 보내지 않는 경로는 관리자 API로 만든 계정으로 항상 검증하고,
  // 메일을 보내는 경로는 제한에 걸리면 건너뛴다(출시 전 커스텀 SMTP가 필요한 이유다).
  const mailPw = 'Ppurin-Mail-2026a1';
  const newPw = 'Ppurin-Mail-2026b2';

  // (1) 메일을 보내지 않는 경로 — 언제나 검증한다
  const confirmed = await makeUser('mail', '메일사용자');
  setDb(createDb(URL, ANON));

  const wrongPw = await emailAuth.signInWithEmail(confirmed.email, 'WrongPassword123');
  check(
    '틀린 비밀번호는 자격 증명 오류로 구분된다',
    wrongPw.ok === false && wrongPw.error.kind === 'invalid_credentials',
    JSON.stringify(wrongPw),
  );
  check(
    '오류 문구가 영문 원문이 아니라 약속된 한국어다',
    wrongPw.ok === false &&
      wrongPw.error.message === '메일 주소 또는 비밀번호가 올바르지 않습니다.',
    wrongPw.ok ? '' : wrongPw.error.message,
  );

  const signedIn = await emailAuth.signInWithEmail(confirmed.email, PW);
  check('확인된 계정은 메일·비밀번호로 로그인된다', signedIn.ok === true, JSON.stringify(signedIn));

  const mailLedgers = await ledgersRepo.listMyLedgers(confirmed.id);
  eq('메일 계정에도 개인 장부가 자동으로 생긴다', mailLedgers.length, 1);
  eq('그 계정이 owner다', mailLedgers[0].role, 'owner');

  const changed = await emailAuth.updatePassword(newPw);
  check('로그인 상태에서 비밀번호를 바꾼다', changed.ok === true, JSON.stringify(changed));

  setDb(createDb(URL, ANON));
  const oldPwTry = await emailAuth.signInWithEmail(confirmed.email, PW);
  check('옛 비밀번호로는 로그인되지 않는다', oldPwTry.ok === false, JSON.stringify(oldPwTry));
  const newPwTry = await emailAuth.signInWithEmail(confirmed.email, newPw);
  checkUnlessRateLimited('새 비밀번호로 로그인된다', newPwTry, newPwTry.ok === true, JSON.stringify(newPwTry));

  // 메일 미확인 계정은 로그인이 막힌다(관리자 API로 확인 없이 만든다. 메일은 안 나간다).
  const pending = await admin.auth.admin.createUser({
    email: `pending-${tag}@ppurin-test.kr`,
    password: mailPw,
    email_confirm: false,
  });
  if (pending.data?.user) createdUsers.push(pending.data.user.id);
  setDb(createDb(URL, ANON));
  const beforeConfirm = await emailAuth.signInWithEmail(pending.data.user.email, mailPw);
  checkUnlessRateLimited(
    '메일 확인 전에는 로그인이 막히고 그렇게 안내한다',
    beforeConfirm,
    beforeConfirm.ok === false && beforeConfirm.error.kind === 'email_not_confirmed',
    JSON.stringify(beforeConfirm),
  );

  // (2) 메일을 보내는 경로 — 제한에 걸리면 건너뛴다
  const fresh = `signup-${tag}@ppurin-test.kr`;
  const signedUp = await emailAuth.signUpWithEmail(fresh, mailPw, 'ppurin://auth/confirm');
  // 메일 발송 계통 실패는 우리 코드 결함이 아니다. 429(속도 제한)든 5xx(메일러 오류)든
  // 같은 원인(내장 SMTP)이라 SKIP으로 통일한다. 다만 원문을 남겨 다음 사람이 확인할 수 있게 한다.
  const mailPathBlocked =
    !signedUp.ok &&
    (signedUp.error.kind === 'rate_limited' || (signedUp.error.detail?.status ?? 0) >= 500);
  if (mailPathBlocked) {
    console.log('  SKIP  가입·재발송·재설정 — 메일 발송 계통이 막혔다(내장 SMTP, 커스텀 SMTP 필요)');
    console.log(`        서버 원문 ${JSON.stringify(signedUp.error.detail)}`);
  } else {
    check(
      '가입이 성공한다',
      signedUp.ok === true,
      signedUp.ok ? '' : `서버 원문 ${JSON.stringify(signedUp.error.detail)}`,
    );
    if (signedUp.ok) {
      eq('메일 확인이 켜져 있어 세션이 바로 생기지 않는다', signedUp.needsConfirmation, true);
    }
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const found = list.users.find((u) => u.email === fresh);
    if (found) createdUsers.push(found.id);
    check('가입한 사용자가 서버에 생겼다', Boolean(found), fresh);
    eq('아직 메일 미확인 상태다', found?.email_confirmed_at ?? null, null);

    const again = await emailAuth.signUpWithEmail(fresh, mailPw, 'ppurin://auth/confirm');
    check(
      '이미 가입된 메일은 한국어로 안내한다',
      again.ok === false &&
        (again.error.kind === 'already_registered' || again.error.kind === 'rate_limited'),
      JSON.stringify(again),
    );

    // 확인 메일 재발송 — check-email 화면이 실제로 부르는 경로다.
    const resent = await emailAuth.resendConfirmation(fresh, 'ppurin://auth/confirm');
    check(
      '확인 메일 재발송이 받아들여지거나 속도 제한으로 구분된다',
      resent.ok === true || (resent.ok === false && resent.error.kind === 'rate_limited'),
      JSON.stringify(resent),
    );

    // 확인이 끝난 계정에 재발송을 부르면 서버가 거부한다. 영문이 새지 않는지 본다.
    const resendConfirmed = await emailAuth.resendConfirmation(
      confirmed.email,
      'ppurin://auth/confirm',
    );
    check(
      '이미 확인된 계정의 재발송 결과도 한국어로 나온다',
      resendConfirmed.ok === true ||
        (resendConfirmed.ok === false && /[가-힣]/.test(resendConfirmed.error.message)),
      JSON.stringify(resendConfirmed),
    );
  }

  const resetRequested = await emailAuth.requestPasswordReset(
    confirmed.email,
    'ppurin://auth/reset',
  );
  check(
    '재설정 메일 요청이 받아들여지거나 속도 제한으로 구분된다',
    resetRequested.ok === true ||
      (resetRequested.ok === false && resetRequested.error.kind === 'rate_limited'),
    JSON.stringify(resetRequested),
  );

  console.log(`\n== 요약  통과 ${pass} · 실패 ${fail} · 건너뜀 ${skipped}\n`);
  if (skipped > 0) {
    console.log('건너뛴 검사는 Supabase 속도 제한 때문이며 커스텀 SMTP를 붙이면 사라진다.\n');
  }
  if (failures.length) {
    console.log('실패 목록');
    for (const f of failures) console.log(`  - ${f}`);
  }
}

main()
  .catch((error) => {
    fail += 1;
    console.error('\n예기치 못한 오류:', error?.message ?? error);
    if (error?.stack) console.error(error.stack.split('\n').slice(1, 4).join('\n'));
  })
  .finally(async () => {
    cleanedUp = await cleanup();
    console.log(`정리 완료 — 테스트 계정 ${cleanedUp}개 삭제`);
    process.exit(fail > 0 ? 1 : 0);
  });
