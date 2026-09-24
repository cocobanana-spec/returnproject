// 기록 리포지토리. 준돈/받은돈 방향은 컬럼이 아니라 소속 행사의 is_mine에서 파생된다
import { db } from '../lib/supabaseClient.ts';
import type { Tables, TablesInsert, TablesUpdate } from '../db/database.types.ts';
import { pageRange, RepositoryError, toPage, unwrap, type Page, type PageParams } from './types.ts';

export type Entry = Tables<'entries'>;

// 목록에서 한 줄을 그리는 데 필요한 것만 붙여 온다.
// 측 라벨까지 붙여 온다. 기록 상세에서 측을 고치려면 행사에 측이 있는지 알아야 한다.
const WITH_CONTEXT =
  '*, event:events(id, title, type, is_mine, date, date_precision, side_a_label, side_b_label), ' +
  'person:people!person_id(id, name, label), ' +
  'co_person:people!co_person_id(id, name, label)';

// 방향으로 거르려면 행사를 inner join 해야 한다. 바깥 조인이면 조건이 걸리지 않는다.
const WITH_CONTEXT_INNER = WITH_CONTEXT.replace('event:events(', 'event:events!inner(');

export type EntryWithContext = Entry & {
  event: Pick<
    Tables<'events'>,
    'id' | 'title' | 'type' | 'is_mine' | 'date' | 'date_precision' | 'side_a_label' | 'side_b_label'
  > | null;
  person: Pick<Tables<'people'>, 'id' | 'name' | 'label'> | null;
  co_person: Pick<Tables<'people'>, 'id' | 'name' | 'label'> | null;
};

// 사람 원장. 대표자이거나 공동 부조자인 기록을 모두 본다(docs/03 §4).
export async function listEntriesByPerson(
  ledgerId: string,
  personId: string,
  opts?: PageParams,
): Promise<Page<EntryWithContext>> {
  const { from, to, limit } = pageRange(opts);
  const rows = unwrap(
    await db()
      .from('entries')
      .select(WITH_CONTEXT)
      .eq('ledger_id', ledgerId)
      .or(`person_id.eq.${personId},co_person_id.eq.${personId}`)
      .order('created_at', { ascending: false })
      .range(from, to),
  );
  return toPage(rows as unknown as EntryWithContext[], from, limit);
}

export async function listEntriesByEvent(
  ledgerId: string,
  eventId: string,
  opts?: { side?: 'a' | 'b' | null; unconfirmedOnly?: boolean; unreturnedOnly?: boolean } & PageParams,
): Promise<Page<EntryWithContext>> {
  const { from, to, limit } = pageRange(opts);
  let query = db()
    .from('entries')
    .select(WITH_CONTEXT)
    .eq('ledger_id', ledgerId)
    .eq('event_id', eventId);

  if (opts?.side) query = query.eq('side', opts.side);
  if (opts?.unconfirmedOnly) query = query.is('amount', null);
  if (opts?.unreturnedOnly) query = query.is('returned_at', null);

  const rows = unwrap(await query.order('created_at', { ascending: false }).range(from, to));
  return toPage(rows as unknown as EntryWithContext[], from, limit);
}

// 방향별 기록 목록. 홈의 준돈·받은돈 탭이 쓴다.
//
// 방향은 entries에 컬럼이 없고 소속 행사의 is_mine에서 파생된다(docs/03 결정 5). 그래서
// events를 !inner로 묶어 걸러야 한다. 정렬도 마찬가지로 행사 날짜를 봐야 하는데,
// PostgREST에서 부모 행을 조인 컬럼으로 정렬하려면 `event(date)` 형태여야 한다.
// `referencedTable` 옵션은 임베드된 쪽만 정렬하고 부모 순서는 그대로 두므로 쓰면 안 된다
// (2026-09-24 실측. 날짜가 뒤섞인 채로 조용히 돌아온다).
export async function listEntriesByDirection(
  ledgerId: string,
  isMine: boolean,
  opts?: PageParams,
): Promise<Page<EntryWithContext>> {
  const { from, to, limit } = pageRange(opts);
  const rows = unwrap(
    await db()
      .from('entries')
      .select(WITH_CONTEXT_INNER)
      .eq('ledger_id', ledgerId)
      .eq('event.is_mine', isMine)
      .order('event(date)', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to),
  );
  return toPage(rows as unknown as EntryWithContext[], from, limit);
}

export async function listRecentEntries(
  ledgerId: string,
  limit = 10,
): Promise<EntryWithContext[]> {
  const rows = unwrap(
    await db()
      .from('entries')
      .select(WITH_CONTEXT)
      .eq('ledger_id', ledgerId)
      .order('created_at', { ascending: false })
      .limit(limit),
  );
  return rows as unknown as EntryWithContext[];
}

export async function getEntry(
  ledgerId: string,
  entryId: string,
): Promise<EntryWithContext | null> {
  const { data, error } = await db()
    .from('entries')
    .select(WITH_CONTEXT)
    .eq('ledger_id', ledgerId)
    .eq('id', entryId)
    .maybeSingle();
  return unwrap({ data, error }) as unknown as EntryWithContext | null;
}

// created_by는 서버 기본값(auth.uid())이 채운다. 앱이 보내지 않는다.
export type NewEntry = Omit<TablesInsert<'entries'>, 'ledger_id' | 'id' | 'created_by'>;

export async function createEntry(ledgerId: string, input: NewEntry): Promise<Entry> {
  const rows = unwrap(
    await db()
      .from('entries')
      .insert({ ...input, ledger_id: ledgerId })
      .select('*'),
  );
  return rows[0] as Entry;
}

export type EntryPatch = Omit<TablesUpdate<'entries'>, 'ledger_id' | 'id' | 'created_by'>;

export async function updateEntry(
  ledgerId: string,
  entryId: string,
  patch: EntryPatch,
): Promise<Entry> {
  const { ledger_id: _l, created_by: _c, ...safe } = patch as EntryPatch & {
    ledger_id?: string;
    created_by?: string;
  };
  const rows = unwrap(
    await db()
      .from('entries')
      .update(safe)
      .eq('ledger_id', ledgerId)
      .eq('id', entryId)
      .select('*'),
  );
  // PostgREST는 대상 행이 없어도 오류가 아니라 빈 배열을 준다. 그걸 성공으로 읽으면
  // 이미 지워졌거나 다른 장부가 된 기록을 "저장했다"고 안내하게 된다.
  const updated = rows[0] as Entry | undefined;
  if (!updated) throw new RepositoryError('이미 지워졌거나 접근할 수 없는 기록입니다.');
  return updated;
}

export async function deleteEntry(ledgerId: string, entryId: string): Promise<void> {
  unwrap(
    await db()
      .from('entries')
      .delete()
      .eq('ledger_id', ledgerId)
      .eq('id', entryId)
      .select('id'),
  );
}

// 답례 완료 토글. 체크하면 시각이 남고 해제하면 지워진다.
export async function setReturned(
  ledgerId: string,
  entryId: string,
  returned: boolean,
  memo?: string | null,
): Promise<Entry> {
  return updateEntry(ledgerId, entryId, {
    returned_at: returned ? new Date().toISOString() : null,
    return_memo: returned ? (memo ?? null) : null,
  });
}
