-- RLS·트리거·RPC 교차 검증 — 계정 A·B(같은 장부), C(다른 장부), D(두 장부)로 docs/02 §7 검증 기준을 실행 확인한다
-- RLS에 걸린 UPDATE/DELETE는 오류 없이 0건 처리되므로, 모든 쓰기 검사는 "영향 행 수"를 직접 확인한다.

\set ON_ERROR_STOP on

-- ============================================================================
-- 테스트 하네스
-- ============================================================================
drop schema if exists tst cascade;
create schema tst;

create table tst.results (
  seq   serial primary key,
  name  text not null,
  ok    boolean not null,
  detail text
);

-- 테스트 SQL이 고정 UUID를 참조할 수 있도록 하는 픽스처 테이블
create table tst.fix (k text primary key, v uuid);

-- 초대 코드처럼 앱 바깥(카톡 등)으로 전달되는 값을 담는다. 받는 쪽은 DB에서 읽지 않고 입력한다.
create table tst.val (k text primary key, v text);

create function tst.pass(p_name text) returns void language sql as $$
  insert into tst.results(name, ok, detail) values (p_name, true, null)
$$;

create function tst.fail(p_name text, p_detail text) returns void language sql as $$
  insert into tst.results(name, ok, detail) values (p_name, false, p_detail)
$$;

-- 지정한 사용자(또는 NULL이면 anon)로 SQL을 실행하고, 오류 메시지와 영향 행 수를 돌려준다.
create function tst.run_as(p_uid uuid, p_sql text,
                           out err text, out affected bigint)
language plpgsql as $$
begin
  err := null; affected := null;
  if p_uid is null then
    execute 'set role anon';
    perform set_config('request.jwt.claims', '', false);
  else
    execute 'set role authenticated';
    perform set_config('request.jwt.claims',
                       json_build_object('sub', p_uid)::text, false);
  end if;

  begin
    execute p_sql;
    get diagnostics affected = row_count;
  exception when others then
    err := sqlstate || ' ' || sqlerrm;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claims', '', false);
end $$;

-- 한 값을 돌려주는 SELECT를 지정한 사용자로 실행한다.
create function tst.scalar_as(p_uid uuid, p_sql text,
                              out val text, out err text)
language plpgsql as $$
begin
  val := null; err := null;
  if p_uid is null then
    execute 'set role anon';
    perform set_config('request.jwt.claims', '', false);
  else
    execute 'set role authenticated';
    perform set_config('request.jwt.claims',
                       json_build_object('sub', p_uid)::text, false);
  end if;

  begin
    execute p_sql into val;
  exception when others then
    err := sqlstate || ' ' || sqlerrm;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claims', '', false);
end $$;

-- 오류 없이 실행되어야 한다.
create function tst.expect_ok(p_name text, p_uid uuid, p_sql text) returns void
language plpgsql as $$
declare r record;
begin
  select * into r from tst.run_as(p_uid, p_sql);
  if r.err is null then perform tst.pass(p_name);
  else perform tst.fail(p_name, '성공해야 하는데 오류: ' || r.err);
  end if;
end $$;

-- 지정한 문구를 담은 오류가 나야 한다.
create function tst.expect_error(p_name text, p_uid uuid, p_sql text, p_needle text) returns void
language plpgsql as $$
declare r record;
begin
  select * into r from tst.run_as(p_uid, p_sql);
  if r.err is null then
    perform tst.fail(p_name, '오류가 나야 하는데 성공함(영향 ' || coalesce(r.affected, 0) || '행)');
  elsif position(p_needle in r.err) = 0 then
    perform tst.fail(p_name, '다른 오류: ' || r.err || ' (기대 문구: ' || p_needle || ')');
  else
    perform tst.pass(p_name);
  end if;
end $$;

-- 오류 없이 실행되되 영향 행 수가 기대값이어야 한다. RLS의 "조용한 0건"을 잡는 검사다.
create function tst.expect_rows(p_name text, p_uid uuid, p_sql text, p_expected bigint) returns void
language plpgsql as $$
declare r record;
begin
  select * into r from tst.run_as(p_uid, p_sql);
  if r.err is not null then
    perform tst.fail(p_name, '오류 없이 ' || p_expected || '행이어야 하는데 오류: ' || r.err);
  elsif r.affected is distinct from p_expected then
    perform tst.fail(p_name, '영향 행 수 ' || coalesce(r.affected::text, 'NULL')
                             || ' (기대 ' || p_expected || ')');
  else
    perform tst.pass(p_name);
  end if;
end $$;

-- 관리자(슈퍼유저) 자격으로 상태를 들여다본다. RLS를 거치지 않으므로 "실제로 그렇게 저장됐는가"를 본다.
create function tst.expect_admin(p_name text, p_sql text, p_expected text) returns void
language plpgsql as $$
declare v text;
begin
  begin
    execute p_sql into v;
  exception when others then
    perform tst.fail(p_name, '조회 오류: ' || sqlstate || ' ' || sqlerrm);
    return;
  end;
  if v is distinct from p_expected then
    perform tst.fail(p_name, '값 ' || coalesce(v, 'NULL') || ' (기대 ' || coalesce(p_expected,'NULL') || ')');
  else
    perform tst.pass(p_name);
  end if;
end $$;

-- 초대 코드를 앱 바깥으로 "전달"한다.
create function tst.capture_code(p_ledger uuid) returns void language sql as $$
  insert into tst.val(k, v)
  select 'code', invite_code from public.ledgers where id = p_ledger
  on conflict (k) do update set v = excluded.v
$$;

-- SELECT 한 값이 기대값과 같아야 한다.
create function tst.expect_scalar(p_name text, p_uid uuid, p_sql text, p_expected text) returns void
language plpgsql as $$
declare r record;
begin
  select * into r from tst.scalar_as(p_uid, p_sql);
  if r.err is not null then
    perform tst.fail(p_name, '조회 오류: ' || r.err);
  elsif r.val is distinct from p_expected then
    perform tst.fail(p_name, '값 ' || coalesce(r.val, 'NULL') || ' (기대 ' || coalesce(p_expected,'NULL') || ')');
  else
    perform tst.pass(p_name);
  end if;
end $$;

grant usage on schema tst to anon, authenticated;
grant select on tst.fix to anon, authenticated;
grant select on tst.val to anon, authenticated;

-- ============================================================================
-- 픽스처 — 사용자 4명. auth.users INSERT가 handle_new_user 트리거를 발화시킨다.
-- ============================================================================
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'chulsoo@example.com', '{"name":"김철수"}'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'younghee@example.com', '{"full_name":"이영희"}'),
  ('cccccccc-0000-4000-8000-000000000003', null,                   '{}'),
  ('dddddddd-0000-4000-8000-000000000004', 'minho@example.com',    '{}');

insert into tst.fix(k, v)
select 'A', 'aaaaaaaa-0000-4000-8000-000000000001'::uuid
union all select 'B', 'bbbbbbbb-0000-4000-8000-000000000002'
union all select 'C', 'cccccccc-0000-4000-8000-000000000003'
union all select 'D', 'dddddddd-0000-4000-8000-000000000004';

insert into tst.fix(k, v)
select 'L1', ledger_id from public.ledger_members where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';
insert into tst.fix(k, v)
select 'LB', ledger_id from public.ledger_members where user_id = 'bbbbbbbb-0000-4000-8000-000000000002';
insert into tst.fix(k, v)
select 'L3', ledger_id from public.ledger_members where user_id = 'cccccccc-0000-4000-8000-000000000003';
insert into tst.fix(k, v)
select 'L4', ledger_id from public.ledger_members where user_id = 'dddddddd-0000-4000-8000-000000000004';

-- ============================================================================
-- T1. 첫 로그인 — 개인 장부 자동 생성
-- ============================================================================
select tst.expect_admin('T1.1 첫 로그인 시 사용자마다 장부 1권', $q$ select count(*)::text from public.ledger_members $q$, '4');

