// 통계 리포지토리. 서버 RPC가 연도·방향·종류·그룹으로 쪼갠 행을 도메인 함수가 접는다
import { db } from '../lib/supabaseClient.ts';
import { foldYearStats, type StatsRow, type YearStats } from '../domain/stats.ts';
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
