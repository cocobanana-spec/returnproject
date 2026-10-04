-- 청첩장·부고장(invitations) — 내 행사에 붙는 공개 페이지. docs/08 §3.2
--
-- 원칙
--   ① 소유 축은 장부다. 구성원(부부)이 함께 만들고 고친다. 1단계 테이블과 같은 RLS 다.
--   ② 바깥 사람은 테이블을 못 본다. 공개 읽기는 public_invitation(slug) 한 함수뿐이며,
--      그 함수는 '발행됨 + 만료 전'일 때만 돌려준다.
--   ③ 발행·만료·요금제 열은 RPC 만 바꾼다. 화면이 expires_at 을 직접 늘리거나 plan 을 premium 으로
--      바꾸는 길을 막는다(무료 규칙은 서버가 지킨다 — docs/08 §1).
--   ④ 행사 하나에 청첩장 하나. 행사는 반드시 같은 장부의 '내 행사'여야 하고, 종류는 행사 종류에서
--      정해진다(결혼식→청첩장, 장례식→부고장). 돌잔치는 나중에 연다.

-- ============================================================================
-- 1. 테이블
-- ============================================================================
create table public.invitations (
  id            uuid primary key default gen_random_uuid(),
  ledger_id     uuid not null references public.ledgers(id) on delete cascade,
  event_id      uuid not null unique references public.events(id) on delete cascade,
  kind          text not null check (kind in ('wedding','funeral')),
  template_id   text not null default 'basic' check (char_length(template_id) between 1 and 40),
  -- 공유 링크의 꼬리. 추측 불가해야 한다(10자 base62 ≈ 60비트). 트리거가 채운다.
  slug          text not null unique check (slug ~ '^[A-Za-z0-9]{10}$'),
  -- 종류별 고정 스키마. 앱이 검증하고 서버는 크기와 모양(object)만 본다.
  content       jsonb not null default '{}'::jsonb
                check (jsonb_typeof(content) = 'object' and octet_length(content::text) <= 65536),
  status        text not null default 'draft'
                check (status in ('draft','published','unpublished','expired')),
  published_at  timestamptz,
  expires_at    timestamptz,
  plan          text not null default 'free' check (plan in ('free','premium')),
  view_count    integer not null default 0 check (view_count >= 0),
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- 발행된 것은 반드시 발행·만료 시각을 갖는다. 초안은 둘 다 비어 있다.
  constraint invitations_published_has_dates
    check (status <> 'published' or (published_at is not null and expires_at is not null)),
  constraint invitations_expiry_after_publish
    check (expires_at is null or published_at is null or expires_at > published_at)
);

create index invitations_ledger_idx on public.invitations(ledger_id);
create index invitations_expiry_idx on public.invitations(expires_at) where status = 'published';

comment on table public.invitations is
  '내 행사에 붙는 청첩장·부고장. 공개 읽기는 public_invitation(slug) 로만 한다.';

-- ============================================================================
-- 2. 트리거
-- ============================================================================
-- slug 는 트리거 안에서 만든다. 따로 함수로 빼면 트리거가 사용자 권한으로 그 함수를 부르게 되어
-- EXECUTE 를 열어 줘야 한다(2026-10-04 검증에서 42501). 난수원은 코어의 gen_random_uuid 다 —
-- pgcrypto 의 gen_random_bytes 는 extensions 스키마 권한이 환경마다 달라 쓰지 않는다.
-- uuid 16바이트 중 10바이트를 62로 나눈 나머지로 쓴다. 256 이 62 의 배수가 아니라 아주 약한 치우침이
-- 있지만 추측 불가(약 60비트)에는 영향이 없다.
-- INSERT 때 — 행사가 같은 장부의 내 행사인지, 종류가 행사 종류와 맞는지, slug·작성자를 채운다.
create function public.invitations_validate() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare
  ev record;
  alphabet constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  bytes bytea;
  s text;
  i int;
