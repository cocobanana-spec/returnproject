-- 초대장 사진 버킷 한도를 5MB → 20MB 로 (2026-10-04)
--
-- 증상: "The object exceeded the maximum allowed size". 사진첩에서는 1.3MB(HEIC)인 사진인데,
-- 앱(빌드 22)이 고른 사진을 JPEG 로 다시 저장해 올리면서 4~6MB 가 되어 5MB 한도에 걸렸다.
-- 빌드 23 부터는 올리기 전에 긴 변 1600px 로 줄여 1MB 안쪽이 되지만(src/domain/photo.ts),
-- 그 전까지 쓰는 사람이 막히지 않게 한도를 올린다. 줄이기가 자리 잡은 뒤에도 20MB 면 넉넉하다.
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage 스키마가 없어 건너뛴다(로컬 검증)';
    return;
  end if;
  update storage.buckets set file_size_limit = 20971520 where id = 'invitations';
end $$;
