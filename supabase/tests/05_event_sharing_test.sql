-- 행사 공동 관리(0016) 검증 — 초대 코드, 합류, 보이는 범위, 명부 입력 권한, 나가기·내보내기
-- 02 뒤에 같은 DB 에서 돈다. 02 의 A(장부 L1 주인)·B(L1 구성원)·C(장부 L3)를 쓴다. 공동 관리자로 새 계정 G 를 만든다.

\set ON_ERROR_STOP on

create temp table es_mark as select coalesce(max(seq), 0) as seq0 from tst.results;

insert into auth.users (id, email, raw_user_meta_data)
values ('9e9e9e9e-0000-4000-8000-000000000021', 'guest-g@example.com', '{"name":"공동G"}');
delete from tst.fix where k = 'G';
insert into tst.fix(k, v) values ('G', '9e9e9e9e-0000-4000-8000-000000000021');

-- A 의 내 결혼식(…a001)에 기록 하나와 사람 하나가 이미 있다(02). 비교용으로 A 의 다른 행사(…a002, 장례식)도 있다.
insert into public.people (id, ledger_id, name) values ('91919191-0000-4000-8000-00000000a010', (select v from tst.fix where k = 'L1'), '결혼하객');
insert into public.entries (id, ledger_id, event_id, person_id, amount, method)
values ('e2e2e2e2-0000-4000-8000-00000000a010', (select v from tst.fix where k = 'L1'), 'e1e1e1e1-0000-4000-8000-00000000a001', '91919191-0000-4000-8000-00000000a010', 50000, 'cash');

