-- 청첩장 만료 집행을 하루 한 번 돌린다 — pg_cron 으로 DB 안에서 (docs/08 §3.2 의 '엣지 함수' 대신)
--
-- 엣지 함수 + 외부 스케줄러보다 pg_cron 이 낫다. 부품이 하나 줄고(배포·비밀 키·로그가 없다),
-- 집행 함수(expire_invitations, SECURITY DEFINER)가 이미 DB 에 있어 그대로 부르면 된다.
-- 매일 00:05 UTC = 09:05 KST. 만료는 '그날 자정'이 아니라 발행 시각 + N개월이라 분 단위가 중요하지 않다.
--
-- 로컬 검증 Postgres 에는 pg_cron 이 없다. 있을 때만 건다(실제 Supabase 에는 있다).
-- 같은 이름의 작업이 있으면 먼저 지우고 다시 건다 — 마이그레이션을 두 번 돌려도 작업이 둘이 되지 않는다.
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron 이 없어 만료 스케줄을 건너뛴다(로컬 검증)';
    return;
  end if;
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.unschedule(jobid) from cron.job where jobname = 'expire-invitations';
  perform cron.schedule('expire-invitations', '5 0 * * *', 'select public.expire_invitations()');
end $$;
