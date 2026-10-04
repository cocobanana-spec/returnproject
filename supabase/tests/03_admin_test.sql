-- 관리자 통계(0011) 검증 — 접속 기록은 로그인한 사용자만, 통계는 관리자만, 숫자가 맞는지
-- 02 뒤에 같은 DB 에서 돈다. tst.* 하네스를 그대로 쓴다.

\set ON_ERROR_STOP on

create temp table adm_mark as select coalesce(max(seq), 0) as seq0 from tst.results;

-- 픽스처 — 관리자 메일을 가진 계정 M, 보통 계정 N1·N2
insert into auth.users (id, email, raw_user_meta_data) values
  ('ad000000-0000-4000-8000-000000000001', 'DongHan.Cocoperry@gmail.com', '{"name":"운영자"}'),   -- 대소문자 섞어도 잡혀야 한다
  ('ad000000-0000-4000-8000-000000000002', 'n1@example.com', '{}'),
  ('ad000000-0000-4000-8000-000000000003', 'n2@example.com', '{}');

do $$
declare r record; n text; j jsonb;
begin
  -- 1. anon 은 접속 기록을 못 남긴다
  select * into r from tst.run_as(null, $q$ select public.record_activity('device-anon-00000001', 'ios') $q$);
  if r.err like '42501%' then perform tst.pass('접속 기록: anon 은 못 부름');
  else perform tst.fail('접속 기록: anon 은 못 부름', coalesce(r.err, '통과됨')); end if;

  -- 2. 보통 사용자가 남긴다 — 같은 날 같은 기기는 한 번만
  select * into r from tst.run_as('ad000000-0000-4000-8000-000000000002', $q$ select public.record_activity('device-n1-000000001', 'ios') $q$);
  if r.err is null then perform tst.pass('접속 기록: 로그인 사용자가 남긴다'); else perform tst.fail('접속 기록: 로그인 사용자가 남긴다', r.err); end if;
  select * into r from tst.run_as('ad000000-0000-4000-8000-000000000002', $q$ select public.record_activity('device-n1-000000001', 'ios') $q$);
  select * into r from tst.run_as('ad000000-0000-4000-8000-000000000002', $q$ select public.record_activity('device-n1-000000002', 'web') $q$);
  select * into r from tst.run_as('ad000000-0000-4000-8000-000000000003', $q$ select public.record_activity('device-n2-000000001', 'android') $q$);
  n := (select count(*)::text from public.app_installs);
  if n = '3' then perform tst.pass('설치: 기기 3대'); else perform tst.fail('설치: 기기 3대', n); end if;
  n := (select count(*)::text from public.app_activity);
  if n = '3' then perform tst.pass('접속: (사용자,날,플랫폼) 3건 — 중복은 한 번'); else perform tst.fail('접속: (사용자,날,플랫폼) 3건', n); end if;

  -- 3. 잘못된 플랫폼은 거부
  select * into r from tst.run_as('ad000000-0000-4000-8000-000000000002', $q$ select public.record_activity('device-n1-000000009', 'windows') $q$);
  if r.err like '%bad_platform%' then perform tst.pass('접속 기록: 모르는 플랫폼 거부'); else perform tst.fail('접속 기록: 모르는 플랫폼 거부', coalesce(r.err, '통과됨')); end if;

  -- 4. 테이블은 아무도 직접 못 읽는다
  select * into r from tst.run_as('ad000000-0000-4000-8000-000000000001', $q$ select count(*) from public.app_activity $q$);
  if r.err like '42501%' then perform tst.pass('테이블: 관리자도 직접은 못 읽음(함수로만)'); else perform tst.fail('테이블: 관리자도 직접은 못 읽음', coalesce(r.err, '통과됨')); end if;
  select * into r from tst.run_as('ad000000-0000-4000-8000-000000000002', $q$ select count(*) from public.app_admins $q$);
  if r.err like '42501%' then perform tst.pass('테이블: 관리자 목록은 아무도 못 읽음'); else perform tst.fail('테이블: 관리자 목록은 아무도 못 읽음', coalesce(r.err, '통과됨')); end if;

  -- 5. 통계는 관리자만
  select * into r from tst.run_as('ad000000-0000-4000-8000-000000000002', $q$ select public.admin_stats() $q$);
  if r.err like '%not_admin%' then perform tst.pass('통계: 보통 사용자는 거부'); else perform tst.fail('통계: 보통 사용자는 거부', coalesce(r.err, '통과됨')); end if;
  select * into r from tst.run_as(null, $q$ select public.admin_stats() $q$);
  if r.err like '42501%' then perform tst.pass('통계: anon 은 거부'); else perform tst.fail('통계: anon 은 거부', coalesce(r.err, '통과됨')); end if;

  n := (tst.scalar_as('ad000000-0000-4000-8000-000000000001', $q$ select public.admin_stats()::text $q$)).val;
  if n is not null then perform tst.pass('통계: 관리자(메일 대소문자 무관)는 받는다'); else perform tst.fail('통계: 관리자는 받는다', 'null'); end if;
  j := n::jsonb;
  if (j->'active'->>'today') = '2' then perform tst.pass('통계: 오늘 활성 2명'); else perform tst.fail('통계: 오늘 활성 2명', j->'active'->>'today'); end if;
  if (j->'installs_by_platform'->'ios'->>'today') = '1' and (j->'installs_by_platform'->'web'->>'today') = '1' and (j->'installs_by_platform'->'android'->>'today') = '1'
    then perform tst.pass('통계: 플랫폼별 오늘 설치 1·1·1'); else perform tst.fail('통계: 플랫폼별 오늘 설치', (j->'installs_by_platform')::text); end if;
  if (j->>'users_total')::int >= 3 then perform tst.pass('통계: 총 회원 수가 센다'); else perform tst.fail('통계: 총 회원 수', j->>'users_total'); end if;
  if jsonb_array_length(j->'daily_active') = 30 then perform tst.pass('통계: 최근 30일 일별 배열'); else perform tst.fail('통계: 최근 30일 일별 배열', jsonb_array_length(j->'daily_active')::text); end if;
end $$;

\echo ''
\echo '================ 관리자 — 실패한 검사 ================'
select seq, name, detail from tst.results where not ok and seq > (select seq0 from adm_mark) order by seq;
\echo ''
\echo '================ 관리자 — 요약 ================'
select count(*) filter (where ok) as "통과", count(*) filter (where not ok) as "실패", count(*) as "전체"
  from tst.results where seq > (select seq0 from adm_mark);
do $$
declare n int;
begin
  select count(*) into n from tst.results where not ok and seq > (select seq0 from adm_mark);
  if n > 0 then raise exception '관리자 검증 실패 %건', n; end if;
end $$;
