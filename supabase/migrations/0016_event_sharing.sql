-- 행사 단위 공동 관리 — 내 행사(받은 돈)를 초대 코드로 다른 사람과 같이 관리한다 (2026-10-04 사용자 요청)
--
-- 장부 공유(ledger_members)는 장부 전체(준 돈·받은 돈)를 넘기는 것이라 너무 컸다. 사용자가 원한 것은
-- "내 결혼식의 받은 돈 명부를 배우자·가족과 같이 적는 것"이다. 그래서 행사에 구성원을 붙인다.
--
-- 행사 구성원이 할 수 있는 것
--   · 그 행사(events 행)를 본다
--   · 그 행사의 기록(entries)을 보고·넣고·고치고·지운다
--   · 그 행사의 기록이 가리키는 사람(people)을 보고, 그 장부에 새 사람을 넣는다(명부 입력에 필요)
-- 할 수 없는 것
--   · 그 장부의 다른 행사·사람·기록, 통계, 초대장(청첩장) — 전부 주인(장부 구성원)의 것
--   · 사람 이름·전화 수정·삭제 — 주인만
-- 초대 코드는 장부 것과 같은 꼴(8자, 24시간, 1회용)이고 행사 주인(장부 구성원)이 만든다.

-- ============================================================================
-- 1. 테이블·열
-- ============================================================================
alter table public.events
  add column invite_code text unique,
  add column invite_code_expires_at timestamptz;

