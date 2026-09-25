// 사람 리포지토리. 수지가 붙은 목록은 person_balances 뷰에서 가져온다
import { db } from '../lib/supabaseClient.ts';
import { normalizeName } from '../domain/name.ts';
import type { Tables, TablesInsert, TablesUpdate } from '../db/database.types.ts';
import { RepositoryError, pageRange, toPage, unwrap, type Page, type PageParams } from './types.ts';

export type Person = Tables<'people'>;
export type PersonBalance = Tables<'person_balances'>;

export type PeopleSort = 'name' | 'recent' | 'balance';

// 사용자가 친 %·_ 가 LIKE 와일드카드로 동작하지 않도록 지운다. 이름 정규화 규칙도 함께 건다.
function escapeLikePrefix(raw: string): string {
  return normalizeName(raw).replace(/[%_\\]/g, '');
}

export async function listPeople(
  ledgerId: string,
  opts?: { sort?: PeopleSort; relationGroup?: string | null; search?: string | null } & PageParams,
): Promise<Page<PersonBalance>> {
  const { from, to, limit } = pageRange(opts);
  let query = db().from('person_balances').select('*').eq('ledger_id', ledgerId);

  if (opts?.relationGroup) query = query.eq('relation_group', opts.relationGroup);
  if (opts?.search) query = query.like('name_normalized', `${escapeLikePrefix(opts.search)}%`);

  if (opts?.sort === 'recent') {
    query = query.order('last_entry_at', { ascending: false, nullsFirst: false });
  } else if (opts?.sort === 'balance') {
    query = query.order('balance', { ascending: false, nullsFirst: false });
  }
  // 정렬이 같은 행의 순서가 흔들리지 않도록 마지막 키를 고정한다.
  query = query.order('name_normalized', { ascending: true });

  const rows = unwrap(await query.range(from, to));
  return toPage(rows, from, limit);
}

// 이름 자동완성. prefix는 반드시 normalizeName()을 거친 값이어야 한다.
export async function searchPeopleByPrefix(
  ledgerId: string,
  prefix: string,
  limit = 8,
): Promise<PersonBalance[]> {
  if (prefix.length === 0) return [];
  return unwrap(
    await db()
      .from('person_balances')
      .select('*')
      .eq('ledger_id', ledgerId)
      .like('name_normalized', `${escapeLikePrefix(prefix)}%`)
      .order('last_entry_at', { ascending: false, nullsFirst: false })
      .order('name_normalized', { ascending: true })
      .limit(limit),
  );
}

// 입력 전에 보여 주는 "최근 기록한 사람" 칩.
export async function listRecentPeople(ledgerId: string, limit = 5): Promise<PersonBalance[]> {
  return unwrap(
    await db()
      .from('person_balances')
      .select('*')
      .eq('ledger_id', ledgerId)
      .not('last_entry_at', 'is', null)
      .order('last_entry_at', { ascending: false })
      .limit(limit),
  );
}

// 같은 이름이 이미 있는지. 저장 직전 중복 경고에 쓴다.
export async function findByNormalizedName(
  ledgerId: string,
  nameNormalized: string,
): Promise<PersonBalance[]> {
  return unwrap(
    await db()
      .from('person_balances')
      .select('*')
      .eq('ledger_id', ledgerId)
      .eq('name_normalized', nameNormalized),
  );
}

// 정규화 이름 목록으로 같은 이름의 사람들을 한 번에 받는다. 가져오기 미리보기가 쓴다.
export async function listPeopleByNormalizedNames(
  ledgerId: string,
  keys: string[],
): Promise<PersonBalance[]> {
  if (keys.length === 0) return [];
  return unwrap(
    await db().from('person_balances').select('*').eq('ledger_id', ledgerId).in('name_normalized', keys),
  );
}

// id 목록으로 사람 요약을 받는다. 통계의 사람별 상위가 라벨을 붙일 때 쓴다(RPC 결과에는 라벨이 없다).
export async function listPeopleByIds(ledgerId: string, ids: string[]): Promise<PersonBalance[]> {
  if (ids.length === 0) return [];
  return unwrap(
    await db().from('person_balances').select('*').eq('ledger_id', ledgerId).in('id', ids),
  );
}

export async function getPerson(ledgerId: string, personId: string): Promise<Person | null> {
  const { data, error } = await db()
    .from('people')
    .select('*')
    .eq('ledger_id', ledgerId)
    .eq('id', personId)
    .maybeSingle();
  return unwrap({ data, error });
}

export async function getPersonBalance(
  ledgerId: string,
  personId: string,
): Promise<PersonBalance | null> {
  const { data, error } = await db()
    .from('person_balances')
    .select('*')
    .eq('ledger_id', ledgerId)
    .eq('id', personId)
    .maybeSingle();
  return unwrap({ data, error });
}

export type NewPerson = Omit<TablesInsert<'people'>, 'ledger_id' | 'id'>;

export async function createPerson(ledgerId: string, input: NewPerson): Promise<Person> {
  const rows = unwrap(
    await db()
      .from('people')
      .insert({ ...input, ledger_id: ledgerId })
      .select('*'),
  );
  return rows[0] as Person;
}

// ledger_id는 바꿀 수 없다(서버 트리거가 막는다). 패치에서 아예 제외한다.
export type PersonPatch = Omit<TablesUpdate<'people'>, 'ledger_id' | 'id'>;

export async function updatePerson(
  ledgerId: string,
  personId: string,
  patch: PersonPatch,
): Promise<Person> {
  const { ledger_id: _omit, ...safe } = patch as PersonPatch & { ledger_id?: string };
  const rows = unwrap(
    await db()
      .from('people')
      .update(safe)
      .eq('ledger_id', ledgerId)
      .eq('id', personId)
      .select('*'),
  );
  return rows[0] as Person;
}

// 서버 함수도 0003부터 p_ledger_id를 받아 장부를 검사한다(wrong_ledger).
// 여기서 한 번 더 보는 것은 사용자에게 보일 문구를 만들기 위해서다.
async function assertInLedger(ledgerId: string, personId: string): Promise<void> {
  const found = await getPerson(ledgerId, personId);
  if (!found) {
    throw new RepositoryError('이미 삭제된 사람입니다.', 'person_not_found');
  }
}

// 기록·공동 부조자 자리·당사자 자리를 서버 함수가 한 번에 정리한다.
export async function deletePerson(ledgerId: string, personId: string): Promise<void> {
  await assertInLedger(ledgerId, personId);
  const { error } = await db().rpc('delete_person', {
    p_ledger_id: ledgerId,
    p_id: personId,
  });
  unwrap({ data: null, error });
}

// victim의 세 참조 축을 survivor로 옮기고 victim을 지운다. 같은 장부끼리만 된다.
export async function mergePeople(
  ledgerId: string,
  victimId: string,
  survivorId: string,
): Promise<void> {
  await assertInLedger(ledgerId, victimId);
  await assertInLedger(ledgerId, survivorId);
  const { error } = await db().rpc('merge_people', {
    p_ledger_id: ledgerId,
    p_victim: victimId,
    p_survivor: survivorId,
  });
  unwrap({ data: null, error });
}
