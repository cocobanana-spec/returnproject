-- 청첩장(0009) 검증 — 01_rls_test.sql 의 하네스(tst.*)와 계정 A·B(같은 장부 L1), C(다른 장부 L3)를 그대로 쓴다
-- 01 뒤에 같은 DB 에서 돈다. 결과는 tst.results 에 이어서 쌓이고 끝에서 이 파일의 것만 집계한다.

\set ON_ERROR_STOP on

create temp table inv_mark as select coalesce(max(seq), 0) as seq0 from tst.results;

-- ============================================================================
-- 픽스처 — 01 이 끝날 때 계정·장부를 지우는 검사가 있어 01 의 것을 재사용할 수 없다.
-- 여기서 새로 만든다. A·B 는 같은 장부 L1(B 는 구성원으로 합류), C 는 자기 장부 L3.
-- 키 이름은 01 과 같게 두어 아래 검사 본문이 그대로 읽는다.
-- ============================================================================
delete from tst.fix where k in ('A','B','C','L1','L3');
insert into auth.users (id, email, raw_user_meta_data) values
  ('a1a1a1a1-0000-4000-8000-000000000011', 'inv-a@example.com', '{"name":"초대A"}'),
  ('b1b1b1b1-0000-4000-8000-000000000012', 'inv-b@example.com', '{"name":"초대B"}'),
  ('c1c1c1c1-0000-4000-8000-000000000013', 'inv-c@example.com', '{"name":"초대C"}');
insert into tst.fix(k, v)
select 'A', 'a1a1a1a1-0000-4000-8000-000000000011'::uuid
union all select 'B', 'b1b1b1b1-0000-4000-8000-000000000012'
union all select 'C', 'c1c1c1c1-0000-4000-8000-000000000013';
insert into tst.fix(k, v) select 'L1', ledger_id from public.ledger_members where user_id = 'a1a1a1a1-0000-4000-8000-000000000011';
insert into tst.fix(k, v) select 'L3', ledger_id from public.ledger_members where user_id = 'c1c1c1c1-0000-4000-8000-000000000013';
-- B 를 A 의 장부에 구성원으로 넣는다(초대 코드 흐름은 01 이 검증했다). B 의 빈 개인 장부는 지운다.
delete from public.ledgers where id = (select ledger_id from public.ledger_members where user_id = 'b1b1b1b1-0000-4000-8000-000000000012');
insert into public.ledger_members (ledger_id, user_id, role, display_name)
values ((select v from tst.fix where k = 'L1'), 'b1b1b1b1-0000-4000-8000-000000000012', 'member', '초대B');

insert into public.events (id, ledger_id, type, is_mine, title, date)
values ('e1e1e1e1-0000-4000-8000-00000000a001', (select v from tst.fix where k = 'L1'), 'wedding', true,  '우리 결혼식', '2027-05-01'),
       ('e1e1e1e1-0000-4000-8000-00000000a002', (select v from tst.fix where k = 'L1'), 'funeral', true,  '아버지 장례', '2026-11-01'),
       ('e1e1e1e1-0000-4000-8000-00000000a003', (select v from tst.fix where k = 'L1'), 'wedding', true,  '동생 결혼식(두 번째 발행 시도용)', '2027-06-01'),
       ('e1e1e1e1-0000-4000-8000-00000000c001', (select v from tst.fix where k = 'L3'), 'wedding', true,  'C 의 결혼식', '2027-05-01');

-- 남의 결혼식(당사자 필요). 사람 하나 만들어 붙인다.
insert into public.people (id, ledger_id, name)
values ('91919191-0000-4000-8000-00000000a001', (select v from tst.fix where k = 'L1'), '김하객');
insert into public.events (id, ledger_id, type, is_mine, host_person_id, title, date)
values ('e1e1e1e1-0000-4000-8000-00000000a004', (select v from tst.fix where k = 'L1'), 'wedding', false,
        '91919191-0000-4000-8000-00000000a001', '김하객 결혼식', '2027-03-01');

