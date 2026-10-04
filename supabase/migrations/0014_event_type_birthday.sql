-- 경조사 종류에 '생일(birthday)'을 더한다 — 1차 피드백 A6 (2026-10-04)
--
-- 생일 목록을 관리하는 것이 아니다. 생일에 주고받은 돈을 다른 종류와 같은 자리에 기록하기 위한 값이다.
-- 앱의 EVENT_TYPES(src/domain/constants.ts)와 같은 집합이어야 한다.
alter table public.events drop constraint events_type_check;
alter table public.events add constraint events_type_check
  check (type in ('wedding','first_birthday','funeral','senior_birthday','birthday','opening','other'));