select tst.expect_admin('T1.2 첫 구성원은 owner', $q$ select count(*)::text from public.ledger_members where role = 'owner' $q$, '4');

select tst.expect_admin('T1.3 display_name은 메타데이터 name', $q$ select display_name from public.ledger_members
             where user_id = (select v from tst.fix where k='A') $q$, '김철수');

select tst.expect_admin('T1.4 display_name은 메타데이터 full_name 폴백', $q$ select display_name from public.ledger_members
             where user_id = (select v from tst.fix where k='B') $q$, '이영희');

select tst.expect_admin('T1.5 이름·이메일 모두 없으면 구성원', $q$ select display_name from public.ledger_members
             where user_id = (select v from tst.fix where k='C') $q$, '구성원');

select tst.expect_admin('T1.6 이름 없으면 이메일 앞부분', $q$ select display_name from public.ledger_members
             where user_id = (select v from tst.fix where k='D') $q$, 'minho');

select tst.expect_admin('T1.7 장부 기본 이름은 내 장부', $q$ select name from public.ledgers where id = (select v from tst.fix where k='L1') $q$, '내 장부');

-- ============================================================================
-- T2. 초대 코드와 합류
-- ============================================================================
select tst.expect_error('T2.1 구성원이 아니면 초대 코드 발급 불가',
  (select v from tst.fix where k='B'),
  $q$ select public.create_invite_code((select v from tst.fix where k='L1')) $q$,
  'not_owner');

-- A가 코드를 발급하고 그 값을 픽스처에 남긴다(superuser로 조회).
select tst.expect_ok('T2.2 owner는 초대 코드를 발급한다',
  (select v from tst.fix where k='A'),
  $q$ select public.create_invite_code((select v from tst.fix where k='L1')) $q$);

select tst.capture_code((select v from tst.fix where k='L1'));

