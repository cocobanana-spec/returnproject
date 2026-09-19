-- 뿌린대로거두리라 1단계 스키마 — 장부 소유 축(ledgers·ledger_members)과 경조사 장부(people·events·entries), RLS·트리거·뷰·RPC 전부
-- 정본은 docs/03-data-model.md. 이 파일 하나로 백엔드 토대가 완성된다.

-- ============================================================================
-- 0. 확장
-- ============================================================================
-- Supabase는 pgcrypto를 extensions 스키마에 둔다. 로컬 스텁도 같은 모양으로 맞춘다.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ============================================================================
-- 1. 테이블
-- ============================================================================

-- 장부 1권. 데이터의 소유 단위이며 부부(가족)가 함께 쓴다.
create table public.ledgers (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null default '내 장부'
                          check (char_length(name) between 1 and 30),
  invite_code             text unique,
  invite_code_expires_at  timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- 장부와 사용자의 소속 관계. role은 owner(초대·구성원 관리) / member.
create table public.ledger_members (
  ledger_id     uuid not null references public.ledgers(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null check (role in ('owner','member')),
  display_name  text not null,
  created_at    timestamptz not null default now(),
  primary key (ledger_id, user_id)
);
create index ledger_members_user_idx on public.ledger_members (user_id);

-- 장부 안에서 경조사를 주고받는 상대. 개인 또는 단체.
create table public.people (
  id               uuid primary key default gen_random_uuid(),
  ledger_id        uuid not null references public.ledgers(id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 50),
  name_normalized  text generated always as
                   (lower(regexp_replace(normalize(name, NFC), '\s', '', 'g'))) stored,
  kind             text not null default 'person' check (kind in ('person','group')),
  relation_group   text not null default 'other'
                   check (relation_group in ('family','relative','work','friend','acquaintance','other')),
  label            text check (char_length(label) <= 30),
  phone            text check (char_length(phone) <= 30),
  memo             text check (char_length(memo) <= 500),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- 경조사 행사 1건. is_mine = true면 우리 장부가 주최한 행사(받은돈), false면 남의 행사(준돈).
create table public.events (
  id               uuid primary key default gen_random_uuid(),
  ledger_id        uuid not null references public.ledgers(id) on delete cascade,
  type             text not null
                   check (type in ('wedding','first_birthday','funeral','senior_birthday','opening','other')),
  is_mine          boolean not null default false,
  host_person_id   uuid references public.people(id) on delete set null,
  title            text not null check (char_length(title) between 1 and 80),
  date             date not null,
  date_precision   text not null default 'day' check (date_precision in ('day','month','year')),
  place            text check (char_length(place) <= 100),
  side_a_label     text check (char_length(side_a_label) <= 20),
  side_b_label     text check (char_length(side_b_label) <= 20),
  memo             text check (char_length(memo) <= 500),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- 내 행사는 당사자를 갖지 않는다.
  -- 남의 행사의 "당사자 필수"는 CHECK가 아니라 INSERT 트리거로 본다. 당사자가 삭제되면
  -- FK의 ON DELETE SET NULL로 NULL이 되어야 하는데(docs/02 §5 "당사자만 비운다"),
  -- CHECK로 묶으면 그 삭제 자체가 막힌다.
  constraint events_mine_has_no_host check (not is_mine or host_person_id is null),
  -- 측 라벨은 내 행사에만 있고, B는 A 없이 존재할 수 없다
  constraint events_side_a_only_when_mine check (is_mine or side_a_label is null),
  constraint events_side_b_needs_a check (side_b_label is null or side_a_label is not null)
);

-- 기록 1건(봉투 1개). 방향은 events.is_mine에서 파생하며 컬럼으로 두지 않는다.
create table public.entries (
  id            uuid primary key default gen_random_uuid(),
  ledger_id     uuid not null references public.ledgers(id) on delete cascade,
  event_id      uuid not null references public.events(id) on delete cascade,
  person_id     uuid not null references public.people(id) on delete cascade,
  co_person_id  uuid references public.people(id) on delete set null,
  created_by    uuid default auth.uid() references auth.users(id) on delete set null,
  amount        integer check (amount >= 0),
  method        text not null default 'cash'
                check (method in ('cash','transfer','wreath','gift','none')),
  attended      boolean,
  side          text check (side in ('a','b')),
  returned_at   timestamptz,
  return_memo   text check (char_length(return_memo) <= 200),
  memo          text check (char_length(memo) <= 500),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint entries_co_person_differs check (co_person_id is null or co_person_id <> person_id)
);

create index people_name_idx       on public.people  (ledger_id, name_normalized text_pattern_ops);
create index events_date_idx       on public.events  (ledger_id, date desc);
create index events_host_idx       on public.events  (ledger_id, host_person_id);
create index entries_person_idx    on public.entries (ledger_id, person_id);
create index entries_co_person_idx on public.entries (ledger_id, co_person_id);
create index entries_event_idx     on public.entries (ledger_id, event_id);
create index entries_created_idx   on public.entries (ledger_id, created_at desc);

-- ============================================================================
-- 2. 트리거
-- ============================================================================

-- 모든 UPDATE에서 updated_at을 현재 시각으로 맞춘다.
create function public.set_updated_at() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- 행을 다른 장부로 옮길 수 없다.
-- RLS의 USING(옛 장부 구성원)과 WITH CHECK(새 장부 구성원)는 두 장부 모두의 구성원에게는 둘 다 참이라,
-- 정책만으로는 공유 장부의 행을 자기 개인 장부로 빼내는 UPDATE를 막지 못한다.
create function public.forbid_ledger_change() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.ledger_id is distinct from old.ledger_id then
    raise exception 'ledger_id_immutable' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger people_forbid_ledger_change before update on public.people
  for each row execute function public.forbid_ledger_change();
create trigger events_forbid_ledger_change before update on public.events
  for each row execute function public.forbid_ledger_change();
create trigger entries_forbid_ledger_change before update on public.entries
  for each row execute function public.forbid_ledger_change();

create trigger ledgers_set_updated_at before update on public.ledgers
  for each row execute function public.set_updated_at();
create trigger people_set_updated_at before update on public.people
  for each row execute function public.set_updated_at();
create trigger events_set_updated_at before update on public.events
  for each row execute function public.set_updated_at();
create trigger entries_set_updated_at before update on public.entries
  for each row execute function public.set_updated_at();

-- 기록이 1건이라도 있는 행사는 is_mine을 바꿀 수 없다. 소속 기록 전체의 방향이 뒤집히기 때문이다.
create function public.events_lock_is_mine() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.is_mine is distinct from old.is_mine
     and exists (select 1 from public.entries where event_id = old.id) then
    raise exception 'event_has_entries_is_mine_locked'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger events_lock_is_mine before update on public.events
  for each row execute function public.events_lock_is_mine();

-- 행사 검증 — 새로 만드는 남의 행사는 당사자가 필수이고, 당사자는 같은 장부의 사람이어야 한다.
-- FK는 RLS를 무시하므로, 두 장부의 구성원인 사용자가 만드는 교차 참조를 FK만으로는 막지 못한다.
create function public.events_validate() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' and not new.is_mine and new.host_person_id is null then
    raise exception 'host_person_required' using errcode = 'check_violation';
  end if;
  if new.host_person_id is not null
     and not exists (select 1 from public.people
                      where id = new.host_person_id and ledger_id = new.ledger_id) then
    raise exception 'host_person_in_other_ledger' using errcode = 'foreign_key_violation';
  end if;
  return new;
end $$;

create trigger events_validate before insert or update on public.events
  for each row execute function public.events_validate();

-- 기록의 행사·사람·공동 부조자가 모두 같은 장부인지 검사한다(위와 같은 이유).
create function public.entries_same_ledger() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.events
                  where id = new.event_id and ledger_id = new.ledger_id) then
    raise exception 'event_in_other_ledger' using errcode = 'foreign_key_violation';
  end if;
  if not exists (select 1 from public.people
                  where id = new.person_id and ledger_id = new.ledger_id) then
    raise exception 'person_in_other_ledger' using errcode = 'foreign_key_violation';
  end if;
  if new.co_person_id is not null
     and not exists (select 1 from public.people
                      where id = new.co_person_id and ledger_id = new.ledger_id) then
    raise exception 'co_person_in_other_ledger' using errcode = 'foreign_key_violation';
  end if;
  return new;
end $$;

create trigger entries_same_ledger before insert or update on public.entries
  for each row execute function public.entries_same_ledger();

-- ============================================================================
-- 3. RLS 헬퍼
-- ============================================================================
-- ledger_members 정책 안에서 ledger_members를 다시 읽으면 재귀한다. SECURITY DEFINER로 끊는다.

create function public.is_ledger_member(l uuid) returns boolean
language sql security definer stable set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.ledger_members
     where ledger_id = l and user_id = auth.uid()
  )
$$;

create function public.is_ledger_owner(l uuid) returns boolean
language sql security definer stable set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.ledger_members
     where ledger_id = l and user_id = auth.uid() and role = 'owner'
  )
