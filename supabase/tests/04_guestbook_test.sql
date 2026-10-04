-- 방명록(0015) 검증 — 하객은 함수로만 쓰고 읽고, 공개 중일 때만 되고, 주인만 숨기고 지운다
-- 02 뒤에 같은 DB 에서 돈다. 02 의 계정 A·B(장부 L1)·C(장부 L3)와 A 의 부고장 초안(…0002)을 쓴다.

\set ON_ERROR_STOP on

create temp table gb_mark as select coalesce(max(seq), 0) as seq0 from tst.results;

do $$
declare r record; n text; v_slug text; v_id text;
begin
  v_slug := (select slug from public.invitations where id = '11111111-0000-4000-8000-000000000002');

  -- 0. 발행 전에는 못 남긴다
  select * into r from tst.run_as(null, format($q$ select public.add_guestbook_message(%L, '하객', '축하해요') $q$, v_slug));
  if r.err like '%invitation_not_open%' then perform tst.pass('방명록: 발행 전에는 거부');
  else perform tst.fail('방명록: 발행 전에는 거부', coalesce(r.err, '통과됨')); end if;

  -- A 가 내용을 채우고 발행한다 (02 가 다른 초대장을 내려 두어 무료 1건 규칙에 걸리지 않는다)
  select * into r from tst.run_as((select v from tst.fix where k = 'A'), $q$
    update public.invitations set content = '{"deceased":{"name":"김영수"},"chiefMourners":[{"relation":"아들","name":"김철수"}],"mortuary":{"name":"서울병원"},"funeralAt":"2026-11-03 08:00"}'
     where id = '11111111-0000-4000-8000-000000000002' $q$);
  select * into r from tst.run_as((select v from tst.fix where k = 'A'), $q$ select public.publish_invitation('11111111-0000-4000-8000-000000000002', 1) $q$);
  if r.err is null then perform tst.pass('방명록 준비: 부고장 발행'); else perform tst.fail('방명록 준비: 부고장 발행', r.err); end if;

  -- 1. anon 이 남긴다
  v_id := (tst.scalar_as(null, format($q$ select public.add_guestbook_message(%L, '  김하객 ', ' 삼가 고인의 명복을 빕니다. ') $q$, v_slug))).val;
  if v_id is not null then perform tst.pass('방명록: anon 이 남긴다'); else perform tst.fail('방명록: anon 이 남긴다', 'null'); end if;
  n := (select name || '|' || message from public.guestbook_entries where id = v_id::uuid);
  if n = '김하객|삼가 고인의 명복을 빕니다.' then perform tst.pass('방명록: 앞뒤 공백을 떼고 저장'); else perform tst.fail('방명록: 앞뒤 공백을 떼고 저장', n); end if;

  -- 2. 빈 이름·너무 긴 메시지 거부
  select * into r from tst.run_as(null, format($q$ select public.add_guestbook_message(%L, '   ', '안녕') $q$, v_slug));
  if r.err like '%bad_name%' then perform tst.pass('방명록: 빈 이름 거부'); else perform tst.fail('방명록: 빈 이름 거부', coalesce(r.err, '통과됨')); end if;
  select * into r from tst.run_as(null, format($q$ select public.add_guestbook_message(%L, '김', repeat('가', 201)) $q$, v_slug));
  if r.err like '%bad_message%' then perform tst.pass('방명록: 201자 메시지 거부'); else perform tst.fail('방명록: 201자 메시지 거부', coalesce(r.err, '통과됨')); end if;

  -- 3. anon 이 읽는다 — 숨긴 것은 빠진다
  perform tst.scalar_as(null, format($q$ select public.add_guestbook_message(%L, '이하객', '힘내세요') $q$, v_slug));
  n := (tst.scalar_as(null, format($q$ select count(*)::text from public.public_guestbook(%L) $q$, v_slug))).val;
  if n = '2' then perform tst.pass('방명록: anon 이 2개를 읽는다'); else perform tst.fail('방명록: anon 이 2개를 읽는다', n); end if;

  select * into r from tst.run_as((select v from tst.fix where k = 'B'), format($q$ update public.guestbook_entries set hidden = true where id = %L $q$, v_id));
  if r.err is null and r.affected = 1 then perform tst.pass('방명록: 같은 장부 B 가 숨긴다'); else perform tst.fail('방명록: 같은 장부 B 가 숨긴다', coalesce(r.err, 'affected=' || r.affected)); end if;
  n := (tst.scalar_as(null, format($q$ select count(*)::text from public.public_guestbook(%L) $q$, v_slug))).val;
  if n = '1' then perform tst.pass('방명록: 숨긴 것은 공개에서 빠진다'); else perform tst.fail('방명록: 숨긴 것은 공개에서 빠진다', n); end if;

  -- 4. 테이블 직접 접근 — anon 없음, C 는 0건, A 는 2건
  select * into r from tst.run_as(null, $q$ select count(*) from public.guestbook_entries $q$);
  if r.err like '42501%' then perform tst.pass('방명록: anon 테이블 권한 없음'); else perform tst.fail('방명록: anon 테이블 권한 없음', coalesce(r.err, '통과됨')); end if;
  n := (tst.scalar_as((select v from tst.fix where k = 'C'), $q$ select count(*)::text from public.guestbook_entries $q$)).val;
  if n = '0' then perform tst.pass('방명록: 다른 장부 C 는 0건'); else perform tst.fail('방명록: 다른 장부 C 는 0건', n); end if;
  n := (tst.scalar_as((select v from tst.fix where k = 'A'), $q$ select count(*)::text from public.guestbook_entries $q$)).val;
  if n = '2' then perform tst.pass('방명록: 주인 A 는 숨긴 것까지 2건'); else perform tst.fail('방명록: 주인 A 는 2건', n); end if;

  -- 5. 주인이 지운다 / C 는 못 지운다
  select * into r from tst.run_as((select v from tst.fix where k = 'C'), format($q$ delete from public.guestbook_entries where id = %L $q$, v_id));
  if r.err is null and r.affected = 0 then perform tst.pass('방명록: C 의 삭제는 0건'); else perform tst.fail('방명록: C 의 삭제는 0건', coalesce(r.err, 'affected=' || r.affected)); end if;
  select * into r from tst.run_as((select v from tst.fix where k = 'A'), format($q$ delete from public.guestbook_entries where id = %L $q$, v_id));
  if r.err is null and r.affected = 1 then perform tst.pass('방명록: 주인 A 가 지운다'); else perform tst.fail('방명록: 주인 A 가 지운다', coalesce(r.err, 'affected=' || r.affected)); end if;

  -- 6. 내리면 읽기도 쓰기도 멈춘다
  select * into r from tst.run_as((select v from tst.fix where k = 'A'), $q$ select public.unpublish_invitation('11111111-0000-4000-8000-000000000002') $q$);
  n := (tst.scalar_as(null, format($q$ select count(*)::text from public.public_guestbook(%L) $q$, v_slug))).val;
  if n = '0' then perform tst.pass('방명록: 내리면 공개 읽기 0건'); else perform tst.fail('방명록: 내리면 공개 읽기 0건', n); end if;
  select * into r from tst.run_as(null, format($q$ select public.add_guestbook_message(%L, '늦은하객', '늦었네요') $q$, v_slug));
  if r.err like '%invitation_not_open%' then perform tst.pass('방명록: 내리면 쓰기 거부'); else perform tst.fail('방명록: 내리면 쓰기 거부', coalesce(r.err, '통과됨')); end if;
end $$;

\echo ''
\echo '================ 방명록 — 실패한 검사 ================'
select seq, name, detail from tst.results where not ok and seq > (select seq0 from gb_mark) order by seq;
\echo ''
\echo '================ 방명록 — 요약 ================'
select count(*) filter (where ok) as "통과", count(*) filter (where not ok) as "실패", count(*) as "전체"
  from tst.results where seq > (select seq0 from gb_mark);
do $$
declare n int;
begin
  select count(*) into n from tst.results where not ok and seq > (select seq0 from gb_mark);
  if n > 0 then raise exception '방명록 검증 실패 %건', n; end if;
end $$;