begin
  -- 행사 조회는 호출자 권한(RLS)으로 돈다. 남의 장부 행사는 '없음'으로 보인다 — 그래서 거부된다.
  select ledger_id, is_mine, type into ev from public.events where id = new.event_id;
  if ev is null then
    raise exception 'event_not_found' using errcode = 'foreign_key_violation';
  end if;
  if ev.ledger_id <> new.ledger_id then
    raise exception 'event_in_other_ledger' using errcode = 'foreign_key_violation';
  end if;
  if not ev.is_mine then
    raise exception 'event_not_mine' using errcode = 'check_violation';
  end if;
  if (ev.type = 'wedding' and new.kind <> 'wedding')
     or (ev.type = 'funeral' and new.kind <> 'funeral')
     or ev.type not in ('wedding','funeral') then
    raise exception 'kind_mismatch' using errcode = 'check_violation';
  end if;
  if tg_op = 'INSERT' then
    if new.slug is null then
      for attempt in 1..8 loop
        bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
        s := '';
        for i in 0..9 loop
          s := s || substr(alphabet, (get_byte(bytes, i) % 62) + 1, 1);
        end loop;
        exit when not exists (select 1 from public.invitations where slug = s);
        s := null;
      end loop;
      if s is null then
        raise exception 'slug_collision' using errcode = 'unique_violation';
      end if;
      new.slug := s;
    end if;
    if new.created_by is null then
      new.created_by := auth.uid();
    end if;
  end if;
  return new;
end $$;

create trigger invitations_validate before insert or update on public.invitations
  for each row execute function public.invitations_validate();

-- 발행·만료·요금제·조회수·slug 는 RPC 만 바꾼다. RPC 는 트랜잭션 안에서 ppurin.internal 을 켠다.
create function public.invitations_guard_columns() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if coalesce(current_setting('ppurin.internal', true), '') = '1' then
    return new;
  end if;
  if new.status is distinct from old.status
     or new.published_at is distinct from old.published_at
     or new.expires_at is distinct from old.expires_at
     or new.plan is distinct from old.plan
     or new.view_count is distinct from old.view_count
     or new.slug is distinct from old.slug
     or new.event_id is distinct from old.event_id then
    raise exception 'rpc_only_column' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

create trigger invitations_guard_columns before update on public.invitations
  for each row execute function public.invitations_guard_columns();

create trigger invitations_forbid_ledger_change before update on public.invitations
  for each row execute function public.forbid_ledger_change();
create trigger invitations_set_updated_at before update on public.invitations
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 3. RLS — 구성원만. anon 은 테이블에 아무 권한이 없다.
-- ============================================================================
alter table public.invitations enable row level security;
revoke all on public.invitations from anon, authenticated, public;
grant select, insert, update, delete on public.invitations to authenticated;

create policy invitations_select on public.invitations
  for select to authenticated using (public.is_ledger_member(ledger_id));
create policy invitations_insert on public.invitations
  for insert to authenticated with check (public.is_ledger_member(ledger_id));
create policy invitations_update on public.invitations
  for update to authenticated
  using (public.is_ledger_member(ledger_id)) with check (public.is_ledger_member(ledger_id));
create policy invitations_delete on public.invitations
  for delete to authenticated using (public.is_ledger_member(ledger_id));

-- ============================================================================
-- 4. 공개 읽기 — 바깥 사람이 쓰는 유일한 길
-- ============================================================================
-- 발행됐고 만료 전인 것만. 장부·작성자·조회수 같은 내부 값은 돌려주지 않는다.
create function public.public_invitation(p_slug text)
returns table (kind text, template_id text, content jsonb, published_at timestamptz, expires_at timestamptz)
language sql security definer stable set search_path = public, pg_temp as $$
  select i.kind, i.template_id, i.content, i.published_at, i.expires_at
    from public.invitations i
   where i.slug = p_slug
     and i.status = 'published'
     and i.expires_at > now()
$$;

