-- 행사별 집계 RPC — 통계 화면(S11)의 "행사별" 블록에 쓴다
--
-- 배경. 홈 받은돈 탭을 준돈과 같은 평평한 목록으로 바꾸면서(2026-09-25 사용자 요청) 행사별
-- 구분이 통계로 옮겨왔다. 행사마다 event_summary를 부르면 행사 수만큼 왕복이 생기므로
-- 장부 전체를 한 번에 접어 주는 함수를 둔다.
--
-- 다른 데이터 RPC와 같은 약속을 지킨다. 첫 인자는 p_ledger_id이고 기본값이 없다(0003).
-- 앱이 생략할 수 있는 인자에는 기본값을 준다(0005의 교훈). SECURITY INVOKER라 RLS를 그대로 탄다.
-- 미확정(amount null)은 합계에서 빠지고 건수에는 들어간다. 뷰·다른 집계와 같은 규칙이다.

create function public.event_totals(
  p_ledger_id uuid,
  p_year int default null,
  p_is_mine boolean default null
)
returns table (
  event_id uuid, title text, type text, is_mine boolean, event_date date,
  cnt bigint, total bigint, unconfirmed bigint
)
language sql stable set search_path = public, pg_temp as $$
  select
    e.id,
    e.title,
    e.type,
    e.is_mine,
    e.date,
    count(en.id)                                            as cnt,
    coalesce(sum(en.amount), 0)::bigint                      as total,
    count(en.id) filter (where en.amount is null)            as unconfirmed
  from public.events e
  left join public.entries en
    on en.event_id = e.id
   and en.ledger_id = e.ledger_id
  where e.ledger_id = p_ledger_id
    and (p_year is null or extract(year from e.date)::int = p_year)
    and (p_is_mine is null or e.is_mine = p_is_mine)
  group by e.id
$$;

revoke all on function public.event_totals(uuid, int, boolean) from anon, authenticated, public;
grant execute on function public.event_totals(uuid, int, boolean) to authenticated;