do $$
declare r record; n text; v_code text; v_event text;
begin
  -- 1. 초대 코드 — 주인만, 내 행사만
  select * into r from tst.run_as((select v from tst.fix where k = 'C'), $q$ select public.create_event_invite('e1e1e1e1-0000-4000-8000-00000000a001') $q$);
  if r.err like '%not_owner%' then perform tst.pass('초대: 다른 장부 C 는 못 만든다'); else perform tst.fail('초대: 다른 장부 C 는 못 만든다', coalesce(r.err,'통과됨')); end if;
  select * into r from tst.run_as((select v from tst.fix where k = 'A'), $q$ select public.create_event_invite('e1e1e1e1-0000-4000-8000-00000000a004') $q$);
  if r.err like '%event_not_mine%' then perform tst.pass('초대: 남의 행사(준 돈)는 못 만든다'); else perform tst.fail('초대: 남의 행사는 못 만든다', coalesce(r.err,'통과됨')); end if;
  v_code := (tst.scalar_as((select v from tst.fix where k = 'B'), $q$ select public.create_event_invite('e1e1e1e1-0000-4000-8000-00000000a001') $q$)).val;
  if v_code ~ '^[A-Z0-9]{8}$' then perform tst.pass('초대: 장부 구성원 B 가 8자 코드를 만든다'); else perform tst.fail('초대: B 가 코드를 만든다', coalesce(v_code,'null')); end if;

  -- 2. 합류 — G 가 코드로 들어온다. 코드는 1회용
  v_event := (tst.scalar_as((select v from tst.fix where k = 'G'), format($q$ select public.join_event(%L)::text $q$, lower(' ' || v_code || ' ')))).val;
  if v_event = 'e1e1e1e1-0000-4000-8000-00000000a001' then perform tst.pass('합류: G 가 코드(소문자·공백 섞여도)로 합류'); else perform tst.fail('합류: G 가 합류', coalesce(v_event,'null')); end if;
  select * into r from tst.run_as((select v from tst.fix where k = 'C'), format($q$ select public.join_event(%L) $q$, v_code));
  if r.err like '%invalid_or_expired_code%' then perform tst.pass('합류: 쓴 코드는 다시 못 쓴다'); else perform tst.fail('합류: 코드 1회용', coalesce(r.err,'통과됨')); end if;
  v_code := (tst.scalar_as((select v from tst.fix where k = 'A'), $q$ select public.create_event_invite('e1e1e1e1-0000-4000-8000-00000000a001') $q$)).val;
  select * into r from tst.run_as((select v from tst.fix where k = 'B'), format($q$ select public.join_event(%L) $q$, v_code));
  if r.err like '%already_owner%' then perform tst.pass('합류: 주인(장부 구성원)은 합류 대상이 아니다'); else perform tst.fail('합류: 주인은 거부', coalesce(r.err,'통과됨')); end if;

  -- 3. 보이는 범위 — G 는 그 행사와 그 기록만. 다른 행사·초대장은 못 본다
  n := (tst.scalar_as((select v from tst.fix where k = 'G'), $q$ select count(*)::text from public.events $q$)).val;
  if n = '1' then perform tst.pass('범위: G 에게 행사 1건'); else perform tst.fail('범위: G 에게 행사 1건', n); end if;
  n := (tst.scalar_as((select v from tst.fix where k = 'G'), $q$ select count(*)::text from public.entries $q$)).val;
  if n = '1' then perform tst.pass('범위: G 에게 그 행사의 기록 1건'); else perform tst.fail('범위: G 에게 기록 1건', n); end if;
  n := (tst.scalar_as((select v from tst.fix where k = 'G'), $q$ select count(*)::text from public.invitations $q$)).val;
  if n = '0' then perform tst.pass('범위: G 는 초대장(청첩장)을 못 본다'); else perform tst.fail('범위: G 는 초대장을 못 본다', n); end if;
  n := (tst.scalar_as((select v from tst.fix where k = 'G'), $q$ select count(*)::text from public.list_shared_events() $q$)).val;
  if n = '1' then perform tst.pass('범위: 공동 행사 목록 함수 1건'); else perform tst.fail('범위: 공동 행사 목록 1건', n); end if;

  -- 4. 명부 입력 — G 가 사람을 만들고 기록을 넣는다(그 행사에만)
  select * into r from tst.run_as((select v from tst.fix where k = 'G'), format($q$
    insert into public.people (id, ledger_id, name) values ('91919191-0000-4000-8000-00000000a020', %L, 'G가추가') $q$, (select v from tst.fix where k = 'L1')));
  if r.err is null and r.affected = 1 then perform tst.pass('명부: G 가 주인 장부에 사람을 넣는다'); else perform tst.fail('명부: G 가 사람을 넣는다', coalesce(r.err,'affected='||r.affected)); end if;
  select * into r from tst.run_as((select v from tst.fix where k = 'G'), format($q$
    insert into public.entries (ledger_id, event_id, person_id, amount, method) values (%L, 'e1e1e1e1-0000-4000-8000-00000000a001', '91919191-0000-4000-8000-00000000a020', 100000, 'cash') $q$, (select v from tst.fix where k = 'L1')));
  if r.err is null and r.affected = 1 then perform tst.pass('명부: G 가 공동 행사에 기록을 넣는다'); else perform tst.fail('명부: G 가 기록을 넣는다', coalesce(r.err,'affected='||r.affected)); end if;
  select * into r from tst.run_as((select v from tst.fix where k = 'G'), format($q$
    insert into public.entries (ledger_id, event_id, person_id, amount, method) values (%L, 'e1e1e1e1-0000-4000-8000-00000000a002', '91919191-0000-4000-8000-00000000a020', 100000, 'cash') $q$, (select v from tst.fix where k = 'L1')));
  if r.err like '42501%' then perform tst.pass('명부: 다른 행사에는 못 넣는다'); else perform tst.fail('명부: 다른 행사에는 못 넣는다', coalesce(r.err,'통과됨')); end if;
  select * into r from tst.run_as((select v from tst.fix where k = 'G'), $q$ update public.people set name = '바꿈' where id = '91919191-0000-4000-8000-00000000a010' $q$);
  if r.err is null and r.affected = 0 then perform tst.pass('명부: G 는 사람 이름을 못 고친다(0건)'); else perform tst.fail('명부: G 는 사람을 못 고친다', coalesce(r.err,'affected='||r.affected)); end if;
  -- 주인 A 에게 G 의 기록이 보인다
  n := (tst.scalar_as((select v from tst.fix where k = 'A'), $q$ select count(*)::text from public.entries where event_id = 'e1e1e1e1-0000-4000-8000-00000000a001' $q$)).val;
  if n = '2' then perform tst.pass('명부: 주인에게 G 의 기록이 보인다(2건)'); else perform tst.fail('명부: 주인에게 2건', n); end if;

  -- 5. 구성원 목록·내보내기·나가기
  n := (tst.scalar_as((select v from tst.fix where k = 'A'), $q$ select count(*)::text from public.event_members where event_id = 'e1e1e1e1-0000-4000-8000-00000000a001' $q$)).val;
  if n = '1' then perform tst.pass('구성원: 주인이 목록을 본다'); else perform tst.fail('구성원: 주인이 목록을 본다', n); end if;
  select * into r from tst.run_as((select v from tst.fix where k = 'C'), $q$ select public.remove_event_member('e1e1e1e1-0000-4000-8000-00000000a001', '9e9e9e9e-0000-4000-8000-000000000021') $q$);
  if r.err like '%not_owner%' then perform tst.pass('구성원: 다른 장부 C 는 못 뺀다'); else perform tst.fail('구성원: C 는 못 뺀다', coalesce(r.err,'통과됨')); end if;
  select * into r from tst.run_as((select v from tst.fix where k = 'G'), $q$ select public.leave_event('e1e1e1e1-0000-4000-8000-00000000a001') $q$);
  n := (tst.scalar_as((select v from tst.fix where k = 'G'), $q$ select count(*)::text from public.events $q$)).val;
  if r.err is null and n = '0' then perform tst.pass('구성원: G 가 나가면 행사가 안 보인다'); else perform tst.fail('구성원: 나가기', coalesce(r.err,'count='||n)); end if;
  -- G 가 넣은 기록은 남는다
  n := (tst.scalar_as((select v from tst.fix where k = 'A'), $q$ select count(*)::text from public.entries where event_id = 'e1e1e1e1-0000-4000-8000-00000000a001' $q$)).val;
  if n = '2' then perform tst.pass('구성원: 나가도 넣은 기록은 주인에게 남는다'); else perform tst.fail('구성원: 기록 유지', n); end if;
end $$;

\echo ''
\echo '================ 행사 공동 관리 — 실패한 검사 ================'
select seq, name, detail from tst.results where not ok and seq > (select seq0 from es_mark) order by seq;
\echo ''
\echo '================ 행사 공동 관리 — 요약 ================'
select count(*) filter (where ok) as "통과", count(*) filter (where not ok) as "실패", count(*) as "전체"
  from tst.results where seq > (select seq0 from es_mark);
do $$
declare n int;
begin
  select count(*) into n from tst.results where not ok and seq > (select seq0 from es_mark);
  if n > 0 then raise exception '행사 공동 관리 검증 실패 %건', n; end if;
end $$;