-- 조회수. 읽기 함수는 stable 이라 여기서 따로 올린다. 발행·만료 전 것만 센다.
create function public.record_invitation_view(p_slug text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform set_config('ppurin.internal', '1', true);
  update public.invitations
     set view_count = view_count + 1
   where slug = p_slug and status = 'published' and expires_at > now();
end $$;

revoke all on function public.public_invitation(text) from anon, authenticated, public;
grant execute on function public.public_invitation(text) to anon, authenticated;
revoke all on function public.record_invitation_view(text) from anon, authenticated, public;
grant execute on function public.record_invitation_view(text) to anon, authenticated;

-- ============================================================================
-- 5. 발행·내리기·만료 — 구성원용 RPC
-- ============================================================================
-- 무료 규칙(docs/08 §3.5) — 동시 발행 1건, 3개월까지. premium 은 제한 없음, 12개월까지.
-- plan 은 지금은 free 뿐이고 결제가 붙으면 entitlements 로 올린다. 규칙은 지금부터 서버가 지킨다.
create function public.publish_invitation(p_invitation_id uuid, p_months int default 3)
returns table (slug text, published_at timestamptz, expires_at timestamptz)
language plpgsql set search_path = public, pg_temp as $$
declare
  inv record;
  max_months int;
  others int;
begin
  select * into inv from public.invitations where id = p_invitation_id;
  if inv is null or not public.is_ledger_member(inv.ledger_id) then
    raise exception 'not_member' using errcode = 'insufficient_privilege';
  end if;
  if inv.content = '{}'::jsonb then
    raise exception 'empty_content' using errcode = 'check_violation';
  end if;
  max_months := case inv.plan when 'premium' then 12 else 3 end;
  if p_months < 1 or p_months > max_months then
    raise exception 'months_out_of_range' using errcode = 'check_violation';
  end if;
  if inv.plan = 'free' then
    select count(*) into others from public.invitations
     where ledger_id = inv.ledger_id and status = 'published' and id <> inv.id;
    if others > 0 then
      raise exception 'free_plan_limit' using errcode = 'check_violation';
    end if;
  end if;

  perform set_config('ppurin.internal', '1', true);
  update public.invitations
     set status = 'published',
         published_at = now(),
         expires_at = now() + make_interval(months => p_months)
   where id = inv.id;

  return query select i.slug, i.published_at, i.expires_at
                 from public.invitations i where i.id = inv.id;
end $$;

create function public.unpublish_invitation(p_invitation_id uuid) returns void
language plpgsql set search_path = public, pg_temp as $$
declare
  inv record;
begin
  select * into inv from public.invitations where id = p_invitation_id;
  if inv is null or not public.is_ledger_member(inv.ledger_id) then
    raise exception 'not_member' using errcode = 'insufficient_privilege';
  end if;
  perform set_config('ppurin.internal', '1', true);
  update public.invitations set status = 'unpublished' where id = inv.id and status = 'published';
end $$;

-- 만료 집행. 하루 한 번 서비스 역할이 부른다(엣지 함수). 사용자 역할은 못 부른다.
create function public.expire_invitations() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer;
begin
  perform set_config('ppurin.internal', '1', true);
  with done as (
    update public.invitations set status = 'expired'
     where status = 'published' and expires_at <= now()
    returning 1
  )
  select count(*) into n from done;
  return n;
end $$;

revoke all on function public.publish_invitation(uuid, int) from anon, authenticated, public;
grant execute on function public.publish_invitation(uuid, int) to authenticated;
revoke all on function public.unpublish_invitation(uuid) from anon, authenticated, public;
grant execute on function public.unpublish_invitation(uuid) to authenticated;
revoke all on function public.expire_invitations() from anon, authenticated, public;
grant execute on function public.expire_invitations() to service_role;

-- ============================================================================
-- 6. 사진 저장소 — 버킷 invitations (공개 읽기, 쓰기는 구성원이 자기 장부 폴더에만)
-- ============================================================================
-- 경로 규칙: {ledger_id}/{invitation_id}/{파일}. 첫 폴더가 장부 id 라 구성원 검사가 그대로 된다.
-- 로컬 검증 Postgres 에는 storage 스키마가 없다. 있을 때만 만든다(실제 Supabase 에는 있다).
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage 스키마가 없어 버킷·정책을 건너뛴다(로컬 검증)';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('invitations', 'invitations', true, 5242880, array['image/jpeg','image/png','image/webp'])
  on conflict (id) do nothing;

  execute $p$
    create policy invitations_objects_insert on storage.objects
      for insert to authenticated
      with check (bucket_id = 'invitations'
                  and public.is_ledger_member(((storage.foldername(name))[1])::uuid))
  $p$;
  execute $p$
    create policy invitations_objects_update on storage.objects
      for update to authenticated
      using (bucket_id = 'invitations'
             and public.is_ledger_member(((storage.foldername(name))[1])::uuid))
  $p$;
  execute $p$
    create policy invitations_objects_delete on storage.objects
      for delete to authenticated
      using (bucket_id = 'invitations'
             and public.is_ledger_member(((storage.foldername(name))[1])::uuid))
  $p$;
  -- 읽기는 버킷이 public 이라 URL 로 바로 된다. 경로에 추측 불가한 invitation id 가 들어간다.
end $$;
