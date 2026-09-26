-- 장부 초기화를 owner만 할 수 있게 하고, 다른 RPC와 같은 권한 짝을 맞춘다
--
-- 배경. 0007은 두 가지가 빠졌다(2026-09-26 QA).
--   ① 다른 마이그레이션이 예외 없이 붙이는 `revoke all … from anon, authenticated, public` +
--      `grant execute … to authenticated` 짝이 없어 PUBLIC EXECUTE로 남았다.
--   ② 구성원이면 누구나 초기화할 수 있었다. 초기화는 장부 전체를 비우는 **가장 파괴적인 동작**이다.
--      구성원 제거(remove_member)도 owner만 할 수 있는데, 그보다 큰 동작이 더 느슨할 이유가 없다.
--      배우자가 합류한 공유 장부에서 한쪽이 실수로 비우면 다른 쪽의 기록까지 사라진다.
--      **owner만 한다.** 화면도 owner가 아니면 버튼을 보여 주지 않고 이유를 적는다.
--
-- 0007은 이미 원격에 적용됐으므로 여기서 함수를 바꾼다(create or replace). 시그니처는 그대로다.
-- 첫 인자 p_ledger_id, 기본값 없음, SECURITY INVOKER(RLS를 탄다), 그 위에 소유자 검사를 명시한다.

create or replace function public.reset_ledger(p_ledger_id uuid)
returns table (people_deleted bigint, events_deleted bigint, entries_deleted bigint)
language plpgsql set search_path = public, pg_temp as $$
declare
  v_entries bigint;
  v_events bigint;
  v_people bigint;
begin
  if not public.is_ledger_member(p_ledger_id) then
    raise exception 'not_member' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_ledger_owner(p_ledger_id) then
    raise exception 'not_owner' using errcode = 'insufficient_privilege';
  end if;

  with deleted as (
    delete from public.entries where ledger_id = p_ledger_id returning 1
  )
  select count(*) into v_entries from deleted;

  with deleted as (
    delete from public.events where ledger_id = p_ledger_id returning 1
  )
  select count(*) into v_events from deleted;

  with deleted as (
    delete from public.people where ledger_id = p_ledger_id returning 1
  )
  select count(*) into v_people from deleted;

  return query select v_people, v_events, v_entries;
end;
$$;

comment on function public.reset_ledger(uuid) is
  '장부의 사람·행사·기록을 전부 지운다. 장부와 구성원은 남는다. owner만 할 수 있고 되돌릴 수 없다.';

revoke all on function public.reset_ledger(uuid) from anon, authenticated, public;
grant execute on function public.reset_ledger(uuid) to authenticated;
