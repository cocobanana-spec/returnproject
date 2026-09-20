-- 데이터 RPC 3종이 장부를 서버에서 직접 검사하게 한다 — 방어가 앱에만 있던 것을 서버로 내린다
--
-- 배경. delete_person·merge_people·event_summary는 SECURITY INVOKER라 RLS만 탄다.
-- 그런데 RLS는 "내가 구성원인 모든 장부"를 허용하므로, 두 장부의 구성원이 현재 보고 있지 않은
-- 다른 장부의 사람을 지우거나 합치거나 집계할 수 있었다(앱 토대 QA가 원격에서 재현).
-- 권한 침해는 아니지만 화면 맥락과 무관한 장부가 조용히 바뀌는 경로다.
-- 앱 리포지토리가 호출 전에 소속을 확인하도록 막아 두었으나, 서버가 스스로 지키는 편이 옳다.
--
-- 인자에 기본값을 주지 않는다. 기본값이 있으면 호출부가 장부를 빼먹어도 그대로 통과한다.

drop function if exists public.delete_person(uuid);
drop function if exists public.merge_people(uuid, uuid);
drop function if exists public.event_summary(uuid);

create function public.delete_person(p_ledger_id uuid, p_id uuid) returns void
language plpgsql set search_path = public, pg_temp as $$
declare v_ledger uuid; v_hosted uuid[];
begin
  select ledger_id into v_ledger from public.people where id = p_id;
  if v_ledger is null then
    raise exception 'person_not_found' using errcode = 'no_data_found';
  end if;
  if v_ledger <> p_ledger_id then
    raise exception 'wrong_ledger' using errcode = 'check_violation';
  end if;

  -- 정리 대상은 "이 사람이 당사자이던" 행사로 한정한다.
  -- 장부 전체의 고아 행사를 쓸어 담으면 미리 등록해 둔 예정 행사까지 지워진다(docs/02 §5).
  select coalesce(array_agg(id), '{}'::uuid[]) into v_hosted
    from public.events where host_person_id = p_id;

  delete from public.people where id = p_id;

  delete from public.events e
   where e.id = any(v_hosted)
     and e.host_person_id is null
     and not exists (select 1 from public.entries en where en.event_id = e.id);
end $$;

create function public.merge_people(p_ledger_id uuid, p_victim uuid, p_survivor uuid) returns void
language plpgsql set search_path = public, pg_temp as $$
declare v_victim_ledger uuid; v_survivor_ledger uuid;
begin
  if p_victim = p_survivor then
    raise exception 'merge_same_person' using errcode = 'check_violation';
  end if;

  select ledger_id into v_victim_ledger   from public.people where id = p_victim;
  select ledger_id into v_survivor_ledger from public.people where id = p_survivor;
  if v_victim_ledger is null or v_survivor_ledger is null then
    raise exception 'person_not_found' using errcode = 'no_data_found';
  end if;
  -- 둘이 서로 다른 장부인지를 먼저 본다. 호출자가 넘긴 장부와 맞는지는 그 다음이다.
  if v_victim_ledger <> v_survivor_ledger then
    raise exception 'different_ledger' using errcode = 'check_violation';
  end if;
  if v_victim_ledger <> p_ledger_id then
    raise exception 'wrong_ledger' using errcode = 'check_violation';
  end if;

  -- 부부를 하나로 합치려는 경우. 합치면 person_id = co_person_id가 되어 CHECK에 걸린다.
  if exists (
    select 1 from public.entries
     where (person_id = p_victim   and co_person_id = p_survivor)
        or (person_id = p_survivor and co_person_id = p_victim)
  ) then
    raise exception 'merge_would_self_reference' using errcode = 'check_violation';
  end if;

  update public.entries set person_id    = p_survivor where person_id    = p_victim;
  update public.entries set co_person_id = p_survivor where co_person_id = p_victim;
  update public.events  set host_person_id = p_survivor where host_person_id = p_victim;
  delete from public.people where id = p_victim;
end $$;

-- 읽기 전용이라 예외 대신 장부 조건을 걸어 0건으로 끝낸다. 다른 장부의 행사를 넣으면 빈 결과다.
create function public.event_summary(p_ledger_id uuid, p_event_id uuid)
returns table (
  side text, method text,
  cnt bigint, total bigint, unconfirmed bigint, returned bigint
)
language sql stable set search_path = public, pg_temp as $$
  select
    en.side,
    en.method,
    count(*)                                              as cnt,
    coalesce(sum(en.amount), 0)::bigint                    as total,
    count(*) filter (where en.amount is null)              as unconfirmed,
    count(*) filter (where en.returned_at is not null)     as returned
  from public.entries en
  where en.event_id = p_event_id
    and en.ledger_id = p_ledger_id
  group by en.side, en.method
$$;

revoke all on function public.delete_person(uuid, uuid)        from anon, authenticated, public;
revoke all on function public.merge_people(uuid, uuid, uuid)   from anon, authenticated, public;
revoke all on function public.event_summary(uuid, uuid)        from anon, authenticated, public;
grant execute on function public.delete_person(uuid, uuid)      to authenticated;
grant execute on function public.merge_people(uuid, uuid, uuid) to authenticated;
grant execute on function public.event_summary(uuid, uuid)      to authenticated;

-- 금액 상한. 앱은 10억으로 막지만 DB에는 상한이 없어 실수나 다른 클라이언트를 거르지 못했다.
alter table public.entries
  add constraint entries_amount_max check (amount is null or amount <= 1000000000);
