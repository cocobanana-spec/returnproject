// 행사 리포지토리. 빠른 기록의 "기존 행사에 추가?" 판정도 여기 있다
import { db } from '../lib/supabaseClient.ts';
import type { Tables, TablesInsert, TablesUpdate } from '../db/database.types.ts';
import { dateWindow } from '../domain/title.ts';
import type { EventType } from '../domain/constants.ts';
import { foldEventSummary, type EventSummary } from '../domain/stats.ts';
import { RepositoryError, pageRange, toPage, unwrap, type Page, type PageParams } from './types.ts';

export type EventRow = Tables<'events'>;

export async function listEvents(
  ledgerId: string,
  opts?: { isMine?: boolean | null } & PageParams,
): Promise<Page<EventRow>> {
  const { from, to, limit } = pageRange(opts);
  let query = db().from('events').select('*').eq('ledger_id', ledgerId);
  if (opts?.isMine !== undefined && opts.isMine !== null) {
    query = query.eq('is_mine', opts.isMine);
  }
  // 같은 날 행사가 흔하다. 타이브레이커가 없으면 페이지 사이에서 행이 겹치거나 빠진다.
  const rows = unwrap(
    await query.order('date', { ascending: false }).order('id', { ascending: true }).range(from, to),
  );
  return toPage(rows, from, limit);
}

// 홈의 "다가오는 행사". 오늘 이후 날짜를 가까운 순으로 몇 건만 본다.
export async function listUpcomingEvents(
  ledgerId: string,
  today: string,
  limit = 3,
): Promise<EventRow[]> {
  return unwrap(
    await db()
      .from('events')
      .select('*')
      .eq('ledger_id', ledgerId)
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(limit),
  );
}

export async function getEvent(ledgerId: string, eventId: string): Promise<EventRow | null> {
  const { data, error } = await db()
    .from('events')
    .select('*')
    .eq('ledger_id', ledgerId)
    .eq('id', eventId)
    .maybeSingle();
  return unwrap({ data, error });
}

// 같은 당사자·같은 종류·±7일 행사를 찾는다. 당사자로 판정하므로 기록이 0건인 예정 행사도 잡힌다.
export async function findMatchingEvent(
  ledgerId: string,
  params: { hostPersonId: string; type: EventType; date: string },
): Promise<EventRow[]> {
  const { from, to } = dateWindow(params.date);
  return unwrap(
    await db()
      .from('events')
      .select('*')
      .eq('ledger_id', ledgerId)
      .eq('is_mine', false)
      .eq('host_person_id', params.hostPersonId)
      .eq('type', params.type)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })
      .limit(10),
  );
}

export type NewEvent = Omit<TablesInsert<'events'>, 'ledger_id' | 'id'>;

export async function createEvent(ledgerId: string, input: NewEvent): Promise<EventRow> {
  const rows = unwrap(
    await db()
      .from('events')
      .insert({ ...input, ledger_id: ledgerId })
      .select('*'),
  );
  return rows[0] as EventRow;
}

export type EventPatch = Omit<TablesUpdate<'events'>, 'ledger_id' | 'id'>;

export async function updateEvent(
  ledgerId: string,
  eventId: string,
  patch: EventPatch,
): Promise<EventRow> {
  const { ledger_id: _omit, ...safe } = patch as EventPatch & { ledger_id?: string };
  const rows = unwrap(
    await db()
      .from('events')
      .update(safe)
      .eq('ledger_id', ledgerId)
      .eq('id', eventId)
      .select('*'),
  );
  return rows[0] as EventRow;
}

// 행사를 지우면 소속 기록도 FK CASCADE로 함께 사라진다. 사람은 남는다.
export async function deleteEvent(ledgerId: string, eventId: string): Promise<void> {
  unwrap(
    await db()
      .from('events')
      .delete()
      .eq('ledger_id', ledgerId)
      .eq('id', eventId)
      .select('id'),
  );
}

// 측별·형태별 집계. 서버가 쪼개 준 행을 도메인 함수가 화면 모양으로 접는다.
export async function getEventSummary(
  ledgerId: string,
  eventId: string,
): Promise<EventSummary> {
  // 서버 함수도 0003부터 장부 조건을 건다. 여기서 먼저 보는 것은 "없는 행사"와
  // "다른 장부의 행사"를 빈 집계가 아니라 분명한 오류로 구분해 보여 주기 위해서다.
  const event = await getEvent(ledgerId, eventId);
  if (!event) throw new RepositoryError('이 장부의 행사가 아닙니다.', 'event_not_found');

  const { data, error } = await db().rpc('event_summary', {
    p_ledger_id: ledgerId,
    p_event_id: eventId,
  });
  const rows = unwrap({ data, error });
  return foldEventSummary(rows ?? []);
}