-- ============================================================================
-- 1. 만들기 — 누가, 어떤 행사에
-- ============================================================================
do $$
declare r record; v_slug text;
begin
  -- A 가 자기 장부의 내 결혼식에 청첩장을 만든다
  select * into r from tst.run_as((select v from tst.fix where k = 'A'), format($q$
    insert into public.invitations (id, ledger_id, event_id, kind, content)
    values ('11111111-0000-4000-8000-000000000001', %L, 'e1e1e1e1-0000-4000-8000-00000000a001', 'wedding',
            '{"groom":"김철수","bride":"이영희"}')
  $q$, (select v from tst.fix where k = 'L1')));
  if r.err is null and r.affected = 1 then perform tst.pass('만들기: A 가 내 결혼식에 청첩장');
  else perform tst.fail('만들기: A 가 내 결혼식에 청첩장', coalesce(r.err, 'affected=' || r.affected)); end if;

  -- slug 가 10자 base62 로 자동 생성됐다
  select slug into v_slug from public.invitations where id = '11111111-0000-4000-8000-000000000001';
  if v_slug ~ '^[A-Za-z0-9]{10}$' then perform tst.pass('만들기: slug 10자 자동 생성');
  else perform tst.fail('만들기: slug 10자 자동 생성', coalesce(v_slug, 'null')); end if;
  insert into tst.val(k, v) values ('slug1', v_slug);

  -- 같은 행사에 둘은 안 된다
  select * into r from tst.run_as((select v from tst.fix where k = 'A'), format($q$
    insert into public.invitations (ledger_id, event_id, kind) values (%L, 'e1e1e1e1-0000-4000-8000-00000000a001', 'wedding')
  $q$, (select v from tst.fix where k = 'L1')));
  if r.err like '23505%' then perform tst.pass('만들기: 행사 하나에 청첩장 하나');
  else perform tst.fail('만들기: 행사 하나에 청첩장 하나', coalesce(r.err, '통과됨')); end if;

  -- 남의 결혼식에는 못 만든다
  select * into r from tst.run_as((select v from tst.fix where k = 'A'), format($q$
    insert into public.invitations (ledger_id, event_id, kind) values (%L, 'e1e1e1e1-0000-4000-8000-00000000a004', 'wedding')
  $q$, (select v from tst.fix where k = 'L1')));
  if r.err like '%event_not_mine%' then perform tst.pass('만들기: 남의 행사는 거부');
  else perform tst.fail('만들기: 남의 행사는 거부', coalesce(r.err, '통과됨')); end if;

  -- 종류가 행사와 다르면 못 만든다 (장례식에 청첩장)
  select * into r from tst.run_as((select v from tst.fix where k = 'A'), format($q$
    insert into public.invitations (ledger_id, event_id, kind) values (%L, 'e1e1e1e1-0000-4000-8000-00000000a002', 'wedding')
  $q$, (select v from tst.fix where k = 'L1')));
  if r.err like '%kind_mismatch%' then perform tst.pass('만들기: 장례식에 청첩장은 거부');
  else perform tst.fail('만들기: 장례식에 청첩장은 거부', coalesce(r.err, '통과됨')); end if;

  -- C 의 행사를 A 의 장부로 끌어오지 못한다
  select * into r from tst.run_as((select v from tst.fix where k = 'A'), format($q$
    insert into public.invitations (ledger_id, event_id, kind) values (%L, 'e1e1e1e1-0000-4000-8000-00000000c001', 'wedding')
  $q$, (select v from tst.fix where k = 'L1')));
  -- RLS 가 남의 행사를 숨기므로 트리거에는 '없음'으로 보인다. 어느 쪽이든 거부다.
  if r.err like '%event_in_other_ledger%' or r.err like '%event_not_found%' then perform tst.pass('만들기: 다른 장부 행사는 거부');
  else perform tst.fail('만들기: 다른 장부 행사는 거부', coalesce(r.err, '통과됨')); end if;

  -- A 가 C 의 장부에 넣는 것은 RLS 가 막는다
  select * into r from tst.run_as((select v from tst.fix where k = 'A'), format($q$
    insert into public.invitations (ledger_id, event_id, kind) values (%L, 'e1e1e1e1-0000-4000-8000-00000000c001', 'wedding')
  $q$, (select v from tst.fix where k = 'L3')));
  -- BEFORE 트리거가 정책 검사보다 먼저 돈다. 행사가 안 보여 '없음'으로 막히거나 정책이 막거나.
  if r.err like '42501%' or r.err like '%event_not_found%' then perform tst.pass('만들기: 남의 장부에는 RLS 거부');
  else perform tst.fail('만들기: 남의 장부에는 RLS 거부', coalesce(r.err, '통과됨')); end if;
