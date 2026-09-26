-- 장부 초기화 RPC — 현재 장부의 사람·행사·기록을 전부 지운다. 장부와 구성원은 남는다
--
-- 배경. 사용자가 "더보기 > 장부초기화 기능 있었으면 좋겠다"고 했다(2026-09-26). 시험 삼아 넣어 본
-- 데이터를 정리하고 처음부터 시작하는 길이다.
--
-- **되돌릴 수 없다.** 2026-09-24에 정리 절차가 실계정을 지운 사고가 있었다(context-notes §14.6).
-- 그래서 이 함수는 두 가지를 지킨다.
--   ① 첫 인자는 p_ledger_id이고 기본값이 없다(0003의 약속). 호출부가 장부를 빼먹으면 통과하지 못한다.
--   ② SECURITY INVOKER라 RLS를 그대로 탄다. 그 위에 구성원 검사를 한 번 더 명시한다 —
--      RLS는 "내가 구성원인 모든 장부"를 허용하므로, 지금 보고 있지 않은 다른 장부를
--      실수로 비우는 경로를 서버가 스스로 막아야 한다.
--
-- 지우는 순서는 기록 → 행사 → 사람이다. entries가 events·people을 참조하므로 거꾸로 지우면
-- 외래키에 걸린다. 반환값은 실제로 지운 건수다 — 화면이 "정말 이만큼 지웠다"를 보여 줄 수 있다.

create function public.reset_ledger(p_ledger_id uuid)
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
  '장부의 사람·행사·기록을 전부 지운다. 장부와 구성원은 남는다. 되돌릴 수 없다.';
