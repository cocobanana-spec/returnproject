// 장부와 구성원 리포지토리. 초대·합류·탈퇴·계정 삭제 준비는 전부 서버 RPC를 부른다
import { db } from '../lib/supabaseClient.ts';
import type { Tables } from '../db/database.types.ts';
import { toRepositoryError, unwrap } from './types.ts';

export type Ledger = Tables<'ledgers'>;
export type LedgerMember = Tables<'ledger_members'>;

export type MyLedger = {
  ledgerId: string;
  name: string;
  role: 'owner' | 'member';
  joinedAt: string;
};

// 내가 속한 장부 목록.
// ledger_members의 SELECT 정책은 "내가 구성원인 장부의 모든 행"이라, user_id 필터를 빼면
// 공유 장부에서 배우자의 행까지 딸려 온다. 반드시 내 행만 고른다(docs/03 §9.2).
export async function listMyLedgers(userId: string): Promise<MyLedger[]> {
  const rows = unwrap(
    await db()
      .from('ledger_members')
      .select('ledger_id, role, created_at, ledgers(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
  );

  return rows.map((row) => ({
    ledgerId: row.ledger_id,
    name: row.ledgers?.name ?? '내 장부',
    role: row.role as 'owner' | 'member',
    joinedAt: row.created_at,
  }));
}

export async function getLedger(ledgerId: string): Promise<Ledger | null> {
  const { data, error } = await db()
    .from('ledgers')
    .select('*')
    .eq('id', ledgerId)
    .maybeSingle();
  return unwrap({ data, error });
}

// 이름만 고칠 수 있다. 다른 컬럼은 컬럼 권한이 없어 UPDATE 자체가 거부된다.
export async function renameLedger(ledgerId: string, name: string): Promise<void> {
  unwrap(await db().from('ledgers').update({ name }).eq('id', ledgerId).select('id'));
}

export async function listMembers(ledgerId: string): Promise<LedgerMember[]> {
  return unwrap(
    await db()
      .from('ledger_members')
      .select('*')
      .eq('ledger_id', ledgerId)
      .order('created_at', { ascending: true }),
  );
}

export async function createInviteCode(ledgerId: string): Promise<string> {
  const { data, error } = await db().rpc('create_invite_code', { p_ledger_id: ledgerId });
  return unwrap({ data, error });
}

// 합류하면 서버가 내 빈 개인 장부를 정리하고 합류한 장부 id를 돌려준다.
export async function joinLedger(code: string): Promise<string> {
  const { data, error } = await db().rpc('join_ledger', { p_code: code });
  return unwrap({ data, error });
}

// owner가 남을 내보내거나, 구성원이 스스로 나간다. 마지막 구성원은 나갈 수 없다.
export async function removeMember(ledgerId: string, userId: string): Promise<void> {
  const { error } = await db().rpc('remove_member', {
    p_ledger_id: ledgerId,
    p_user_id: userId,
  });
  unwrap({ data: null, error });
}

// 계정 삭제의 1단계. 실제 계정 삭제는 Edge Function delete-account가 이어서 한다.
export async function prepareAccountDeletion(): Promise<void> {
  const { error } = await db().rpc('prepare_account_deletion');
  unwrap({ data: null, error });
}

// 장부 초기화 — 사람·행사·기록을 전부 지운다. 장부와 구성원은 남는다(0007).
// **되돌릴 수 없다.** 화면은 장부 이름을 그대로 입력받은 뒤에만 이것을 부른다.
export type ResetCounts = { people: number; events: number; entries: number };

export async function resetLedger(ledgerId: string): Promise<ResetCounts> {
  const { data, error } = await db().rpc('reset_ledger', { p_ledger_id: ledgerId });
  if (error) throw toRepositoryError(error);
  const row = (data ?? [])[0];
  return {
    people: row?.people_deleted ?? 0,
    events: row?.events_deleted ?? 0,
    entries: row?.entries_deleted ?? 0,
  };
}

// 초기화 다이얼로그가 보여 줄 실제 건수. 행을 받지 않고 개수만 센다(head: true).
export async function countLedgerContents(ledgerId: string): Promise<ResetCounts> {
  const tables = ['people', 'events', 'entries'] as const;
  const [people, events, entries] = await Promise.all(
    tables.map(async (table) => {
      const { count, error } = await db()
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('ledger_id', ledgerId);
      if (error) throw toRepositoryError(error);
      return count ?? 0;
    }),
  );
  return { people: people ?? 0, events: events ?? 0, entries: entries ?? 0 };
}