end $$;

-- ============================================================================
-- 2. 읽기·고치기 — 구성원과 바깥
-- ============================================================================
do $$
declare n text; r record;
begin
  n := (tst.scalar_as((select v from tst.fix where k = 'B'),
    $q$ select count(*)::text from public.invitations where id = '11111111-0000-4000-8000-000000000001' $q$)).val;
  if n = '1' then perform tst.pass('읽기: 같은 장부 B 는 본다'); else perform tst.fail('읽기: 같은 장부 B 는 본다', n); end if;

  n := (tst.scalar_as((select v from tst.fix where k = 'C'),
    $q$ select count(*)::text from public.invitations where id = '11111111-0000-4000-8000-000000000001' $q$)).val;
  if n = '0' then perform tst.pass('읽기: 다른 장부 C 는 못 본다'); else perform tst.fail('읽기: 다른 장부 C 는 못 본다', n); end if;

  select * into r from tst.run_as(null, $q$ select count(*) from public.invitations $q$);
  if r.err like '42501%' then perform tst.pass('읽기: anon 은 테이블 권한 없음');
  else perform tst.fail('읽기: anon 은 테이블 권한 없음', coalesce(r.err, '통과됨')); end if;

  -- B 가 내용을 고친다(부부 공동)
  select * into r from tst.run_as((select v from tst.fix where k = 'B'), $q$
    update public.invitations set content = '{"groom":"김철수","bride":"이영희","greeting":"와 주세요"}'
     where id = '11111111-0000-4000-8000-000000000001' $q$);
  if r.err is null and r.affected = 1 then perform tst.pass('고치기: 같은 장부 B 가 내용 수정');
  else perform tst.fail('고치기: 같은 장부 B 가 내용 수정', coalesce(r.err, 'affected=' || r.affected)); end if;

  -- 발행 상태·만료는 직접 못 바꾼다
  select * into r from tst.run_as((select v from tst.fix where k = 'A'), $q$
    update public.invitations set status = 'published', published_at = now(), expires_at = now() + interval '1 year'
     where id = '11111111-0000-4000-8000-000000000001' $q$);
  if r.err like '%rpc_only_column%' then perform tst.pass('고치기: 발행 열은 직접 수정 거부');
  else perform tst.fail('고치기: 발행 열은 직접 수정 거부', coalesce(r.err, '통과됨')); end if;

  select * into r from tst.run_as((select v from tst.fix where k = 'A'), $q$
    update public.invitations set plan = 'premium' where id = '11111111-0000-4000-8000-000000000001' $q$);
  if r.err like '%rpc_only_column%' then perform tst.pass('고치기: 요금제는 직접 수정 거부');
  else perform tst.fail('고치기: 요금제는 직접 수정 거부', coalesce(r.err, '통과됨')); end if;
end $$;

