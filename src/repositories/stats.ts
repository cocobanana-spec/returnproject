// 통계 리포지토리. 서버 RPC가 연도·방향·종류·그룹으로 쪼갠 행을 도메인 함수가 접는다
import { db } from '../lib/supabaseClient.ts';
import { foldYearStats, type YearStats } from '../domain/stats.ts';
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