$$;

-- ============================================================================
-- 4. RLS 활성화와 정책
-- ============================================================================

alter table public.ledgers        enable row level security;
alter table public.ledger_members enable row level security;
alter table public.people         enable row level security;
alter table public.events         enable row level security;
alter table public.entries        enable row level security;

-- 장부 — 구성원은 읽고 이름만 고칠 수 있다. 생성·삭제는 RPC(SECURITY DEFINER)만.
create policy ledgers_select on public.ledgers
  for select to authenticated using (public.is_ledger_member(id));
create policy ledgers_update on public.ledgers
  for update to authenticated
  using (public.is_ledger_member(id)) with check (public.is_ledger_member(id));

-- 구성원 — 같은 장부 구성원끼리 서로를 볼 수 있다. 변경은 전부 RPC.
create policy ledger_members_select on public.ledger_members
  for select to authenticated using (public.is_ledger_member(ledger_id));

-- 데이터 3개 테이블 — 구성원이면 읽기·쓰기 전부 가능. UPDATE는 USING과 WITH CHECK 둘 다 둔다.
create policy people_select on public.people
  for select to authenticated using (public.is_ledger_member(ledger_id));
create policy people_insert on public.people
  for insert to authenticated with check (public.is_ledger_member(ledger_id));
create policy people_update on public.people
  for update to authenticated
  using (public.is_ledger_member(ledger_id)) with check (public.is_ledger_member(ledger_id));