-- ============================================================================
-- 3. 공개 읽기 — 발행 전·후, 조회수, 내리기
-- ============================================================================
do $$
declare n text; r record; v_slug text;
begin
  v_slug := (select v from tst.val where k = 'slug1');

  n := (tst.scalar_as(null, format($q$ select count(*)::text from public.public_invitation(%L) $q$, v_slug))).val;
  if n = '0' then perform tst.pass('공개: 초안은 anon 에게 안 보임'); else perform tst.fail('공개: 초안은 anon 에게 안 보임', n); end if;

  -- 발행 — C 는 못 한다
  select * into r from tst.run_as((select v from tst.fix where k = 'C'),
    $q$ select public.publish_invitation('11111111-0000-4000-8000-000000000001', 3) $q$);
  if r.err like '%not_member%' then perform tst.pass('발행: 다른 장부 C 는 거부');
  else perform tst.fail('발행: 다른 장부 C 는 거부', coalesce(r.err, '통과됨')); end if;

  -- 무료는 4개월 안 된다
  select * into r from tst.run_as((select v from tst.fix where k = 'A'),
    $q$ select public.publish_invitation('11111111-0000-4000-8000-000000000001', 4) $q$);
  if r.err like '%months_out_of_range%' then perform tst.pass('발행: 무료 4개월은 거부');
  else perform tst.fail('발행: 무료 4개월은 거부', coalesce(r.err, '통과됨')); end if;

  -- A 가 3개월 발행
  select * into r from tst.run_as((select v from tst.fix where k = 'A'),
    $q$ select public.publish_invitation('11111111-0000-4000-8000-000000000001', 3) $q$);
  if r.err is null then perform tst.pass('발행: A 가 3개월 발행');
  else perform tst.fail('발행: A 가 3개월 발행', r.err); end if;

  n := (tst.scalar_as(null, format($q$ select content->>'bride' from public.public_invitation(%L) $q$, v_slug))).val;
  if n = '이영희' then perform tst.pass('공개: 발행 뒤 anon 이 내용을 본다'); else perform tst.fail('공개: 발행 뒤 anon 이 내용을 본다', coalesce(n,'null')); end if;

  -- 조회수
  select * into r from tst.run_as(null, format($q$ select public.record_invitation_view(%L) $q$, v_slug));
  select * into r from tst.run_as(null, format($q$ select public.record_invitation_view(%L) $q$, v_slug));
  n := (select view_count::text from public.invitations where id = '11111111-0000-4000-8000-000000000001');
  if n = '2' then perform tst.pass('공개: 조회수가 오른다'); else perform tst.fail('공개: 조회수가 오른다', n); end if;

  -- 무료는 동시 발행 1건 — 두 번째 청첩장은 발행 거부
  select * into r from tst.run_as((select v from tst.fix where k = 'A'), format($q$
    insert into public.invitations (id, ledger_id, event_id, kind, content)
    values ('11111111-0000-4000-8000-000000000003', %L, 'e1e1e1e1-0000-4000-8000-00000000a003', 'wedding', '{"groom":"x"}')
  $q$, (select v from tst.fix where k = 'L1')));
  select * into r from tst.run_as((select v from tst.fix where k = 'A'),
    $q$ select public.publish_invitation('11111111-0000-4000-8000-000000000003', 1) $q$);
  if r.err like '%free_plan_limit%' then perform tst.pass('발행: 무료 동시 발행 1건');
  else perform tst.fail('발행: 무료 동시 발행 1건', coalesce(r.err, '통과됨')); end if;

  -- 빈 내용은 발행 못 한다 (부고장 초안)
  select * into r from tst.run_as((select v from tst.fix where k = 'A'), format($q$
    insert into public.invitations (id, ledger_id, event_id, kind)
    values ('11111111-0000-4000-8000-000000000002', %L, 'e1e1e1e1-0000-4000-8000-00000000a002', 'funeral')
  $q$, (select v from tst.fix where k = 'L1')));
  select * into r from tst.run_as((select v from tst.fix where k = 'A'),
    $q$ select public.publish_invitation('11111111-0000-4000-8000-000000000002', 1) $q$);
  if r.err like '%empty_content%' then perform tst.pass('발행: 빈 내용은 거부');
  else perform tst.fail('발행: 빈 내용은 거부', coalesce(r.err, '통과됨')); end if;

  -- 내리기 → anon 에게 사라진다
  select * into r from tst.run_as((select v from tst.fix where k = 'B'),
    $q$ select public.unpublish_invitation('11111111-0000-4000-8000-000000000001') $q$);
  n := (tst.scalar_as(null, format($q$ select count(*)::text from public.public_invitation(%L) $q$, v_slug))).val;
  if r.err is null and n = '0' then perform tst.pass('내리기: B 가 내리면 anon 에게 사라짐');
  else perform tst.fail('내리기: B 가 내리면 anon 에게 사라짐', coalesce(r.err, 'count=' || n)); end if;

  -- 내린 뒤 두 번째를 발행할 수 있다 (동시 발행 1건 규칙은 '발행 중'만 센다)
  select * into r from tst.run_as((select v from tst.fix where k = 'A'),
    $q$ select public.publish_invitation('11111111-0000-4000-8000-000000000003', 1) $q$);
  if r.err is null then perform tst.pass('발행: 내린 뒤에는 다른 것을 발행 가능');
  else perform tst.fail('발행: 내린 뒤에는 다른 것을 발행 가능', r.err); end if;
