-- 로컬 검증 전용 auth 스텁 — Supabase가 제공하는 것 중 0001_init.sql이 의존하는 최소한만 흉내 낸다
-- 이 파일은 절대 마이그레이션이 아니다. 실제 Supabase에는 적용하지 않으며 적용해서도 안 된다.
-- 흉내 내는 것: 역할 3개, extensions 스키마, auth 스키마, auth.users, auth.uid(), public 스키마 기본 권한.

-- ---------------------------------------------------------------------------
-- 역할 — Supabase에는 이미 존재한다. 그래서 마이그레이션이 아니라 스텁에서 만든다.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;

-- Supabase는 public 스키마의 새 객체를 anon·authenticated에 기본으로 열어 준다.
-- 마이그레이션의 REVOKE가 실제로 일을 하는지 보려면 이 기본 권한까지 흉내 내야 한다.
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- auth 스키마
-- ---------------------------------------------------------------------------
create schema if not exists auth;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

-- Supabase의 auth.uid()는 요청 JWT의 sub 클레임을 읽는다. 테스트는 request.jwt.claims를 직접 세팅한다.
create or replace function auth.uid() returns uuid
language plpgsql stable as $$
declare c text;
begin
  c := nullif(current_setting('request.jwt.claims', true), '');
  if c is null then
    return null;
  end if;
  return nullif(c::jsonb ->> 'sub', '')::uuid;
end $$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
-- auth.users는 클라이언트에게 열지 않는다(Supabase와 동일).
