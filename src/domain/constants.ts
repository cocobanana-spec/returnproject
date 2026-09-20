// 행사 종류·관계 그룹·부조 형태의 코드값과 한국어 라벨. DB의 CHECK 제약과 같은 집합이어야 한다
export const EVENT_TYPES = [
  'wedding',
  'first_birthday',
  'funeral',
  'senior_birthday',
  'opening',
  'other',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  wedding: '결혼식',
  first_birthday: '돌잔치',
  funeral: '장례식',
  senior_birthday: '회갑·칠순',
  opening: '개업',
  other: '기타',
};

export const RELATION_GROUPS = [
  'family',
  'relative',
  'work',
  'friend',
  'acquaintance',
  'other',
] as const;
export type RelationGroup = (typeof RELATION_GROUPS)[number];

export const RELATION_GROUP_LABEL: Record<RelationGroup, string> = {
  family: '가족',
  relative: '친척',
  work: '직장',
  friend: '친구',
  acquaintance: '지인',
  other: '기타',
};

export const METHODS = ['cash', 'transfer', 'wreath', 'gift', 'none'] as const;
export type Method = (typeof METHODS)[number];

export const METHOD_LABEL: Record<Method, string> = {
  cash: '현금',
  transfer: '계좌이체',
  wreath: '화환·조화',
  gift: '선물',
  none: '없음',
};

export const DATE_PRECISIONS = ['day', 'month', 'year'] as const;
export type DatePrecision = (typeof DATE_PRECISIONS)[number];

export const PERSON_KINDS = ['person', 'group'] as const;
export type PersonKind = (typeof PERSON_KINDS)[number];

export type Side = 'a' | 'b';
