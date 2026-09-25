// 통계 리포지토리. 서버 RPC가 연도·방향·종류·그룹으로 쪼갠 행을 도메인 함수가 접는다
import { db } from '../lib/supabaseClient.ts';
import {
  foldYearStats,
  type EventTotalRow,
  type PersonStatsRow,
  type StatsRow,
  type YearStats,
} from '../domain/stats.ts';
import { toRepositoryError } from './types.ts';

export async function getYearStats(
  ledgerId: string,
  year: number | null,
): Promise<YearStats> {
  const { data, error } = await db().rpc('stats_by_year', {
    p_ledger_id: ledgerId,
    ...(year === null ? {} : { p_year: year }),
  });
  if (error) throw toRepositoryError(error);
  return foldYearStats(data ?? []);
}

// 통계 화면(S11)이 쓰는 원본 행. 연도 세그먼트를 만들려면 접기 전의 연도가 필요해서
// 접지 않고 그대로 돌려준다. 연도마다 RPC를 부르지 않기 위한 것이기도 하다.
export async function listStatsRows(ledgerId: string): Promise<StatsRow[]> {
  const { data, error } = await db().rpc('stats_by_year', { p_ledger_id: ledgerId });
  if (error) throw toRepositoryError(error);
  return (data ?? []) as StatsRow[];
}

// 사람별 상위(S11). year가 null이면 전체 기간이다(마이그레이션 0004).
// 정렬과 상한은 서버에 맡긴다. 명부가 큰 장부는 한 해에도 수백 명이라 다 받아올 이유가 없다.
export async function listTopPeopleByYear(
  ledgerId: string,
  year: number | null,
  limit = 5,
): Promise<PersonStatsRow[]> {
  const { data, error } = await db()
    .rpc('person_stats_by_year', { p_ledger_id: ledgerId, ...(year === null ? {} : { p_year: year }) })
    .order('balance', { ascending: false })
    .order('name', { ascending: true })
    .limit(limit);
  if (error) throw toRepositoryError(error);
  return (data ?? []) as PersonStatsRow[];
}

// 행사별 집계(S11). year·isMine을 생략하면 전체다(마이그레이션 0006).
// 행사마다 event_summary를 부르지 않기 위한 함수다.
export async function listEventTotals(
  ledgerId: string,
  opts?: { year?: number | null; isMine?: boolean | null },
): Promise<EventTotalRow[]> {
  const { data, error } = await db().rpc('event_totals', {
    p_ledger_id: ledgerId,
    ...(opts?.year === null || opts?.year === undefined ? {} : { p_year: opts.year }),
    ...(opts?.isMine === null || opts?.isMine === undefined ? {} : { p_is_mine: opts.isMine }),
  });
  if (error) throw toRepositoryError(error);
  return (data ?? []) as EventTotalRow[];
}
