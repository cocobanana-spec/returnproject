-- 구성원이 모두 사라진 장부를 즉시 삭제한다 — 계정이 앱 밖에서 지워져도 개인정보가 주인 없이 남지 않게 한다
--
-- 배경. 정상 경로인 Edge Function delete-account는 prepare_account_deletion으로 혼자 쓰던 장부를 먼저 지운다.
-- 그러나 대시보드·관리자 API·지원 요청으로 auth.users에서 계정을 바로 지우면 ledger_members만 CASCADE로 사라지고
-- 장부와 그 안의 사람·행사·기록은 그대로 남는다. 구성원이 없으므로 RLS상 누구에게도 보이지 않고, 앱으로는 지울 수도 없다.
-- 실제 프로젝트 검증에서 이 상태의 고아 장부 2건을 확인해 아래 트리거를 추가했다.
--
-- 재귀는 일어나지 않는다. 장부를 지우면 ledger_members가 CASCADE로 지워지며 이 트리거가 다시 돌지만,
-- 그때 장부 행은 같은 트랜잭션의 앞선 명령이 이미 지운 뒤라 안쪽 DELETE가 0건으로 끝난다.
-- 구성원이 남아 있는데 owner만 사라진 경우도 같은 경로다. remove_member·prepare_account_deletion은
-- ensure_owner를 직접 부르지만 CASCADE 삭제는 아무것도 부르지 않아 owner 없는 장부가 된다.
-- owner가 없으면 초대 코드 발급과 구성원 제거가 영영 불가능하므로 여기서 함께 승계시킨다.
create function public.delete_orphan_ledger() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.ledger_members where ledger_id = old.ledger_id) then
    delete from public.ledgers where id = old.ledger_id;
  else
    perform public.ensure_owner(old.ledger_id);
  end if;
  return null;
end $$;

revoke all on function public.delete_orphan_ledger() from anon, authenticated, public;

create trigger ledger_members_delete_orphan after delete on public.ledger_members
  for each row execute function public.delete_orphan_ledger();
