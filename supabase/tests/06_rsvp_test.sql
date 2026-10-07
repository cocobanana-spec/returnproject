-- 참석 여부(0017) 검증 — 하객은 함수로만 쓰고, 공개 중인 청첩장에만 되고, 주인만 읽고 지운다
-- 02 뒤에 같은 DB 에서 돈다. 02 의 A(장부 L1)·C(장부 L3)와 A 의 청첩장(…0001)을 쓴다. 04 가 부고장을 내려 두었다.

\set ON_ERROR_STOP on

create temp table rv_mark as select coalesce(max(seq), 0) as seq0 from tst.results;

do $$
declare r record; n text; v_slug text; v_fslug text; v_id text;
begin
  v_slug := (select slug from public.invitations where id = '11111111-0000-4000-8000-000000000001');
  v_fslug := (select slug from public.invitations where id = '11111111-0000-4000-8000-000000000002');

  -- 0. 내려가 있으면 거부
  select * into r from tst.run_as(null, format($q$ select public.submit_rsvp(%L, 'groom', '하객', true, 2, 'yes', null) $q$, v_slug));
  if r.err like '%invitation_not_open%' then perform tst.pass('참석: 내려간 청첩장은 거부'); else perform tst.fail('참석: 내려간 청첩장은 거부', coalesce(r.err, '통과됨')); end if;

  select * into r from tst.run_as((select v from tst.fix where k = 'A'), $q$ select public.publish_invitation('11111111-0000-4000-8000-000000000001', 1) $q$);
  if r.err is null then perform tst.pass('참석 준비: 청첩장 발행'); else perform tst.fail('참석 준비: 청첩장 발행', r.err); end if;

  -- 1. anon 이 남긴다 — 앞뒤 공백 정리
  v_id := (tst.scalar_as(null, format($q$ select public.submit_rsvp(%L, 'groom', '  김하객 ', true, 2, 'yes', ' 축하해요 ') $q$, v_slug))).val;
  n := (select name || '|' || party_size || '|' || meal || '|' || message from public.rsvp_responses where id = v_id::uuid);
  if n = '김하객|2|yes|축하해요' then perform tst.pass('참석: anon 이 남기고 공백을 뗀다'); else perform tst.fail('참석: anon 이 남긴다', coalesce(n, 'null')); end if;

  -- 2. 불참이면 인원 0·식사 비움
  v_id := (tst.scalar_as(null, format($q$ select public.submit_rsvp(%L, 'bride', '이하객', false, 5, 'yes', null) $q$, v_slug))).val;
  n := (select party_size || '|' || coalesce(meal, '-') from public.rsvp_responses where id = v_id::uuid);
  if n = '0|-' then perform tst.pass('참석: 불참이면 인원 0·식사 없음'); else perform tst.fail('참석: 불참 정리', coalesce(n, 'null')); end if;

  -- 3. 잘못된 값 거부
  select * into r from tst.run_as(null, format($q$ select public.submit_rsvp(%L, 'x', '김', true, 1, null, null) $q$, v_slug));
  if r.err like '%bad_side%' then perform tst.pass('참석: 측 값 검사'); else perform tst.fail('참석: 측 값 검사', coalesce(r.err, '통과됨')); end if;
  select * into r from tst.run_as(null, format($q$ select public.submit_rsvp(%L, 'groom', '   ', true, 1, null, null) $q$, v_slug));
  if r.err like '%bad_name%' then perform tst.pass('참석: 빈 이름 거부'); else perform tst.fail('참석: 빈 이름 거부', coalesce(r.err, '통과됨')); end if;
  select * into r from tst.run_as(null, format($q$ select public.submit_rsvp(%L, 'groom', '김', true, 21, null, null) $q$, v_slug));
  if r.err like '%bad_party_size%' then perform tst.pass('참석: 인원 21명 거부'); else perform tst.fail('참석: 인원 상한', coalesce(r.err, '통과됨')); end if;

  -- 4. 부고장에는 없다
  select * into r from tst.run_as(null, format($q$ select public.submit_rsvp(%L, 'groom', '김', true, 1, null, null) $q$, v_fslug));
  if r.err like '%invitation_not_open%' then perform tst.pass('참석: 부고장은 거부'); else perform tst.fail('참석: 부고장은 거부', coalesce(r.err, '통과됨')); end if;

  -- 5. 읽기 — anon 은 테이블을 못 읽고, 주인 A 는 2건, 남 C 는 0건
  select * into r from tst.run_as(null, $q$ select count(*) from public.rsvp_responses $q$);
  if r.err like '42501%' then perform tst.pass('참석: anon 은 테이블을 못 읽는다'); else perform tst.fail('참석: anon 읽기 차단', coalesce(r.err, '통과됨')); end if;
  n := (tst.scalar_as((select v from tst.fix where k = 'A'), $q$ select count(*)::text from public.rsvp_responses $q$)).val;
  if n = '2' then perform tst.pass('참석: 주인이 2건을 본다'); else perform tst.fail('참석: 주인이 본다', n); end if;
  n := (tst.scalar_as((select v from tst.fix where k = 'C'), $q$ select count(*)::text from public.rsvp_responses $q$)).val;
  if n = '0' then perform tst.pass('참석: 다른 장부는 0건'); else perform tst.fail('참석: 다른 장부 0건', n); end if;

  -- 6. 주인이 지운다
  select * into r from tst.run_as((select v from tst.fix where k = 'A'), format($q$ delete from public.rsvp_responses where id = %L $q$, v_id));
  if r.err is null and r.affected = 1 then perform tst.pass('참석: 주인이 지운다'); else perform tst.fail('참석: 주인 삭제', coalesce(r.err, 'affected=' || r.affected)); end if;

  select * into r from tst.run_as((select v from tst.fix where k = 'A'), $q$ select public.unpublish_invitation('11111111-0000-4000-8000-000000000001') $q$);
end $$;

\echo ''
\echo '================ 참석 여부 — 실패한 검사 ================'
select seq, name, detail from tst.results where not ok and seq > (select seq0 from rv_mark) order by seq;
\echo ''
\echo '================ 참석 여부 — 요약 ================'
select count(*) filter (where ok) as "통과", count(*) filter (where not ok) as "실패", count(*) as "전체"
  from tst.results where seq > (select seq0 from rv_mark);
do $$
declare n int;
begin
  select count(*) into n from tst.results where not ok and seq > (select seq0 from rv_mark);
  if n > 0 then raise exception '참석 여부 검증 실패 %건', n; end if;
end $$;