create table public.event_members (
  event_id      uuid not null references public.events(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 1 and 40),
  joined_at     timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_members_user_idx on public.event_members (user_id);
comment on table public.event_members is '행사 공동 관리자. 그 행사의 기록만 같이 적는다. 장부 구성원과는 다르다.';

-- ============================================================================
-- 2. 헬퍼 — 정책 안에서 재귀하지 않게 SECURITY DEFINER
-- ============================================================================
create function public.is_event_member(e uuid) returns boolean
language sql security definer stable set search_path = public, pg_temp as $$
  select exists (select 1 from public.event_members m where m.event_id = e and m.user_id = auth.uid())
$$;
-- 행사의 주인인가 = 그 행사가 속한 장부의 구성원인가
create function public.is_event_owner(e uuid) returns boolean
language sql security definer stable set search_path = public, pg_temp as $$
  select exists (select 1 from public.events ev where ev.id = e and public.is_ledger_member(ev.ledger_id))
$$;
-- 이 장부에 내가 공동 관리하는 행사가 하나라도 있는가 (사람 추가 허용 판정)
create function public.has_shared_event_in(l uuid) returns boolean
language sql security definer stable set search_path = public, pg_temp as $$
  select exists (select 1 from public.event_members m join public.events ev on ev.id = m.event_id
                  where ev.ledger_id = l and m.user_id = auth.uid())
$$;
revoke all on function public.is_event_member(uuid) from anon, authenticated, public;
revoke all on function public.is_event_owner(uuid) from anon, authenticated, public;
revoke all on function public.has_shared_event_in(uuid) from anon, authenticated, public;
grant execute on function public.is_event_member(uuid) to authenticated;
grant execute on function public.is_event_owner(uuid) to authenticated;
grant execute on function public.has_shared_event_in(uuid) to authenticated;

-- ============================================================================
-- 3. RLS — 기존 정책은 그대로 두고 공동 관리자 몫을 더한다(정책은 OR 로 합쳐진다)
-- ============================================================================
alter table public.event_members enable row level security;
revoke all on public.event_members from anon, authenticated, public;
grant select, delete on public.event_members to authenticated;
-- 주인은 구성원 목록을 보고 뺀다. 구성원은 자기 줄을 보고 스스로 나간다.
create policy event_members_select on public.event_members
  for select to authenticated using (public.is_event_owner(event_id) or user_id = auth.uid());
create policy event_members_delete on public.event_members
  for delete to authenticated using (public.is_event_owner(event_id) or user_id = auth.uid());
-- insert 는 join_event 함수로만

create policy events_select_shared on public.events
  for select to authenticated using (public.is_event_member(id));

create policy entries_select_shared on public.entries
  for select to authenticated using (public.is_event_member(event_id));
create policy entries_insert_shared on public.entries
  for insert to authenticated with check (public.is_event_member(event_id));
create policy entries_update_shared on public.entries
  for update to authenticated
  using (public.is_event_member(event_id)) with check (public.is_event_member(event_id));
create policy entries_delete_shared on public.entries
  for delete to authenticated using (public.is_event_member(event_id));

-- 사람 — 공동 행사가 있는 장부의 사람을 읽고, 그 장부에 새 사람을 넣을 수 있다.
-- 처음엔 "공동 행사의 기록이 가리키는 사람만"으로 좁히려 했다. 그러면 공동 관리자가 방금 만든
-- 사람(아직 기록이 없다)을 entries_same_ledger 트리거가 호출자 권한으로 조회할 때 못 보고 거부한다.
-- 명부 입력의 동명이인 판정도 같은 이유로 깨진다. 그래서 장부 단위로 읽게 한다 — 공동 관리자는
-- 대개 배우자·가족이고, 보이는 것은 이름·전화뿐이며 고치거나 지울 수는 없다.
create policy people_select_shared on public.people
  for select to authenticated using (public.has_shared_event_in(ledger_id));
create policy people_insert_shared on public.people
  for insert to authenticated with check (public.has_shared_event_in(ledger_id));

-- ============================================================================
-- 4. 초대·합류·나가기·내보내기
-- ============================================================================
create function public.create_event_invite(p_event_id uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_code text; v_try int := 0; v_mine boolean;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_event_owner(p_event_id) then
    raise exception 'not_owner' using errcode = 'insufficient_privilege';
  end if;
  select is_mine into v_mine from public.events where id = p_event_id;
  if not v_mine then
    raise exception 'event_not_mine' using errcode = 'check_violation';
  end if;
  loop
    v_try := v_try + 1;
    v_code := public.random_invite_code();
    begin
      update public.events
         set invite_code = v_code, invite_code_expires_at = now() + interval '24 hours'
       where id = p_event_id;
      return v_code;
    exception when unique_violation then
      if v_try >= 10 then raise; end if;
    end;
  end loop;
end $$;

create function public.join_event(p_code text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_event uuid; v_uid uuid := auth.uid(); v_name text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'insufficient_privilege';
  end if;
  select id into v_event from public.events
   where invite_code = upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'))
     and invite_code_expires_at > now();
  if v_event is null then
    raise exception 'invalid_or_expired_code' using errcode = 'no_data_found';
  end if;
  -- 주인이 자기 행사에 합류할 이유는 없다
  if public.is_event_owner(v_event) then
    raise exception 'already_owner' using errcode = 'check_violation';
  end if;
  select coalesce(nullif(raw_user_meta_data->>'name', ''), nullif(raw_user_meta_data->>'full_name', ''), split_part(coalesce(email, ''), '@', 1), '구성원')
    into v_name from auth.users where id = v_uid;
  insert into public.event_members (event_id, user_id, display_name)
  values (v_event, v_uid, left(v_name, 40))
  on conflict (event_id, user_id) do nothing;
  -- 코드는 1회용
  update public.events set invite_code = null, invite_code_expires_at = null where id = v_event;
  return v_event;
end $$;

create function public.leave_event(p_event_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.event_members where event_id = p_event_id and user_id = auth.uid();
end $$;

create function public.remove_event_member(p_event_id uuid, p_user_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_event_owner(p_event_id) then
    raise exception 'not_owner' using errcode = 'insufficient_privilege';
  end if;
  delete from public.event_members where event_id = p_event_id and user_id = p_user_id;
end $$;

-- 내가 공동 관리하는 행사 목록(행사 행 + 주인 표시 이름). '내 행사' 탭이 쓴다.
create function public.list_shared_events()
returns table (event_id uuid, ledger_id uuid, title text, type text, date date, date_precision text, owner_name text, joined_at timestamptz)
language sql security definer stable set search_path = public, pg_temp as $$
  select ev.id, ev.ledger_id, ev.title, ev.type, ev.date, ev.date_precision,
         (select lm.display_name from public.ledger_members lm where lm.ledger_id = ev.ledger_id and lm.role = 'owner' limit 1),
         m.joined_at
    from public.event_members m join public.events ev on ev.id = m.event_id
   where m.user_id = auth.uid()
   order by ev.date desc
$$;

revoke all on function public.create_event_invite(uuid) from anon, authenticated, public;
revoke all on function public.join_event(text) from anon, authenticated, public;
revoke all on function public.leave_event(uuid) from anon, authenticated, public;
revoke all on function public.remove_event_member(uuid, uuid) from anon, authenticated, public;
revoke all on function public.list_shared_events() from anon, authenticated, public;
grant execute on function public.create_event_invite(uuid) to authenticated;
grant execute on function public.join_event(text) to authenticated;
grant execute on function public.leave_event(uuid) to authenticated;
grant execute on function public.remove_event_member(uuid, uuid) to authenticated;
grant execute on function public.list_shared_events() to authenticated;
