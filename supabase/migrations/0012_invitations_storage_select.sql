-- 초대장 사진 버킷에 구성원 읽기 정책을 더한다 — 덮어쓰기(upsert) 업로드가 RLS 로 막히던 것 (2026-10-04)
--
-- 증상: 앱에서 사진을 올리면 "new row violates row-level security policy". 1.3MB 짜리 보통 사진이었다.
-- 재현: 같은 경로를 x-upsert 없이 올리면 200, x-upsert: true 로 올리면 403. 서비스 역할은 둘 다 200.
-- 원인: 0009 는 insert·update·delete 정책만 두고 select 를 안 두었다. 버킷이 public 이라 URL 로 읽는 데는
--       필요 없지만, 스토리지 서버의 upsert 는 기존 객체를 **먼저 조회**하므로 호출자(authenticated)에게
--       select 가 없으면 그 자리에서 거부된다. 'new row' 라는 문구가 insert 쪽을 가리켜 헷갈리게 한다.
-- 조치: 자기 장부 폴더에 한해 select 를 연다. 앱은 파일 이름에 시각이 들어가 겹칠 일이 없으므로
--       upsert 옵션도 뺀다(이중 안전).
do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage 스키마가 없어 정책을 건너뛴다(로컬 검증)';
    return;
  end if;
  execute $p$
    create policy invitations_objects_select on storage.objects
      for select to authenticated
      using (bucket_id = 'invitations'
             and public.is_ledger_member(((storage.foldername(name))[1])::uuid))
  $p$;
end $$;
