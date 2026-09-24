-- 사람별 연도 집계 RPC — 통계 화면(S11)의 "차액이 큰 사람"에 연도 옵션을 붙인다
--
-- person_balances 뷰는 전체 기간만 센다. 연도를 고르면 그 해의 기록만으로 사람별 준·받은
-- 합계와 차액을 내야 하는데, 뷰에는 연도를 넣을 자리가 없어 함수로 만든다.
-- 규칙은 뷰와 같다. 공동 부조는 대표자와 공동 부조자 모두에게 전액(docs/02 질문 5 결정),
-- 미확정(amount null)은 합계에서 빠진다.
--
-- 다른 데이터 RPC와 같은 약속을 지킨다. 첫 인자는 p_ledger_id이고 기본값이 없다(0003).
-- SECURITY INVOKER라 RLS를 그대로 타며, 장부 조건을 함수 안에서 한 번 더 건다.
-- p_year가 NULL이면 전체 기간이다.

create function public.person_stats_by_year(p_ledger_id uuid, p_year int)
returns table (
  id uuid, name text, relation_group text,
  given_total bigint, received_total bigint, balance bigint, entry_count bigint
)
language sql stable set search_path = public, pg_temp as $$
  select
    p.id,
    p.name,
    p.relation_group,
    coalesce(sum(en.amount) filter (where not e.is_mine), 0)::bigint as given_total,
    coalesce(sum(en.amount) filter (where e.is_mine), 0)::bigint     as received_total,
    (coalesce(sum(en.amount) filter (where not e.is_mine), 0)
     - coalesce(sum(en.amount) filter (where e.is_mine), 0))::bigint  as balance,
    count(en.id)                                                      as entry_count
  from public.people p
  join public.entries en
    on en.ledger_id = p.ledger_id
   and (en.person_id = p.id or en.co_person_id = p.id)
  join public.events e
    on e.id = en.event_id
  where p.ledger_id = p_ledger_id
    and (p_year is null or extract(year from e.date)::int = p_year)
  group by p.id
$$;

revoke all on function public.person_stats_by_year(uuid, int) from anon, authenticated, public;
grant execute on function public.person_stats_by_year(uuid, int) to authenticated;
