-- 관리자 통계 — 회원 수, 활성 사용자, 설치(첫 실행) 수를 운영자가 본다 (2026-10-04 사용자 요청)
--
-- 원칙
--   ① 외부 분석 SDK 는 넣지 않는다(처리방침 약속). 앱이 하루 한 번 "오늘 이 기기로 열었다"만 남긴다.
--   ② 남기는 것은 사용자 id·날짜·플랫폼, 그리고 기기 식별자(앱이 만든 무작위 값)·첫 실행 시각뿐이다.
--      어디서 열었는지, 무엇을 눌렀는지는 남기지 않는다.
--   ③ 통계는 관리자만 본다. 관리자는 app_admins 에 적힌 메일이다. 화면 가림이 아니라 함수가 거부한다.
--
-- "앱 다운로드 수"는 App Store 가 가진 숫자라 우리 DB 에는 없다. 여기서는 **첫 실행 기기 수**를
-- 플랫폼별로 세어 설치 추정치로 보여 준다. 정확한 다운로드 수는 App Store Connect 의 것이다.

-- ============================================================================
-- 1. 관리자 목록
-- ============================================================================
create table public.app_admins (
  email       text primary key check (email = lower(email)),
  created_at  timestamptz not null default now()
);
comment on table public.app_admins is '관리자 메일. 통계 함수가 호출자의 메일을 여기서 찾는다.';
alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon, authenticated, public;
-- 정책 없음 — 아무도 직접 읽거나 쓰지 못한다. 서비스 역할(대시보드·마이그레이션)만 만진다.

insert into public.app_admins (email) values ('donghan.cocoperry@gmail.com');

create function public.is_app_admin() returns boolean
language sql security definer stable set search_path = public, pg_temp as $$
  select exists (
    select 1 from auth.users u
      join public.app_admins a on a.email = lower(u.email)
     where u.id = auth.uid()
  )
$$;
revoke all on function public.is_app_admin() from anon, authenticated, public;
grant execute on function public.is_app_admin() to authenticated;

-- ============================================================================
-- 2. 설치(첫 실행)와 일일 접속
-- ============================================================================
create table public.app_installs (
  device_id   text primary key check (char_length(device_id) between 8 and 64),
  platform    text not null check (platform in ('ios','android','web')),
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  -- 마지막으로 이 기기를 쓴 사용자. 통계용이 아니라 지원 문의 때 기기를 찾는 용도다.
  last_user_id uuid references auth.users(id) on delete set null
);
create index app_installs_first_seen_idx on public.app_installs (first_seen);

create table public.app_activity (
  user_id   uuid not null references auth.users(id) on delete cascade,
  day       date not null,
  platform  text not null check (platform in ('ios','android','web')),
  primary key (user_id, day, platform)
);
create index app_activity_day_idx on public.app_activity (day);

alter table public.app_installs enable row level security;
alter table public.app_activity enable row level security;
revoke all on public.app_installs from anon, authenticated, public;
revoke all on public.app_activity from anon, authenticated, public;
-- 둘 다 정책 없음 — 앱은 아래 함수로만 쓰고, 읽기는 관리자 통계 함수뿐이다.

-- 앱이 열릴 때 한 번 부른다. 같은 날 같은 기기·사용자면 아무것도 바뀌지 않는다.
create function public.record_activity(p_device_id text, p_platform text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = 'insufficient_privilege';
  end if;
  if p_platform not in ('ios','android','web') then
    raise exception 'bad_platform' using errcode = 'check_violation';
  end if;
  insert into public.app_installs (device_id, platform, last_user_id)
  values (p_device_id, p_platform, auth.uid())
  on conflict (device_id) do update
    set last_seen = now(), last_user_id = excluded.last_user_id;
  insert into public.app_activity (user_id, day, platform)
  values (auth.uid(), (now() at time zone 'Asia/Seoul')::date, p_platform)
  on conflict do nothing;
end $$;
revoke all on function public.record_activity(text, text) from anon, authenticated, public;
grant execute on function public.record_activity(text, text) to authenticated;

-- ============================================================================
-- 3. 관리자 통계
-- ============================================================================
-- 날짜는 전부 한국 시간 기준이다. "오늘"은 KST 오늘이다.
create function public.admin_stats() returns jsonb
language plpgsql security definer stable set search_path = public, pg_temp as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  result jsonb;
begin
  if not public.is_app_admin() then
    raise exception 'not_admin' using errcode = 'insufficient_privilege';
  end if;

  with
  users_total as (select count(*) as n from auth.users),
  active as (
    select
      count(distinct user_id) filter (where day = v_today)                       as today,
      count(distinct user_id) filter (where day > v_today - 7)                   as week,
      count(distinct user_id) filter (where day > v_today - 30)                  as month
    from public.app_activity
  ),
  installs as (
    select platform,
      count(*) filter (where (first_seen at time zone 'Asia/Seoul')::date = v_today)             as today,
      count(*) filter (where (first_seen at time zone 'Asia/Seoul')::date > v_today - 7)         as week,
      count(*) filter (where (first_seen at time zone 'Asia/Seoul')::date > v_today - 30)        as month,
      count(*)                                                                                 as total
    from public.app_installs group by platform
  ),
  by_platform_active as (
    select platform,
      count(distinct user_id) filter (where day = v_today)      as today,
      count(distinct user_id) filter (where day > v_today - 7)  as week,
      count(distinct user_id) filter (where day > v_today - 30) as month
    from public.app_activity group by platform
  ),
  daily as (
    -- 최근 30일 일별 접속자. 그래프용. 날이 비면 0 으로 채운다.
    select d::date as day, coalesce((select count(distinct user_id) from public.app_activity a where a.day = d::date), 0) as users
      from generate_series(v_today - 29, v_today, interval '1 day') d
  ),
  content as (
    select (select count(*) from public.ledgers) as ledgers,
           (select count(*) from public.entries) as entries,
           (select count(*) from public.invitations where status = 'published') as published_invitations
  )
  select jsonb_build_object(
    'as_of', v_today,
    'users_total', (select n from users_total),
    'active', (select jsonb_build_object('today', today, 'week', week, 'month', month) from active),
    'active_by_platform', coalesce((select jsonb_object_agg(platform, jsonb_build_object('today', today, 'week', week, 'month', month)) from by_platform_active), '{}'::jsonb),
    'installs_by_platform', coalesce((select jsonb_object_agg(platform, jsonb_build_object('today', today, 'week', week, 'month', month, 'total', total)) from installs), '{}'::jsonb),
    'daily_active', (select jsonb_agg(jsonb_build_object('day', day, 'users', users) order by day) from daily),
    'content', (select to_jsonb(content) from content)
  ) into result;
  return result;
end $$;
revoke all on function public.admin_stats() from anon, authenticated, public;
grant execute on function public.admin_stats() to authenticated;
