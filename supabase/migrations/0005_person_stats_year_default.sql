-- person_stats_by_year의 p_year에 DEFAULT NULL을 준다 — 연도를 생략하면 전체 기간이 되게 한다
--
-- 0004는 p_year를 기본값 없이 선언했다. SQL에서는 NULL을 명시해 부르면 되지만 PostgREST는
-- 인자를 생략한 호출을 "그 인자가 없는 함수"로 찾기 때문에, 앱이 전체 기간을 뜻하려고 p_year를
-- 빼면 404가 난다. 타입 생성기도 p_year를 필수로 내보내 tsc가 막혔다.
--
-- 본문은 0004와 글자 하나 다르지 않다. 바뀐 것은 시그니처의 default null 뿐이다.
-- p_ledger_id에는 여전히 기본값을 주지 않는다. 그건 장부 가드라 호출부가 빼먹으면 안 된다.
-- 같은 이름의 다른 오버로드가 없으므로 기본값이 호출 모호성을 만들지 않는다.

create or replace function public.person_stats_by_year(p_ledger_id uuid, p_year int default null)
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
