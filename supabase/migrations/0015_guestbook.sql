-- 청첩장 방명록 — 하객이 공개 페이지에서 이름과 한마디를 남기고, 그 말이 위에서 전광판처럼 돈다 (2026-10-04 사용자 요청)
--
-- 원칙
--   ① 하객은 로그인이 없다. 쓰기는 add_guestbook_message(slug, …) 함수로만, 읽기는 public_guestbook(slug) 로만.
--      둘 다 '발행됨 + 만료 전' 초대장에만 반응한다.
--   ② 테이블은 초대장 주인(장부 구성원)만 읽고 숨기고 지운다. 하객에게 테이블 권한은 없다.
--   ③ 남기는 것은 이름·메시지·시각뿐이다. IP 도 기기도 남기지 않는다.
--   ④ 한 초대장당 500개, 1분에 30개까지. 장난으로 퍼붓는 것을 막는 최소한이다.

create table public.guestbook_entries (
  id             uuid primary key default gen_random_uuid(),
  invitation_id  uuid not null references public.invitations(id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 20),
  message        text not null check (char_length(message) between 1 and 200),
  -- 주인이 숨긴 것. 공개 페이지에서 빠지고 주인 화면에서는 흐리게 보인다.
  hidden         boolean not null default false,
  created_at     timestamptz not null default now()
);
create index guestbook_entries_inv_idx on public.guestbook_entries (invitation_id, created_at desc);

comment on table public.guestbook_entries is '청첩장 방명록. 하객은 함수로만 쓰고 읽는다. 주인은 숨기고 지운다.';

alter table public.guestbook_entries enable row level security;
revoke all on public.guestbook_entries from anon, authenticated, public;
grant select, update, delete on public.guestbook_entries to authenticated;

create policy guestbook_select on public.guestbook_entries
  for select to authenticated
  using (exists (select 1 from public.invitations i where i.id = invitation_id and public.is_ledger_member(i.ledger_id)));
create policy guestbook_update on public.guestbook_entries
  for update to authenticated
  using (exists (select 1 from public.invitations i where i.id = invitation_id and public.is_ledger_member(i.ledger_id)))
  with check (exists (select 1 from public.invitations i where i.id = invitation_id and public.is_ledger_member(i.ledger_id)));
create policy guestbook_delete on public.guestbook_entries
  for delete to authenticated
  using (exists (select 1 from public.invitations i where i.id = invitation_id and public.is_ledger_member(i.ledger_id)));
-- insert 정책 없음 — 함수로만 들어온다

-- 하객이 남긴다. 공백만 있는 이름·메시지는 거부. 초대장이 공개 중일 때만.
create function public.add_guestbook_message(p_slug text, p_name text, p_message text)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  inv_id uuid;
  n text := btrim(coalesce(p_name, ''));
  m text := btrim(coalesce(p_message, ''));
  new_id uuid;
begin
  if char_length(n) < 1 or char_length(n) > 20 then
    raise exception 'bad_name' using errcode = 'check_violation';
  end if;
  if char_length(m) < 1 or char_length(m) > 200 then
    raise exception 'bad_message' using errcode = 'check_violation';
  end if;
  select i.id into inv_id from public.invitations i
   where i.slug = p_slug and i.status = 'published' and i.expires_at > now();
  if inv_id is null then
    raise exception 'invitation_not_open' using errcode = 'no_data_found';
  end if;
  if (select count(*) from public.guestbook_entries where invitation_id = inv_id) >= 500 then
    raise exception 'guestbook_full' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.guestbook_entries
       where invitation_id = inv_id and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'too_many' using errcode = 'check_violation';
  end if;
  insert into public.guestbook_entries (invitation_id, name, message)
  values (inv_id, n, m) returning id into new_id;
  return new_id;
end $$;

-- 하객이 읽는다. 숨긴 것은 빼고 최신 100개.
create function public.public_guestbook(p_slug text)
returns table (name text, message text, created_at timestamptz)
language sql security definer stable set search_path = public, pg_temp as $$
  select g.name, g.message, g.created_at
    from public.guestbook_entries g
    join public.invitations i on i.id = g.invitation_id
   where i.slug = p_slug and i.status = 'published' and i.expires_at > now()
     and not g.hidden
   order by g.created_at desc
   limit 100
$$;

revoke all on function public.add_guestbook_message(text, text, text) from anon, authenticated, public;
grant execute on function public.add_guestbook_message(text, text, text) to anon, authenticated;
revoke all on function public.public_guestbook(text) from anon, authenticated, public;
grant execute on function public.public_guestbook(text) to anon, authenticated;