create policy people_delete on public.people
  for delete to authenticated using (public.is_ledger_member(ledger_id));

create policy events_select on public.events
  for select to authenticated using (public.is_ledger_member(ledger_id));
create policy events_insert on public.events
  for insert to authenticated with check (public.is_ledger_member(ledger_id));
create policy events_update on public.events
  for update to authenticated
  using (public.is_ledger_member(ledger_id)) with check (public.is_ledger_member(ledger_id));
create policy events_delete on public.events
  for delete to authenticated using (public.is_ledger_member(ledger_id));

create policy entries_select on public.entries
  for select to authenticated using (public.is_ledger_member(ledger_id));
create policy entries_insert on public.entries
  for insert to authenticated with check (public.is_ledger_member(ledger_id));
create policy entries_update on public.entries
  for update to authenticated
  using (public.is_ledger_member(ledger_id)) with check (public.is_ledger_member(ledger_id));
create policy entries_delete on public.entries
  for delete to authenticated using (public.is_ledger_member(ledger_id));

-- ============================================================================
-- 5. 뷰
-- ============================================================================

-- 사람별 수지. 공동 부조는 person_id·co_person_id 양쪽에 전액 반영된다(docs/03 §4).
create view public.person_balances with (security_invoker = true) as
select
  p.id,
  p.ledger_id,
  p.name,
  p.name_normalized,
  p.label,
  p.relation_group,
  p.kind,
  coalesce(sum(en.amount) filter (where not e.is_mine), 0)::bigint as given_total,
  coalesce(sum(en.amount) filter (where e.is_mine), 0)::bigint     as received_total,
  (coalesce(sum(en.amount) filter (where not e.is_mine), 0)
   - coalesce(sum(en.amount) filter (where e.is_mine), 0))::bigint  as balance,
  count(en.id) filter (where not e.is_mine and en.amount is null)   as given_unconfirmed,
  count(en.id) filter (where e.is_mine and en.amount is null)       as received_unconfirmed,
  count(en.id)                                                      as entry_count,
  max(en.created_at)                                                as last_entry_at