end $$;

-- ============================================================================
-- 4. 만료 — 서비스 역할만, 지난 것만
-- ============================================================================
do $$
declare r record; n text; v_slug3 text;
begin
  select * into r from tst.run_as((select v from tst.fix where k = 'A'), $q$ select public.expire_invitations() $q$);
  if r.err like '42501%' then perform tst.pass('만료: 사용자 역할은 못 부름');
  else perform tst.fail('만료: 사용자 역할은 못 부름', coalesce(r.err, '통과됨')); end if;

  -- 만료 시각을 과거로 (소유자 권한으로 직접, 내부 플래그를 켜고)
  perform set_config('ppurin.internal', '1', true);
  -- 만료 > 발행 제약이 있으므로 발행 시각도 같이 과거로 옮긴다
  update public.invitations set published_at = now() - interval '2 days', expires_at = now() - interval '1 day'
   where id = '11111111-0000-4000-8000-000000000003';
  perform set_config('ppurin.internal', '', true);

  v_slug3 := (select slug from public.invitations where id = '11111111-0000-4000-8000-000000000003');
  n := (tst.scalar_as(null, format($q$ select count(*)::text from public.public_invitation(%L) $q$, v_slug3))).val;
  if n = '0' then perform tst.pass('만료: 시각이 지나면 상태와 무관하게 안 보임'); else perform tst.fail('만료: 시각이 지나면 상태와 무관하게 안 보임', n); end if;

  n := public.expire_invitations()::text;
  if n = '1' then perform tst.pass('만료: 집행 함수가 지난 것 1건을 바꿈'); else perform tst.fail('만료: 집행 함수가 지난 것 1건을 바꿈', n); end if;

  n := (select status from public.invitations where id = '11111111-0000-4000-8000-000000000003');
  if n = 'expired' then perform tst.pass('만료: 상태가 expired'); else perform tst.fail('만료: 상태가 expired', n); end if;
end $$;

-- ============================================================================
-- 5. 권한 짝
-- ============================================================================
do $$
declare r record;
begin
  select * into r from tst.run_as(null, $q$ select public.publish_invitation('11111111-0000-4000-8000-000000000001', 1) $q$);
  if r.err like '42501%' then perform tst.pass('권한: anon 은 publish 못 부름');
  else perform tst.fail('권한: anon 은 publish 못 부름', coalesce(r.err, '통과됨')); end if;
end $$;

-- ============================================================================
-- 결과 요약 (이 파일 분만)
-- ============================================================================
\echo ''
\echo '================ 청첩장 — 실패한 검사 ================'
select seq, name, detail from tst.results where not ok and seq > (select seq0 from inv_mark) order by seq;

\echo ''
\echo '================ 청첩장 — 요약 ================'
select count(*) filter (where ok)     as "통과",
       count(*) filter (where not ok) as "실패",
       count(*)                       as "전체"
  from tst.results where seq > (select seq0 from inv_mark);

do $$
declare n int;
begin
  select count(*) into n from tst.results where not ok and seq > (select seq0 from inv_mark);
  if n > 0 then
    raise exception '청첩장 검증 실패 %건', n;
  end if;
end $$;