select tst.expect_admin('T2.3 초대 코드는 혼동 문자 없는 8자',
  $q$ select (invite_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$')::text
        from public.ledgers where id = (select v from tst.fix where k='L1') $q$,
  'true');

select tst.expect_admin('T2.4 초대 코드 만료는 24시간 뒤',
  $q$ select (invite_code_expires_at between now() + interval '23 hours'
                                        and now() + interval '25 hours')::text
        from public.ledgers where id = (select v from tst.fix where k='L1') $q$,
  'true');

select tst.expect_ok('T2.5 B가 초대 코드로 합류한다',
  (select v from tst.fix where k='B'),
  $q$ select public.join_ledger((select v from tst.val where k='code')) $q$);

select tst.expect_admin('T2.6 B는 L1의 member',
  $q$ select role from public.ledger_members
       where ledger_id = (select v from tst.fix where k='L1')
         and user_id = (select v from tst.fix where k='B') $q$,
  'member');

select tst.expect_admin('T2.7 합류 후 코드는 소멸(1회용)',
  $q$ select coalesce(invite_code, 'NULL') from public.ledgers
       where id = (select v from tst.fix where k='L1') $q$,
  'NULL');

select tst.expect_admin('T2.8 B의 빈 개인 장부는 자동 정리',
  $q$ select count(*)::text from public.ledgers where id = (select v from tst.fix where k='LB') $q$,
  '0');

select tst.expect_scalar('T2.9 B의 장부는 L1 한 권뿐',
  (select v from tst.fix where k='B'),
  $q$ select count(*)::text from public.ledger_members
       where user_id = (select v from tst.fix where k='B') $q$,
  '1');

-- 1회용 검증 — T2.5가 실제로 소비한 바로 그 코드를 다시 넣는다(존재하지 않는 코드가 아니다).
select tst.expect_error('T2.10 방금 소비된 코드는 재사용 불가',
  (select v from tst.fix where k='D'),
  $q$ select public.join_ledger((select v from tst.val where k='code')) $q$,
  'invalid_or_expired_code');

select tst.expect_error('T2.10b 없는 코드도 거부',
  (select v from tst.fix where k='D'),
  $q$ select public.join_ledger('ZZZZZZZZ') $q$,
  'invalid_or_expired_code');

select tst.expect_error('T2.11 member는 초대 코드 발급 불가',
  (select v from tst.fix where k='B'),
  $q$ select public.create_invite_code((select v from tst.fix where k='L1')) $q$,
  'not_owner');

-- 만료된 코드 검사 — 발급 후 superuser가 만료 시각을 과거로 돌린다.
select tst.expect_ok('T2.12 재발급 준비',
  (select v from tst.fix where k='A'),
  $q$ select public.create_invite_code((select v from tst.fix where k='L1')) $q$);

select tst.capture_code((select v from tst.fix where k='L1'));

update public.ledgers set invite_code_expires_at = now() - interval '1 minute'
 where id = (select v from tst.fix where k='L1');

select tst.expect_error('T2.13 만료된 코드로는 합류 불가',
  (select v from tst.fix where k='D'),
  $q$ select public.join_ledger((select v from tst.val where k='code')) $q$,
  'invalid_or_expired_code');

-- ============================================================================
-- T3. 데이터 생성과 같은 장부 구성원의 접근
-- ============================================================================
select tst.expect_ok('T3.1 A가 사람 2명을 만든다',
  (select v from tst.fix where k='A'),
  $q$ insert into public.people (id, ledger_id, name, relation_group, label) values
      ('11111111-0000-4000-8000-000000000001', (select v from tst.fix where k='L1'), '김 철수', 'work', '회사 동기'),
      ('11111111-0000-4000-8000-000000000002', (select v from tst.fix where k='L1'), 'Kim Chulsoo', 'friend', null) $q$);

select tst.expect_admin('T3.2 name_normalized는 공백 제거',
  $q$ select name_normalized from public.people where id = '11111111-0000-4000-8000-000000000001' $q$,
  '김철수');

select tst.expect_admin('T3.3 name_normalized는 소문자화',
  $q$ select name_normalized from public.people where id = '11111111-0000-4000-8000-000000000002' $q$,
  'kimchulsoo');

-- 이름 자동완성은 정규화된 이름의 prefix 일치를 people_name_idx로 찾는다(docs/03 §9.2).
select tst.expect_scalar('T3.3b 정규화된 이름의 prefix 조회가 맞는다',
  (select v from tst.fix where k='A'),
  $q$ select count(*)::text from public.people where name_normalized like '김%' $q$, '1');

select tst.expect_scalar('T3.3c 영문 prefix는 소문자로 찾는다',
  (select v from tst.fix where k='A'),
  $q$ select count(*)::text from public.people where name_normalized like 'kim%' $q$, '1');

select tst.expect_ok('T3.4 A가 남의 행사와 내 행사를 만든다',
  (select v from tst.fix where k='A'),
  $q$ insert into public.events (id, ledger_id, type, is_mine, host_person_id, title, date) values
      ('22222222-0000-4000-8000-000000000001', (select v from tst.fix where k='L1'), 'wedding', false,
       '11111111-0000-4000-8000-000000000001', '김철수 결혼식 2025', '2025-05-18'),
      ('22222222-0000-4000-8000-000000000002', (select v from tst.fix where k='L1'), 'first_birthday', true,
       null, '내 돌잔치', '2026-03-01') $q$);

select tst.expect_ok('T3.5 A가 기록 3건을 만든다',
  (select v from tst.fix where k='A'),
  $q$ insert into public.entries (id, ledger_id, event_id, person_id, co_person_id, amount) values
      ('33333333-0000-4000-8000-000000000001', (select v from tst.fix where k='L1'),
       '22222222-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', null, 100000),
      ('33333333-0000-4000-8000-000000000002', (select v from tst.fix where k='L1'),
       '22222222-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000002',
       '11111111-0000-4000-8000-000000000001', 50000),
      ('33333333-0000-4000-8000-000000000003', (select v from tst.fix where k='L1'),
       '22222222-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000002', null, null) $q$);

select tst.expect_admin('T3.6 created_by는 입력자로 자동 기록',
  $q$ select created_by::text from public.entries where id = '33333333-0000-4000-8000-000000000001' $q$,
  'aaaaaaaa-0000-4000-8000-000000000001');

select tst.expect_scalar('T3.7 B(같은 장부)는 A가 만든 사람을 본다',
  (select v from tst.fix where k='B'),
  $q$ select count(*)::text from public.people $q$, '2');

select tst.expect_rows('T3.8 B는 A가 만든 기록을 수정한다',
  (select v from tst.fix where k='B'),
  $q$ update public.entries set memo = '이영희가 수정'
       where id = '33333333-0000-4000-8000-000000000001' $q$, 1);

select tst.expect_scalar('T3.9 B가 만든 기록도 입력자가 남는다',
  (select v from tst.fix where k='B'),
  $q$ select count(*)::text from public.entries where created_by = (select v from tst.fix where k='A') $q$, '3');

-- ============================================================================
-- T4. 다른 장부 계정(C)의 차단 — 조회 0건, 쓰기 0건, INSERT 거부
-- ============================================================================
select tst.expect_scalar('T4.1 C는 다른 장부의 사람을 못 본다',
  (select v from tst.fix where k='C'),
  $q$ select count(*)::text from public.people $q$, '0');

select tst.expect_scalar('T4.2 C는 다른 장부의 행사를 못 본다',
  (select v from tst.fix where k='C'),
  $q$ select count(*)::text from public.events $q$, '0');

select tst.expect_scalar('T4.3 C는 다른 장부의 기록을 못 본다',
  (select v from tst.fix where k='C'),
  $q$ select count(*)::text from public.entries $q$, '0');

select tst.expect_scalar('T4.4 C는 다른 장부를 못 본다',
  (select v from tst.fix where k='C'),
  $q$ select count(*)::text from public.ledgers $q$, '1');

select tst.expect_scalar('T4.5 C는 다른 장부의 구성원을 못 본다',
  (select v from tst.fix where k='C'),
  $q$ select count(*)::text from public.ledger_members $q$, '1');

-- 핵심 — RLS에 걸린 UPDATE는 오류 없이 0건이 된다. 영향 행 수로만 잡힌다.
select tst.expect_rows('T4.6 C의 사람 UPDATE는 조용히 0건',
  (select v from tst.fix where k='C'),
  $q$ update public.people set name = '탈취' where id = '11111111-0000-4000-8000-000000000001' $q$, 0);

select tst.expect_rows('T4.7 C의 기록 UPDATE는 조용히 0건',
  (select v from tst.fix where k='C'),
  $q$ update public.entries set amount = 1 where id = '33333333-0000-4000-8000-000000000001' $q$, 0);

select tst.expect_rows('T4.8 C의 사람 DELETE는 조용히 0건',
  (select v from tst.fix where k='C'),
  $q$ delete from public.people where id = '11111111-0000-4000-8000-000000000001' $q$, 0);

select tst.expect_rows('T4.9 C의 행사 DELETE는 조용히 0건',
  (select v from tst.fix where k='C'),
  $q$ delete from public.events where id = '22222222-0000-4000-8000-000000000001' $q$, 0);

select tst.expect_rows('T4.10 C의 장부 이름 UPDATE는 조용히 0건',
  (select v from tst.fix where k='C'),
  $q$ update public.ledgers set name = '탈취' where id = (select v from tst.fix where k='L1') $q$, 0);

select tst.expect_error('T4.11 C가 남의 장부에 사람 INSERT하면 거부',
  (select v from tst.fix where k='C'),
  $q$ insert into public.people (ledger_id, name)
      values ((select v from tst.fix where k='L1'), '침입자') $q$,
  'row-level security');

select tst.expect_error('T4.12 C가 남의 장부에 행사 INSERT하면 거부',
  (select v from tst.fix where k='C'),
  $q$ insert into public.events (ledger_id, type, is_mine, title, date)
      values ((select v from tst.fix where k='L1'), 'wedding', true, '침입', '2026-01-01') $q$,
  'row-level security');

select tst.expect_scalar('T4.13 C의 수지 뷰에는 남의 장부가 없다',
  (select v from tst.fix where k='C'),
  $q$ select count(*)::text from public.person_balances $q$, '0');

select tst.expect_scalar('T4.14 C가 남의 장부 통계 RPC를 불러도 0건',
  (select v from tst.fix where k='C'),
  $q$ select count(*)::text from public.stats_by_year((select v from tst.fix where k='L1'), null) $q$, '0');

select tst.expect_scalar('T4.15 C가 남의 행사 집계 RPC를 불러도 0건',
  (select v from tst.fix where k='C'),
  $q$ select count(*)::text from public.event_summary((select v from tst.fix where k='L3'), '22222222-0000-4000-8000-000000000001') $q$, '0');

select tst.expect_error('T4.16 C는 남의 사람을 삭제 RPC로도 못 지운다',
  (select v from tst.fix where k='C'),
  $q$ select public.delete_person((select v from tst.fix where k='L3'), '11111111-0000-4000-8000-000000000001') $q$,
  'person_not_found');

-- ============================================================================
-- T5. anon 차단
-- ============================================================================
select tst.expect_error('T5.1 anon은 사람을 못 읽는다',
  null, $q$ select count(*) from public.people $q$, 'permission denied');

select tst.expect_error('T5.2 anon은 장부를 못 읽는다',
  null, $q$ select count(*) from public.ledgers $q$, 'permission denied');

select tst.expect_error('T5.3 anon은 구성원을 못 읽는다',
  null, $q$ select count(*) from public.ledger_members $q$, 'permission denied');

select tst.expect_error('T5.4 anon은 수지 뷰를 못 읽는다',
  null, $q$ select count(*) from public.person_balances $q$, 'permission denied');

select tst.expect_error('T5.5 anon은 합류 RPC를 못 부른다',
  null, $q$ select public.join_ledger('ABCD2345') $q$, 'permission denied');

select tst.expect_error('T5.6 anon은 INSERT도 못 한다',
  null,
  $q$ insert into public.people (ledger_id, name)
      values ((select v from tst.fix where k='L1'), '침입자') $q$,
  'permission denied');

-- ============================================================================
-- T6. 컬럼 권한 — 장부는 이름만 고칠 수 있다
-- ============================================================================
select tst.expect_rows('T6.1 구성원은 장부 이름을 고친다',
  (select v from tst.fix where k='B'),
  $q$ update public.ledgers set name = '우리 집 장부'
       where id = (select v from tst.fix where k='L1') $q$, 1);

select tst.expect_error('T6.2 구성원도 초대 코드는 직접 못 고친다',
  (select v from tst.fix where k='A'),
  $q$ update public.ledgers set invite_code = 'HACKED12'
       where id = (select v from tst.fix where k='L1') $q$,
  'permission denied');

select tst.expect_error('T6.3 장부를 직접 INSERT할 수 없다',
  (select v from tst.fix where k='A'),
  $q$ insert into public.ledgers (name) values ('몰래 만든 장부') $q$,
  'permission denied');

select tst.expect_error('T6.4 구성원 행을 직접 고칠 수 없다',
  (select v from tst.fix where k='B'),
  $q$ update public.ledger_members set role = 'owner'
       where ledger_id = (select v from tst.fix where k='L1')
         and user_id = (select v from tst.fix where k='B') $q$,
  'permission denied');

select tst.expect_error('T6.5 구성원 행을 직접 INSERT할 수 없다',
  (select v from tst.fix where k='C'),
  $q$ insert into public.ledger_members (ledger_id, user_id, role, display_name)
      values ((select v from tst.fix where k='L1'), (select v from tst.fix where k='C'), 'owner', '침입자') $q$,
  'permission denied');

select tst.expect_error('T6.6 구성원 행을 직접 DELETE할 수 없다',
  (select v from tst.fix where k='B'),
  $q$ delete from public.ledger_members
       where ledger_id = (select v from tst.fix where k='L1') $q$,
  'permission denied');

-- ============================================================================
-- T7. 제약과 트리거
-- ============================================================================
select tst.expect_error('T7.1 음수 금액 거부',
  (select v from tst.fix where k='A'),
  $q$ update public.entries set amount = -1 where id = '33333333-0000-4000-8000-000000000001' $q$,
  'entries_amount_check');

select tst.expect_error('T7.2 공동 부조자가 대표자와 같으면 거부',
  (select v from tst.fix where k='A'),
  $q$ update public.entries set co_person_id = person_id
       where id = '33333333-0000-4000-8000-000000000001' $q$,
  'entries_co_person_differs');

select tst.expect_error('T7.3 남의 행사는 당사자가 필수',
  (select v from tst.fix where k='A'),
  $q$ insert into public.events (ledger_id, type, is_mine, title, date)
      values ((select v from tst.fix where k='L1'), 'wedding', false, '당사자 없음', '2026-01-01') $q$,
  'host_person_required');

select tst.expect_error('T7.4 내 행사는 당사자를 가질 수 없다',
  (select v from tst.fix where k='A'),
  $q$ insert into public.events (ledger_id, type, is_mine, host_person_id, title, date)
      values ((select v from tst.fix where k='L1'), 'wedding', true,
              '11111111-0000-4000-8000-000000000001', '내 행사인데 당사자', '2026-01-01') $q$,
  'events_mine_has_no_host');

select tst.expect_error('T7.5 남의 행사에는 측 라벨을 둘 수 없다',
  (select v from tst.fix where k='A'),
  $q$ update public.events set side_a_label = '신랑측'
       where id = '22222222-0000-4000-8000-000000000001' $q$,
  'events_side_a_only_when_mine');

select tst.expect_error('T7.6 측 B는 측 A 없이 존재할 수 없다',
  (select v from tst.fix where k='A'),
  $q$ update public.events set side_b_label = '신부측'
       where id = '22222222-0000-4000-8000-000000000002' $q$,
  'events_side_b_needs_a');

select tst.expect_error('T7.7 기록이 있는 행사는 is_mine을 못 바꾼다',
  (select v from tst.fix where k='A'),
  $q$ update public.events set is_mine = true, host_person_id = null
       where id = '22222222-0000-4000-8000-000000000001' $q$,
  'event_has_entries_is_mine_locked');

select tst.expect_rows('T7.8 기록이 있어도 제목은 고칠 수 있다',
  (select v from tst.fix where k='A'),
  $q$ update public.events set title = '김철수 결혼식'
       where id = '22222222-0000-4000-8000-000000000001' $q$, 1);

select tst.expect_admin('T7.9 UPDATE가 updated_at을 갱신한다',
  $q$ select (updated_at > created_at)::text from public.events
       where id = '22222222-0000-4000-8000-000000000001' $q$,
  'true');

-- ============================================================================
-- T8. 교차 장부 참조 차단 — D를 두 장부 구성원으로 만든다
-- ============================================================================
select tst.expect_ok('T8.1 D가 자기 장부에 데이터를 만든다',
  (select v from tst.fix where k='D'),
  $q$ insert into public.people (id, ledger_id, name) values
      ('44444444-0000-4000-8000-000000000001', (select v from tst.fix where k='L4'), '박민수') $q$);

select tst.expect_ok('T8.2 D가 자기 장부에 행사를 만든다',
  (select v from tst.fix where k='D'),
  $q$ insert into public.events (id, ledger_id, type, is_mine, host_person_id, title, date) values
      ('55555555-0000-4000-8000-000000000001', (select v from tst.fix where k='L4'), 'funeral', false,
       '44444444-0000-4000-8000-000000000001', '박민수 부친상', '2025-09-01') $q$);

select tst.expect_ok('T8.3 A가 D를 위해 코드를 재발급한다',
  (select v from tst.fix where k='A'),
  $q$ select public.create_invite_code((select v from tst.fix where k='L1')) $q$);

select tst.capture_code((select v from tst.fix where k='L1'));

-- 소문자와 공백이 섞인 코드도 정규화되어 합류된다.
select tst.expect_ok('T8.4 D가 소문자·공백 섞인 코드로 합류한다',
  (select v from tst.fix where k='D'),
  $q$ select public.join_ledger(lower(' ' || (select v from tst.val where k='code') || ' ')) $q$);

select tst.expect_scalar('T8.5 데이터가 있는 개인 장부는 남는다(D는 장부 2권)',
  (select v from tst.fix where k='D'),
  $q$ select count(*)::text from public.ledger_members
       where user_id = (select v from tst.fix where k='D') $q$, '2');

select tst.expect_error('T8.6 다른 장부의 사람으로 기록을 만들 수 없다',
  (select v from tst.fix where k='D'),
  $q$ insert into public.entries (ledger_id, event_id, person_id, amount)
      values ((select v from tst.fix where k='L1'),
              '22222222-0000-4000-8000-000000000001',
              '44444444-0000-4000-8000-000000000001', 30000) $q$,
  'person_in_other_ledger');

select tst.expect_error('T8.7 다른 장부의 행사로 기록을 만들 수 없다',
  (select v from tst.fix where k='D'),
  $q$ insert into public.entries (ledger_id, event_id, person_id, amount)
      values ((select v from tst.fix where k='L1'),
              '55555555-0000-4000-8000-000000000001',
              '11111111-0000-4000-8000-000000000001', 30000) $q$,
  'event_in_other_ledger');

select tst.expect_error('T8.8 다른 장부의 사람을 공동 부조자로 둘 수 없다',
  (select v from tst.fix where k='D'),
  $q$ insert into public.entries (ledger_id, event_id, person_id, co_person_id, amount)
      values ((select v from tst.fix where k='L1'),
              '22222222-0000-4000-8000-000000000001',
              '11111111-0000-4000-8000-000000000001',
              '44444444-0000-4000-8000-000000000001', 30000) $q$,
  'co_person_in_other_ledger');

select tst.expect_error('T8.9 다른 장부의 사람을 행사 당사자로 둘 수 없다',
  (select v from tst.fix where k='D'),
  $q$ insert into public.events (ledger_id, type, is_mine, host_person_id, title, date)
      values ((select v from tst.fix where k='L1'), 'wedding', false,
              '44444444-0000-4000-8000-000000000001', '교차 참조', '2026-02-02') $q$,
  'host_person_in_other_ledger');

select tst.expect_error('T8.10 다른 장부의 사람끼리는 병합할 수 없다',
  (select v from tst.fix where k='D'),
  $q$ select public.merge_people((select v from tst.fix where k='L4'), '44444444-0000-4000-8000-000000000001',
                                 '11111111-0000-4000-8000-000000000001') $q$,
  'different_ledger');

-- 두 장부 구성원이 공유 장부의 행을 자기 개인 장부로 빼돌리는 경로를 막는다.
-- RLS의 USING/WITH CHECK는 두 장부 모두의 구성원에게 둘 다 참이라 정책만으로는 막히지 않는다.
select tst.expect_error('T8.11 사람을 다른 장부로 옮길 수 없다',
  (select v from tst.fix where k='D'),
  $q$ update public.people set ledger_id = (select v from tst.fix where k='L4')
       where id = '11111111-0000-4000-8000-000000000001' $q$,
  'ledger_id_immutable');

select tst.expect_error('T8.12 행사를 다른 장부로 옮길 수 없다',
  (select v from tst.fix where k='D'),
  $q$ update public.events set ledger_id = (select v from tst.fix where k='L4')
       where id = '22222222-0000-4000-8000-000000000002' $q$,
  'ledger_id_immutable');

select tst.expect_error('T8.13 기록을 다른 장부로 옮길 수 없다',
  (select v from tst.fix where k='D'),
  $q$ update public.entries set ledger_id = (select v from tst.fix where k='L4')
       where id = '33333333-0000-4000-8000-000000000002' $q$,
  'ledger_id_immutable');

select tst.expect_admin('T8.14 옮기기 시도 후에도 사람은 원래 장부에 있다',
  $q$ select (ledger_id = (select v from tst.fix where k='L1'))::text from public.people
       where id = '11111111-0000-4000-8000-000000000001' $q$, 'true');

-- ============================================================================
-- T9. 수지·집계 — 공동 부조는 양쪽에 전액, 합계는 기록 단위
-- ============================================================================
select tst.expect_scalar('T9.1 P1 준 합계 100000',
  (select v from tst.fix where k='A'),
  $q$ select given_total::text from public.person_balances
       where id = '11111111-0000-4000-8000-000000000001' $q$, '100000');

select tst.expect_scalar('T9.2 P1 받은 합계 50000(공동 부조 전액)',
  (select v from tst.fix where k='A'),
  $q$ select received_total::text from public.person_balances
       where id = '11111111-0000-4000-8000-000000000001' $q$, '50000');

select tst.expect_scalar('T9.3 P1 차액 50000',
  (select v from tst.fix where k='A'),
  $q$ select balance::text from public.person_balances
       where id = '11111111-0000-4000-8000-000000000001' $q$, '50000');

select tst.expect_scalar('T9.4 P2 받은 합계 50000(대표자 자격)',
  (select v from tst.fix where k='A'),
  $q$ select received_total::text from public.person_balances
       where id = '11111111-0000-4000-8000-000000000002' $q$, '50000');

select tst.expect_scalar('T9.5 P2 미확정 1건이 합계에서 빠진다',
  (select v from tst.fix where k='A'),
  $q$ select received_unconfirmed::text from public.person_balances
       where id = '11111111-0000-4000-8000-000000000002' $q$, '1');

select tst.expect_scalar('T9.6 P2 기록 수 2건',
  (select v from tst.fix where k='A'),
  $q$ select entry_count::text from public.person_balances
       where id = '11111111-0000-4000-8000-000000000002' $q$, '2');

select tst.expect_scalar('T9.7 P1 기록 수 2건(대표 1 + 공동 1)',
  (select v from tst.fix where k='A'),
  $q$ select entry_count::text from public.person_balances
       where id = '11111111-0000-4000-8000-000000000001' $q$, '2');

select tst.expect_scalar('T9.8 B도 같은 수지를 본다',
  (select v from tst.fix where k='B'),
  $q$ select balance::text from public.person_balances
       where id = '11111111-0000-4000-8000-000000000001' $q$, '50000');

select tst.expect_scalar('T9.9 내 행사 합계는 기록 단위로 50000(공동 중복 없음)',
  (select v from tst.fix where k='A'),
  $q$ select coalesce(sum(total), 0)::text from public.event_summary((select v from tst.fix where k='L1'), '22222222-0000-4000-8000-000000000002') $q$,
  '50000');

select tst.expect_scalar('T9.10 내 행사 미확정 1건',
  (select v from tst.fix where k='A'),
  $q$ select coalesce(sum(unconfirmed), 0)::text from public.event_summary((select v from tst.fix where k='L1'), '22222222-0000-4000-8000-000000000002') $q$,
  '1');

select tst.expect_scalar('T9.11 2025년 준돈 합계 100000',
  (select v from tst.fix where k='A'),
  $q$ select coalesce(sum(total), 0)::text
        from public.stats_by_year((select v from tst.fix where k='L1'), 2025)
       where not is_mine $q$, '100000');

select tst.expect_scalar('T9.12 2026년 받은돈 합계 50000',
  (select v from tst.fix where k='A'),
  $q$ select coalesce(sum(total), 0)::text
        from public.stats_by_year((select v from tst.fix where k='L1'), 2026)
       where is_mine $q$, '50000');

select tst.expect_scalar('T9.13 통계는 현재 장부만 센다',
  (select v from tst.fix where k='D'),
  $q$ select coalesce(sum(cnt), 0)::text
        from public.stats_by_year((select v from tst.fix where k='L4'), null) $q$, '0');

-- 측(side)별 집계와 답례 집계 — 내 행사에 측 라벨을 달고 기록을 양측으로 나눈다.
select tst.expect_rows('T9.14 내 행사에 측 라벨을 단다',
  (select v from tst.fix where k='A'),
  $q$ update public.events set side_a_label = '신랑측', side_b_label = '신부측'
       where id = '22222222-0000-4000-8000-000000000002' $q$, 1);

select tst.expect_rows('T9.15 기록을 신랑측으로 표시한다',
  (select v from tst.fix where k='A'),
  $q$ update public.entries set side = 'a', returned_at = now()
       where id = '33333333-0000-4000-8000-000000000002' $q$, 1);

select tst.expect_rows('T9.16 미확정 기록을 신부측으로 표시한다',
  (select v from tst.fix where k='A'),
  $q$ update public.entries set side = 'b'
       where id = '33333333-0000-4000-8000-000000000003' $q$, 1);

select tst.expect_scalar('T9.17 측별로 행이 나뉘어 집계된다',
  (select v from tst.fix where k='A'),
  $q$ select count(distinct side)::text
        from public.event_summary((select v from tst.fix where k='L1'), '22222222-0000-4000-8000-000000000002') $q$, '2');

select tst.expect_scalar('T9.18 신랑측 합계 50000',
  (select v from tst.fix where k='A'),
  $q$ select coalesce(sum(total), 0)::text
        from public.event_summary((select v from tst.fix where k='L1'), '22222222-0000-4000-8000-000000000002') where side = 'a' $q$, '50000');

select tst.expect_scalar('T9.19 측별 합이 전체와 같다',
  (select v from tst.fix where k='A'),
  $q$ select coalesce(sum(total), 0)::text
        from public.event_summary((select v from tst.fix where k='L1'), '22222222-0000-4000-8000-000000000002') $q$, '50000');

select tst.expect_scalar('T9.20 답례 완료 1건이 집계된다',
  (select v from tst.fix where k='A'),
  $q$ select coalesce(sum(returned), 0)::text
        from public.event_summary((select v from tst.fix where k='L1'), '22222222-0000-4000-8000-000000000002') $q$, '1');

-- 날짜 정밀도가 "년"인 기록도 연도별 통계에 포함된다(docs/02 §5 과거 기록 일괄 입력).
select tst.expect_ok('T9.21 연도만 아는 과거 행사를 만든다',
  (select v from tst.fix where k='A'),
  $q$ insert into public.events (id, ledger_id, type, is_mine, host_person_id, title, date, date_precision)
      values ('22222222-0000-4000-8000-000000000009', (select v from tst.fix where k='L1'), 'wedding', false,
              '11111111-0000-4000-8000-000000000002', '이름 모를 결혼식 2022', '2022-01-01', 'year') $q$);

select tst.expect_ok('T9.22 그 행사에 준돈을 기록한다',
  (select v from tst.fix where k='A'),
  $q$ insert into public.entries (id, ledger_id, event_id, person_id, amount)
      values ('33333333-0000-4000-8000-000000000009', (select v from tst.fix where k='L1'),
              '22222222-0000-4000-8000-000000000009', '11111111-0000-4000-8000-000000000002', 30000) $q$);

select tst.expect_scalar('T9.23 연도 정밀도 기록도 2022년 통계에 잡힌다',
  (select v from tst.fix where k='A'),
  $q$ select coalesce(sum(total), 0)::text
        from public.stats_by_year((select v from tst.fix where k='L1'), 2022) $q$, '30000');

-- 행사 삭제 — 소속 기록은 따라가고 사람은 남는다(docs/02 §5 이벤트 삭제).
select tst.expect_rows('T9.24 행사를 지우면 기록도 따라간다',
  (select v from tst.fix where k='A'),
  $q$ delete from public.events where id = '22222222-0000-4000-8000-000000000009' $q$, 1);

select tst.expect_scalar('T9.25 소속 기록이 사라진다',
  (select v from tst.fix where k='A'),
  $q$ select count(*)::text from public.entries
       where id = '33333333-0000-4000-8000-000000000009' $q$, '0');

select tst.expect_scalar('T9.26 사람은 남는다',
  (select v from tst.fix where k='A'),
  $q$ select count(*)::text from public.people
       where id = '11111111-0000-4000-8000-000000000002' $q$, '1');

-- ============================================================================
-- T10. 병합 — 세 참조 축이 함께 옮겨진다
-- ============================================================================
-- 사람 → 행사 → 기록을 순차로 넣는다. 데이터 수정 CTE 하나로 묶으면 뒤 문장이 앞 CTE의 행을
-- 보지 못해(같은 스냅샷) FK와 같은 장부 트리거가 실패한다. 앱의 빠른 기록도 순차로 저장해야 한다.
select tst.expect_ok('T10.1a 동명이인 P3를 만든다',
  (select v from tst.fix where k='A'),
  $q$ insert into public.people (id, ledger_id, name, relation_group)
      values ('11111111-0000-4000-8000-000000000003', (select v from tst.fix where k='L1'), '김철수', 'work') $q$);

select tst.expect_ok('T10.1b P3가 당사자인 행사를 만든다',
  (select v from tst.fix where k='A'),
  $q$ insert into public.events (id, ledger_id, type, is_mine, host_person_id, title, date)
      values ('22222222-0000-4000-8000-000000000003', (select v from tst.fix where k='L1'), 'funeral', false,
              '11111111-0000-4000-8000-000000000003', '김철수 부친상', '2024-11-11') $q$);

select tst.expect_ok('T10.1c P3에게 준 기록을 만든다',
  (select v from tst.fix where k='A'),
  $q$ insert into public.entries (id, ledger_id, event_id, person_id, amount)
      values ('33333333-0000-4000-8000-000000000004', (select v from tst.fix where k='L1'),
              '22222222-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000003', 70000) $q$);

select tst.expect_error('T10.2 자기 자신과는 병합할 수 없다',
  (select v from tst.fix where k='A'),
  $q$ select public.merge_people((select v from tst.fix where k='L1'), '11111111-0000-4000-8000-000000000003',
                                 '11111111-0000-4000-8000-000000000003') $q$,
  'merge_same_person');

select tst.expect_error('T10.3 공동 부조로 묶인 두 사람은 병합할 수 없다',
  (select v from tst.fix where k='A'),
  $q$ select public.merge_people((select v from tst.fix where k='L1'), '11111111-0000-4000-8000-000000000002',
                                 '11111111-0000-4000-8000-000000000001') $q$,
  'merge_would_self_reference');

select tst.expect_ok('T10.4 P3를 P1으로 병합한다',
  (select v from tst.fix where k='A'),
  $q$ select public.merge_people((select v from tst.fix where k='L1'), '11111111-0000-4000-8000-000000000003',
                                 '11111111-0000-4000-8000-000000000001') $q$);

select tst.expect_scalar('T10.5 병합된 사람은 사라진다',
  (select v from tst.fix where k='A'),
  $q$ select count(*)::text from public.people
       where id = '11111111-0000-4000-8000-000000000003' $q$, '0');

select tst.expect_scalar('T10.6 기록의 대표자가 옮겨진다',
  (select v from tst.fix where k='A'),
  $q$ select person_id::text from public.entries
       where id = '33333333-0000-4000-8000-000000000004' $q$,
  '11111111-0000-4000-8000-000000000001');

select tst.expect_scalar('T10.7 행사의 당사자가 옮겨진다',
  (select v from tst.fix where k='A'),
  $q$ select host_person_id::text from public.events
       where id = '22222222-0000-4000-8000-000000000003' $q$,
  '11111111-0000-4000-8000-000000000001');

select tst.expect_scalar('T10.8 병합 후 준 합계는 170000',
  (select v from tst.fix where k='A'),
  $q$ select given_total::text from public.person_balances
       where id = '11111111-0000-4000-8000-000000000001' $q$, '170000');

-- ============================================================================
-- T11. 사람 삭제 — 기록 동반 삭제, 공동 부조자 자리 비우기, 고아 행사 정리
-- ============================================================================
select tst.expect_ok('T11.1 공동 부조자로만 등장하는 사람 P5를 만든다',
  (select v from tst.fix where k='A'),
  $q$ insert into public.people (id, ledger_id, name)
      values ('11111111-0000-4000-8000-000000000005', (select v from tst.fix where k='L1'), '최수진') $q$);

select tst.expect_rows('T11.2 기존 기록에 P5를 공동 부조자로 넣는다',
  (select v from tst.fix where k='A'),
  $q$ update public.entries set co_person_id = '11111111-0000-4000-8000-000000000005'
       where id = '33333333-0000-4000-8000-000000000004' $q$, 1);

-- delete_person의 고아 행사 정리는 "지운 사람이 당사자이던" 행사로 한정되어야 한다.
-- 장부 전체를 쓸어 담으면 당사자가 비어 있을 뿐인 다른 예정 행사까지 사라진다.
select tst.expect_ok('T11.2b 당사자가 비어 있는 별개의 예정 행사를 만든다',
  (select v from tst.fix where k='A'),
  $q$ insert into public.events (id, ledger_id, type, is_mine, host_person_id, title, date)
      values ('22222222-0000-4000-8000-000000000007', (select v from tst.fix where k='L1'), 'opening', false,
              '11111111-0000-4000-8000-000000000002', '예정 개업식', '2026-12-01') $q$);

select tst.expect_rows('T11.2c 그 행사의 당사자를 비운다',
  (select v from tst.fix where k='A'),
  $q$ update public.events set host_person_id = null
       where id = '22222222-0000-4000-8000-000000000007' $q$, 1);

select tst.expect_ok('T11.3 P5를 삭제한다',
  (select v from tst.fix where k='A'),
  $q$ select public.delete_person((select v from tst.fix where k='L1'), '11111111-0000-4000-8000-000000000005') $q$);

select tst.expect_scalar('T11.4 공동 부조자 자리만 비워지고 기록은 남는다',
  (select v from tst.fix where k='A'),
  $q$ select coalesce(co_person_id::text, 'NULL') from public.entries
       where id = '33333333-0000-4000-8000-000000000004' $q$, 'NULL');

select tst.expect_ok('T11.5 P1을 삭제한다(기록 3건과 고아 행사가 따라간다)',
  (select v from tst.fix where k='A'),
  $q$ select public.delete_person((select v from tst.fix where k='L1'), '11111111-0000-4000-8000-000000000001') $q$);

select tst.expect_scalar('T11.6 그 사람의 기록이 사라진다',
  (select v from tst.fix where k='A'),
  $q$ select count(*)::text from public.entries
       where id in ('33333333-0000-4000-8000-000000000001','33333333-0000-4000-8000-000000000004') $q$, '0');

select tst.expect_scalar('T11.7 당사자가 사라져 빈 남의 행사도 정리된다',
  (select v from tst.fix where k='A'),
  $q$ select count(*)::text from public.events
       where id in ('22222222-0000-4000-8000-000000000001','22222222-0000-4000-8000-000000000003') $q$, '0');

select tst.expect_scalar('T11.8 내 행사와 그 기록은 남는다',
  (select v from tst.fix where k='A'),
  $q$ select count(*)::text from public.entries
       where event_id = '22222222-0000-4000-8000-000000000002' $q$, '2');

select tst.expect_admin('T11.8b 무관한 예정 행사는 삭제에 휩쓸리지 않는다',
  $q$ select count(*)::text from public.events
       where id = '22222222-0000-4000-8000-000000000007' $q$, '1');

select tst.expect_scalar('T11.9 공동 부조였던 기록의 공동 자리가 비워진다',
  (select v from tst.fix where k='A'),
  $q$ select coalesce(co_person_id::text, 'NULL') from public.entries
       where id = '33333333-0000-4000-8000-000000000002' $q$, 'NULL');

-- ============================================================================
-- T12. 구성원 제거·탈퇴·owner 승계
-- ============================================================================
select tst.expect_error('T12.1 마지막 구성원은 장부를 나갈 수 없다',
  (select v from tst.fix where k='C'),
  $q$ select public.remove_member((select v from tst.fix where k='L3'),
                                  (select v from tst.fix where k='C')) $q$,
  'sole_member_cannot_leave');

select tst.expect_error('T12.2 member는 다른 구성원을 못 내보낸다',
  (select v from tst.fix where k='B'),
  $q$ select public.remove_member((select v from tst.fix where k='L1'),
                                  (select v from tst.fix where k='D')) $q$,
  'not_owner');

select tst.expect_error('T12.3 구성원이 아니면 아예 부를 수 없다',
  (select v from tst.fix where k='C'),
  $q$ select public.remove_member((select v from tst.fix where k='L1'),
                                  (select v from tst.fix where k='B')) $q$,
  'not_member');

select tst.expect_ok('T12.4 member는 스스로 나갈 수 있다',
  (select v from tst.fix where k='D'),
  $q$ select public.remove_member((select v from tst.fix where k='L1'),
                                  (select v from tst.fix where k='D')) $q$);

select tst.expect_scalar('T12.5 나간 뒤 D의 장부는 1권',
  (select v from tst.fix where k='D'),
  $q$ select count(*)::text from public.ledger_members
       where user_id = (select v from tst.fix where k='D') $q$, '1');

select tst.expect_ok('T12.6 owner가 장부를 나간다',
  (select v from tst.fix where k='A'),
  $q$ select public.remove_member((select v from tst.fix where k='L1'),
                                  (select v from tst.fix where k='A')) $q$);

select tst.expect_scalar('T12.7 가장 먼저 합류한 구성원이 owner를 승계한다',
  (select v from tst.fix where k='B'),
  $q$ select role from public.ledger_members
       where ledger_id = (select v from tst.fix where k='L1')
         and user_id = (select v from tst.fix where k='B') $q$, 'owner');

select tst.expect_scalar('T12.8 나간 A는 장부가 0권이 된다',
  (select v from tst.fix where k='A'),
  $q$ select count(*)::text from public.ledger_members
       where user_id = (select v from tst.fix where k='A') $q$, '0');

select tst.expect_ok('T12.9 승계받은 owner는 초대 코드를 발급할 수 있다',
  (select v from tst.fix where k='B'),
  $q$ select public.create_invite_code((select v from tst.fix where k='L1')) $q$);

select tst.capture_code((select v from tst.fix where k='L1'));

-- ============================================================================
-- T13. 계정 삭제 — 혼자면 장부와 데이터 삭제, 함께면 구성원만 제거
-- ============================================================================
select tst.expect_ok('T13.1 C(혼자 쓰는 장부)가 계정 삭제를 준비한다',
  (select v from tst.fix where k='C'),
  $q$ select public.prepare_account_deletion() $q$);

select tst.expect_admin('T13.2 혼자 쓰던 장부는 삭제된다',
  $q$ select count(*)::text from public.ledgers where id = (select v from tst.fix where k='L3') $q$, '0');

-- D를 다시 L1에 합류시켜 "공유 장부 + 개인 장부" 상태를 만든다.
select tst.expect_ok('T13.3 D가 다시 L1에 합류한다',
  (select v from tst.fix where k='D'),
  $q$ select public.join_ledger((select v from tst.val where k='code')) $q$);

select tst.expect_ok('T13.4 D가 계정 삭제를 준비한다',
  (select v from tst.fix where k='D'),
  $q$ select public.prepare_account_deletion() $q$);

select tst.expect_admin('T13.5 D의 개인 장부는 데이터와 함께 삭제된다',
  $q$ select count(*)::text from public.ledgers where id = (select v from tst.fix where k='L4') $q$, '0');

select tst.expect_admin('T13.6 D 개인 장부의 사람도 삭제된다',
  $q$ select count(*)::text from public.people
       where id = '44444444-0000-4000-8000-000000000001' $q$, '0');

select tst.expect_admin('T13.7 함께 쓰던 장부는 남는다',
  $q$ select count(*)::text from public.ledgers where id = (select v from tst.fix where k='L1') $q$, '1');

select tst.expect_scalar('T13.8 공유 장부에는 B만 남는다',
  (select v from tst.fix where k='B'),
  $q$ select count(*)::text from public.ledger_members
       where ledger_id = (select v from tst.fix where k='L1') $q$, '1');

select tst.expect_scalar('T13.9 공유 장부의 데이터는 그대로다',
  (select v from tst.fix where k='B'),
  $q$ select count(*)::text from public.entries $q$, '2');

-- 실제 계정 삭제는 Edge Function이 service role로 auth.admin.deleteUser를 불러 수행한다.
-- 그 뒤의 FK 동작(입력자 자리 SET NULL)을 확인한다. A가 만든 기록 2건이 공유 장부에 남아 있다.
select tst.expect_admin('T13.10 삭제 전 입력자가 남아 있다',
  $q$ select count(*)::text from public.entries
       where created_by = (select v from tst.fix where k='A') $q$, '2');

delete from auth.users where id = (select v from tst.fix where k='A');

select tst.expect_admin('T13.11 사용자 삭제 후 입력자 자리는 NULL이 되고 기록은 남는다',
  $q$ select count(*)::text from public.entries where created_by is null $q$, '2');

select tst.expect_admin('T13.12 기록 자체는 사라지지 않는다', $q$ select count(*)::text from public.entries $q$, '2');

-- 계정 삭제 후 같은 사람이 다시 가입하면 빈 장부로 새로 시작한다(docs/02 §5 계정 삭제).
delete from auth.users where id = (select v from tst.fix where k='C');

insert into auth.users (id, email, raw_user_meta_data)
values ('cccccccc-0000-4000-8000-000000000099', 'again@example.com', '{"name":"재가입"}');

select tst.expect_admin('T13.13 재가입하면 개인 장부가 새로 생긴다',
  $q$ select count(*)::text from public.ledger_members
       where user_id = 'cccccccc-0000-4000-8000-000000000099' $q$, '1');

select tst.expect_admin('T13.14 새 장부는 비어 있다',
  $q$ select count(*)::text from public.people p
        join public.ledger_members m on m.ledger_id = p.ledger_id
       where m.user_id = 'cccccccc-0000-4000-8000-000000000099' $q$, '0');

-- ============================================================================
-- T14. 고아 장부 정리 — 앱 밖에서 계정이 지워져도 데이터가 주인 없이 남지 않는다
-- 정상 경로(Edge Function)는 prepare_account_deletion을 먼저 부르지만,
-- 대시보드·관리자 API는 auth.users를 바로 지운다. 그때 ledger_members만 CASCADE로 사라진다.
-- ============================================================================
insert into auth.users (id, email, raw_user_meta_data)
values ('eeeeeeee-0000-4000-8000-000000000001', 'solo@example.com', '{"name":"혼자쓰는사람"}');

insert into tst.fix(k, v)
select 'LE', ledger_id from public.ledger_members
 where user_id = 'eeeeeeee-0000-4000-8000-000000000001';

select tst.expect_ok('T14.1 E가 자기 장부에 사람을 만든다',
  'eeeeeeee-0000-4000-8000-000000000001',
  $q$ insert into public.people (ledger_id, name)
      values ((select v from tst.fix where k='LE'), '고아가될사람') $q$);

-- 대시보드에서 계정을 바로 지우는 경로
delete from auth.users where id = 'eeeeeeee-0000-4000-8000-000000000001';

select tst.expect_admin('T14.2 구성원이 사라진 장부는 함께 삭제된다',
  $q$ select count(*)::text from public.ledgers
       where id = (select v from tst.fix where k='LE') $q$, '0');

select tst.expect_admin('T14.3 그 장부의 사람도 남지 않는다',
  $q$ select count(*)::text from public.people where name = '고아가될사람' $q$, '0');

-- 반대로 구성원이 남아 있는 장부는 지워지면 안 된다.
insert into auth.users (id, email, raw_user_meta_data)
values ('eeeeeeee-0000-4000-8000-000000000002', 'pair1@example.com', '{"name":"부부1"}'),
       ('eeeeeeee-0000-4000-8000-000000000003', 'pair2@example.com', '{"name":"부부2"}');

insert into tst.fix(k, v)
select 'LF', ledger_id from public.ledger_members
 where user_id = 'eeeeeeee-0000-4000-8000-000000000002';

select tst.expect_ok('T14.4 부부1이 초대 코드를 발급한다',
  'eeeeeeee-0000-4000-8000-000000000002',
  $q$ select public.create_invite_code((select v from tst.fix where k='LF')) $q$);

select tst.capture_code((select v from tst.fix where k='LF'));

select tst.expect_ok('T14.5 부부2가 합류한다',
  'eeeeeeee-0000-4000-8000-000000000003',
  $q$ select public.join_ledger((select v from tst.val where k='code')) $q$);

select tst.expect_ok('T14.6 공유 장부에 사람을 만든다',
  'eeeeeeee-0000-4000-8000-000000000002',
  $q$ insert into public.people (ledger_id, name)
      values ((select v from tst.fix where k='LF'), '남아야하는사람') $q$);

delete from auth.users where id = 'eeeeeeee-0000-4000-8000-000000000002';

select tst.expect_admin('T14.7 구성원이 남은 장부는 삭제되지 않는다',
  $q$ select count(*)::text from public.ledgers
       where id = (select v from tst.fix where k='LF') $q$, '1');

select tst.expect_admin('T14.8 남은 구성원에게 데이터가 보존된다',
  $q$ select count(*)::text from public.people where name = '남아야하는사람' $q$, '1');

select tst.expect_admin('T14.9 남은 구성원이 owner를 승계한다',
  $q$ select role from public.ledger_members
       where ledger_id = (select v from tst.fix where k='LF') $q$, 'owner');

-- ============================================================================
-- T15. 데이터 RPC의 장부 가드 — 두 장부 구성원이 현재 장부 밖을 건드리지 못한다
-- RLS는 "내가 구성원인 모든 장부"를 허용하므로 정책만으로는 막히지 않는다(0003).
-- ============================================================================
insert into auth.users (id, email, raw_user_meta_data)
values ('eeeeeeee-0000-4000-8000-000000000004', 'twoledger@example.com', '{"name":"두장부"}');

insert into tst.fix(k, v)
select 'LG', ledger_id from public.ledger_members
 where user_id = 'eeeeeeee-0000-4000-8000-000000000004';

select tst.expect_ok('T15.1 G가 자기 장부에 사람·행사·기록을 만든다',
  'eeeeeeee-0000-4000-8000-000000000004',
  $q$ insert into public.people (id, ledger_id, name)
      values ('77777777-0000-4000-8000-000000000001',
              (select v from tst.fix where k='LG'), '내장부사람') $q$);

select tst.expect_ok('T15.2 G가 자기 장부에 행사를 만든다',
  'eeeeeeee-0000-4000-8000-000000000004',
  $q$ insert into public.events (id, ledger_id, type, is_mine, host_person_id, title, date)
      values ('88888888-0000-4000-8000-000000000001',
              (select v from tst.fix where k='LG'), 'wedding', false,
              '77777777-0000-4000-8000-000000000001', '내장부사람 결혼식', '2026-05-05') $q$);

select tst.expect_ok('T15.3 G가 기록을 만든다',
  'eeeeeeee-0000-4000-8000-000000000004',
  $q$ insert into public.entries (ledger_id, event_id, person_id, amount)
      values ((select v from tst.fix where k='LG'),
              '88888888-0000-4000-8000-000000000001',
              '77777777-0000-4000-8000-000000000001', 50000) $q$);

-- G가 LF에도 합류해 두 장부의 구성원이 된다. 데이터가 있으므로 개인 장부는 정리되지 않는다.
select tst.expect_ok('T15.4 LF의 owner가 초대 코드를 발급한다',
  'eeeeeeee-0000-4000-8000-000000000003',
  $q$ select public.create_invite_code((select v from tst.fix where k='LF')) $q$);

select tst.capture_code((select v from tst.fix where k='LF'));

select tst.expect_ok('T15.5 G가 LF에 합류한다',
  'eeeeeeee-0000-4000-8000-000000000004',
  $q$ select public.join_ledger((select v from tst.val where k='code')) $q$);

select tst.expect_scalar('T15.6 G는 두 장부의 구성원이다',
  'eeeeeeee-0000-4000-8000-000000000004',
  $q$ select count(*)::text from public.ledger_members
       where user_id = 'eeeeeeee-0000-4000-8000-000000000004' $q$, '2');

-- 여기부터가 0003이 막는 것. 현재 장부를 LF로 두고 LG의 행을 건드린다.
select tst.expect_error('T15.7 현재 장부를 LF로 두고 LG의 사람을 지울 수 없다',
  'eeeeeeee-0000-4000-8000-000000000004',
  $q$ select public.delete_person((select v from tst.fix where k='LF'),
                                  '77777777-0000-4000-8000-000000000001') $q$,
  'wrong_ledger');

select tst.expect_scalar('T15.8 그 사람은 그대로 남아 있다',
  'eeeeeeee-0000-4000-8000-000000000004',
  $q$ select count(*)::text from public.people
       where id = '77777777-0000-4000-8000-000000000001' $q$, '1');

select tst.expect_scalar('T15.9 현재 장부를 LF로 두면 LG 행사 집계는 0건이다',
  'eeeeeeee-0000-4000-8000-000000000004',
  $q$ select count(*)::text from public.event_summary(
        (select v from tst.fix where k='LF'),
        '88888888-0000-4000-8000-000000000001') $q$, '0');

select tst.expect_scalar('T15.10 자기 장부를 넘기면 집계가 나온다',
  'eeeeeeee-0000-4000-8000-000000000004',
  $q$ select coalesce(sum(total), 0)::text from public.event_summary(
        (select v from tst.fix where k='LG'),
        '88888888-0000-4000-8000-000000000001') $q$, '50000');

select tst.expect_ok('T15.11 LG에 두 번째 사람을 만든다',
  'eeeeeeee-0000-4000-8000-000000000004',
  $q$ insert into public.people (id, ledger_id, name)
      values ('77777777-0000-4000-8000-000000000002',
              (select v from tst.fix where k='LG'), '내장부사람2') $q$);

select tst.expect_error('T15.12 현재 장부를 LF로 두고 LG의 두 사람을 합칠 수 없다',
  'eeeeeeee-0000-4000-8000-000000000004',
  $q$ select public.merge_people((select v from tst.fix where k='LF'),
                                 '77777777-0000-4000-8000-000000000002',
                                 '77777777-0000-4000-8000-000000000001') $q$,
  'wrong_ledger');

select tst.expect_error('T15.13 금액 상한을 넘는 기록은 저장되지 않는다',
  'eeeeeeee-0000-4000-8000-000000000004',
  $q$ insert into public.entries (ledger_id, event_id, person_id, amount)
      values ((select v from tst.fix where k='LG'),
              '88888888-0000-4000-8000-000000000001',
              '77777777-0000-4000-8000-000000000001', 2000000000) $q$,
  'entries_amount_max');

select tst.expect_ok('T15.14 상한 이하 금액은 저장된다',
  'eeeeeeee-0000-4000-8000-000000000004',
  $q$ insert into public.entries (ledger_id, event_id, person_id, amount)
      values ((select v from tst.fix where k='LG'),
              '88888888-0000-4000-8000-000000000001',
              '77777777-0000-4000-8000-000000000001', 1000000000) $q$);

-- ============================================================================
-- 결과 요약
-- ============================================================================
\echo ''
\echo '================ 실패한 검사 ================'
select seq, name, detail from tst.results where not ok order by seq;

\echo ''
\echo '================ 요약 ================'
select count(*) filter (where ok)     as "통과",
       count(*) filter (where not ok) as "실패",
       count(*)                       as "전체"
  from tst.results;

-- 실패가 하나라도 있으면 0이 아닌 종료 코드로 끝낸다.
do $$
declare n int;
begin
  select count(*) into n from tst.results where not ok;
  if n > 0 then
    raise exception 'RLS 검증 실패 %건', n;
  end if;
end $$;