from public.people p
left join public.entries en
  on en.ledger_id = p.ledger_id
 and (en.person_id = p.id or en.co_person_id = p.id)
left join public.events e
  on e.id = en.event_id
group by p.id;

-- ============================================================================
-- 6. 데이터 RPC (SECURITY INVOKER — RLS가 그대로 적용된다)
-- ============================================================================

-- 행사 상세의 측별·형태별 집계. 앱이 결과를 메모리에서 전체/측별/형태별로 접는다.
create function public.event_summary(p_event_id uuid)
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
  group by en.side, en.method
$$;

-- 연도별·방향별·종류별·관계그룹별 집계. 관계 그룹은 대표자(person_id) 기준으로 한 번만 센다.
create function public.stats_by_year(p_ledger_id uuid, p_year int default null)
returns table (
  year int, is_mine boolean, type text, relation_group text,
  cnt bigint, total bigint, unconfirmed bigint
)
language sql stable set search_path = public, pg_temp as $$
  select
    extract(year from e.date)::int                          as year,
    e.is_mine,
    e.type,
    p.relation_group,
    count(*)                                                as cnt,
    coalesce(sum(en.amount), 0)::bigint                      as total,
    count(*) filter (where en.amount is null)                as unconfirmed
  from public.entries en
  join public.events e on e.id = en.event_id
  join public.people p on p.id = en.person_id
  where en.ledger_id = p_ledger_id
    and (p_year is null or extract(year from e.date)::int = p_year)
  group by 1, 2, 3, 4
$$;

-- 사람 삭제. 기록은 FK CASCADE, 공동 부조자 자리는 SET NULL로 처리된다.
-- 그 사람이 당사자였다가 비워지고 기록도 없어진 남의 행사만 함께 지운다.
create function public.delete_person(p_id uuid) returns void
language plpgsql set search_path = public, pg_temp as $$
declare v_ledger uuid; v_hosted uuid[];
begin
  select ledger_id into v_ledger from public.people where id = p_id;
  if v_ledger is null then
    raise exception 'person_not_found' using errcode = 'no_data_found';
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

-- 사람 병합. victim의 세 참조 축(기록 대표자·공동 부조자·행사 당사자)을 survivor로 옮기고 victim을 지운다.
create function public.merge_people(p_victim uuid, p_survivor uuid) returns void
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
  if v_victim_ledger <> v_survivor_ledger then
    raise exception 'different_ledger' using errcode = 'check_violation';
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

-- ============================================================================
-- 7. 장부·구성원 RPC (SECURITY DEFINER — 규칙을 함수 안에서 명시적으로 검사한다)
-- ============================================================================

-- 로그인 계정의 메타데이터에서 표시 이름을 고른다.
create function public.display_name_of(p_meta jsonb, p_email text) returns text
language sql immutable set search_path = public, pg_temp as $$
  select coalesce(
    nullif(trim(p_meta ->> 'name'), ''),
    nullif(trim(p_meta ->> 'full_name'), ''),
    nullif(trim(p_meta ->> 'nickname'), ''),
    nullif(split_part(coalesce(p_email, ''), '@', 1), ''),
    '구성원'
  )
$$;

-- auth.users는 클라이언트가 읽을 수 없으므로 DEFINER로 감싼다.
create function public.display_name_of_user(p_uid uuid) returns text
language plpgsql security definer stable set search_path = public, pg_temp as $$
declare v_name text;
begin
  select public.display_name_of(u.raw_user_meta_data, u.email)
    into v_name
    from auth.users u where u.id = p_uid;
  return coalesce(v_name, '구성원');
