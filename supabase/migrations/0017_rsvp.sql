-- 청첩장 참석 여부(RSVP) — 하객이 공개 페이지에서 참석·인원·식사를 알리고, 주인은 앱에서 모아 본다 (2026-10-07 사용자 요청, '봄' 템플릿)
--
-- 원칙은 방명록(0015)과 같다.
--   ① 하객은 로그인이 없다. 쓰기는 submit_rsvp(slug, …) 함수로만. '발행됨 + 만료 전' 초대장에만 반응한다.
--   ② 테이블은 초대장 주인(장부 구성원)만 읽고 지운다. 하객에게 테이블 권한은 없고, 남의 응답을 읽는 함수도 없다.
--   ③ 남기는 것은 측·이름·참석·인원·식사·한마디·시각뿐. IP·기기·전화번호는 남기지 않는다.
--   ④ 한 초대장당 1000건, 1분에 30건까지.

create table public.rsvp_responses (
  id             uuid primary key default gen_random_uuid(),
  invitation_id  uuid not null references public.invitations(id) on delete cascade,
  side           text not null check (side in ('groom', 'bride')),
  name           text not null check (char_length(name) between 1 and 20),
  attending      boolean not null,
  -- 본인 포함 인원. 불참이면 0
  party_size     smallint not null default 1 check (party_size between 0 and 20),
  meal           text check (meal in ('yes', 'no', 'unknown')),
  message        text check (char_length(message) <= 200),
  created_at     timestamptz not null default now()
);
create index rsvp_responses_inv_idx on public.rsvp_responses (invitation_id, created_at desc);

comment on table public.rsvp_responses is '청첩장 참석 여부 응답. 하객은 함수로만 쓴다. 주인만 읽고 지운다.';

alter table public.rsvp_responses enable row level security;
revoke all on public.rsvp_responses from anon, authenticated, public;
grant select, delete on public.rsvp_responses to authenticated;

create policy rsvp_select on public.rsvp_responses
  for select to authenticated
  using (exists (select 1 from public.invitations i where i.id = invitation_id and public.is_ledger_member(i.ledger_id)));
create policy rsvp_delete on public.rsvp_responses
  for delete to authenticated
  using (exists (select 1 from public.invitations i where i.id = invitation_id and public.is_ledger_member(i.ledger_id)));
-- insert 정책 없음 — 함수로만 들어온다

create function public.submit_rsvp(
  p_slug text, p_side text, p_name text, p_attending boolean, p_party_size int, p_meal text, p_message text
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  inv_id uuid;
  n text := btrim(coalesce(p_name, ''));
  m text := nullif(btrim(coalesce(p_message, '')), '');
  size int := case when p_attending then coalesce(p_party_size, 1) else 0 end;
  new_id uuid;
begin
  if p_side not in ('groom', 'bride') then
    raise exception 'bad_side' using errcode = 'check_violation';
  end if;
  if char_length(n) < 1 or char_length(n) > 20 then
    raise exception 'bad_name' using errcode = 'check_violation';
  end if;
  if p_attending is null then
    raise exception 'bad_attending' using errcode = 'check_violation';
  end if;
  if p_attending and (size < 1 or size > 20) then
    raise exception 'bad_party_size' using errcode = 'check_violation';
  end if;
  if p_meal is not null and p_meal not in ('yes', 'no', 'unknown') then
    raise exception 'bad_meal' using errcode = 'check_violation';
  end if;
  if m is not null and char_length(m) > 200 then
    raise exception 'bad_message' using errcode = 'check_violation';
  end if;
  select i.id into inv_id from public.invitations i
   where i.slug = p_slug and i.status = 'published' and i.expires_at > now() and i.kind = 'wedding';
  if inv_id is null then
    raise exception 'invitation_not_open' using errcode = 'no_data_found';
  end if;
  if (select count(*) from public.rsvp_responses where invitation_id = inv_id) >= 1000 then
    raise exception 'rsvp_full' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.rsvp_responses
       where invitation_id = inv_id and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'too_many' using errcode = 'check_violation';
  end if;
  insert into public.rsvp_responses (invitation_id, side, name, attending, party_size, meal, message)
  values (inv_id, p_side, n, p_attending, size, case when p_attending then p_meal else null end, m)
  returning id into new_id;
  return new_id;
end $$;

revoke all on function public.submit_rsvp(text, text, text, boolean, int, text, text) from anon, authenticated, public;
grant execute on function public.submit_rsvp(text, text, text, boolean, int, text, text) to anon, authenticated;