end $$;

-- 초대 코드 8자. 혼동되는 0·O·1·I를 뺀 32글자 알파벳을 쓴다.
create function public.random_invite_code() returns text
language sql volatile set search_path = public, extensions, pg_temp as $$
  select string_agg(
           substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
                  1 + (get_byte(b.bytes, g.i) % 32), 1),
           '' order by g.i)
    from (select extensions.gen_random_bytes(8) as bytes) b,
         generate_series(0, 7) as g(i)
$$;

-- 장부에 owner가 없으면 가장 먼저 합류한 구성원에게 승계한다.
create function public.ensure_owner(p_ledger_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_next uuid;
begin
  if exists (select 1 from public.ledger_members
              where ledger_id = p_ledger_id and role = 'owner') then
    return;
  end if;
  select user_id into v_next from public.ledger_members
   where ledger_id = p_ledger_id
   order by created_at, user_id
   limit 1;
  if v_next is not null then
    update public.ledger_members set role = 'owner'
     where ledger_id = p_ledger_id and user_id = v_next;
  end if;
end $$;

-- 첫 로그인 시 개인 장부와 owner 구성원을 자동 생성한다. 앱에 "장부 만들기"는 없다.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ledger uuid;
begin
  insert into public.ledgers default values returning id into v_ledger;
  insert into public.ledger_members (ledger_id, user_id, role, display_name)
  values (v_ledger, new.id,
          'owner',
          public.display_name_of(new.raw_user_meta_data, new.email));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 초대 코드 발급(owner만). 24시간 유효, 합류 시 1회 사용으로 소멸, 재발급하면 이전 코드는 무효.
create function public.create_invite_code(p_ledger_id uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_code text; v_try int := 0;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_ledger_owner(p_ledger_id) then
    raise exception 'not_owner' using errcode = 'insufficient_privilege';
  end if;

  loop
    v_try := v_try + 1;
    v_code := public.random_invite_code();
    begin
      update public.ledgers
         set invite_code = v_code,
             invite_code_expires_at = now() + interval '24 hours'
       where id = p_ledger_id;
      return v_code;
    exception when unique_violation then
      if v_try >= 10 then raise; end if;
    end;
  end loop;
end $$;

-- 초대 코드로 합류. 합류 후 호출자의 "비어 있는 개인 장부"를 정리한다.
create function public.join_ledger(p_code text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ledger uuid; v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'insufficient_privilege';
  end if;

  select id into v_ledger
    from public.ledgers
   where invite_code = upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'))
     and invite_code_expires_at > now();

  if v_ledger is null then
    raise exception 'invalid_or_expired_code' using errcode = 'no_data_found';
  end if;

  insert into public.ledger_members (ledger_id, user_id, role, display_name)
  values (v_ledger, v_uid, 'member', public.display_name_of_user(v_uid))
  on conflict (ledger_id, user_id) do nothing;

  update public.ledgers
     set invite_code = null, invite_code_expires_at = null
   where id = v_ledger;

  -- 호출자가 유일한 구성원이고 데이터가 0건인 장부(자동 생성된 빈 개인 장부)를 지운다.
  delete from public.ledgers x
   where x.id <> v_ledger
     and exists (select 1 from public.ledger_members m
                  where m.ledger_id = x.id and m.user_id = v_uid)
     and (select count(*) from public.ledger_members m where m.ledger_id = x.id) = 1
     and not exists (select 1 from public.people  p where p.ledger_id = x.id)
     and not exists (select 1 from public.events  e where e.ledger_id = x.id)
     and not exists (select 1 from public.entries n where n.ledger_id = x.id);

  return v_ledger;
end $$;

-- 구성원 제거(owner가 남을) 또는 탈퇴(자기 자신). 마지막 구성원은 나갈 수 없다.
create function public.remove_member(p_ledger_id uuid, p_user_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_ledger_member(p_ledger_id) then
    raise exception 'not_member' using errcode = 'insufficient_privilege';
  end if;

  if p_user_id = v_uid then
    if (select count(*) from public.ledger_members where ledger_id = p_ledger_id) = 1 then
      raise exception 'sole_member_cannot_leave' using errcode = 'check_violation';
    end if;
  elsif not public.is_ledger_owner(p_ledger_id) then
    raise exception 'not_owner' using errcode = 'insufficient_privilege';
  end if;

  delete from public.ledger_members
   where ledger_id = p_ledger_id and user_id = p_user_id;

  perform public.ensure_owner(p_ledger_id);
end $$;

-- 계정 삭제 준비. 혼자 쓰던 장부는 데이터까지 삭제하고, 함께 쓰던 장부에서는 나만 빠진다.
-- Edge Function delete-account가 사용자 JWT로 이 함수를 먼저 부른 뒤 service role로 사용자를 지운다.
create function public.prepare_account_deletion() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); m record;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'insufficient_privilege';
  end if;

  for m in select ledger_id from public.ledger_members where user_id = v_uid loop
    if (select count(*) from public.ledger_members where ledger_id = m.ledger_id) = 1 then
      delete from public.ledgers where id = m.ledger_id;   -- 데이터는 CASCADE
    else
      delete from public.ledger_members
       where ledger_id = m.ledger_id and user_id = v_uid;
      perform public.ensure_owner(m.ledger_id);
    end if;
  end loop;
end $$;

-- ============================================================================
-- 8. 권한 — anon에게는 아무것도 주지 않는다
-- ============================================================================
-- Supabase는 기본 권한(ALTER DEFAULT PRIVILEGES)으로 public 스키마의 새 객체를
-- anon·authenticated에 열어 준다. 1단계에는 공개 데이터가 없으므로 전부 회수한 뒤
-- authenticated에만 필요한 만큼 준다.
--
-- ※ 다음 마이그레이션을 쓰는 사람에게 — 아래 REVOKE는 "이 마이그레이션 시점에 존재하는" 객체에만
--   적용된다. 0002에서 테이블이나 함수를 추가하면 기본 권한 때문에 anon에 다시 열린다.
--   새 마이그레이션 끝에도 같은 REVOKE 블록을 넣고, 필요한 GRANT만 다시 주어야 한다.
--   2단계 청첩장의 공개 페이지를 열 때 비로소 anon에 SELECT를 주게 된다(docs/03 §10).

revoke all on all tables    in schema public from anon, authenticated, public;
revoke all on all functions in schema public from anon, authenticated, public;
revoke all on all sequences in schema public from anon, authenticated, public;
-- anon은 PUBLIC 역할을 통해 스키마 USAGE를 여전히 갖는다(PG 기본값). 실제 차단은 위의
-- 객체 단위 REVOKE가 한다. 아래 줄은 Supabase가 anon에 직접 준 USAGE를 거두는 것이다.
revoke usage on schema public from anon;

grant usage on schema public to authenticated;

-- 장부는 읽기와 "이름 컬럼만" 수정. 초대 코드는 컬럼 권한이 없어 UPDATE 자체가 거부된다.
grant select          on public.ledgers to authenticated;
grant update (name)   on public.ledgers to authenticated;
grant select          on public.ledger_members to authenticated;

grant select, insert, update, delete on public.people  to authenticated;
grant select, insert, update, delete on public.events  to authenticated;
grant select, insert, update, delete on public.entries to authenticated;

grant select on public.person_balances to authenticated;

grant execute on function public.is_ledger_member(uuid)          to authenticated;
grant execute on function public.is_ledger_owner(uuid)           to authenticated;
grant execute on function public.event_summary(uuid)             to authenticated;
grant execute on function public.stats_by_year(uuid, int)        to authenticated;
grant execute on function public.delete_person(uuid)             to authenticated;
grant execute on function public.merge_people(uuid, uuid)        to authenticated;
grant execute on function public.create_invite_code(uuid)        to authenticated;
grant execute on function public.join_ledger(text)               to authenticated;
grant execute on function public.remove_member(uuid, uuid)       to authenticated;
grant execute on function public.prepare_account_deletion()      to authenticated;
