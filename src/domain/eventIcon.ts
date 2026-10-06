// 행사 종류별 아이콘 — 목록 행의 원형 아이콘에 쓴다(docs/DESIGN.md ListRow). Ionicons 이름
import type { EventType } from './constants.ts';

export type EventIconName = 'heart' | 'gift' | 'flower' | 'ribbon' | 'balloon' | 'storefront' | 'ellipsis-horizontal';

const ICON: Record<EventType, EventIconName> = {
  wedding: 'heart',
  first_birthday: 'gift',
  funeral: 'flower',
  senior_birthday: 'ribbon',
  birthday: 'balloon',
  opening: 'storefront',
  other: 'ellipsis-horizontal',
};

export function eventTypeIcon(type: string | null | undefined): EventIconName {
  return (type && (ICON as Record<string, EventIconName>)[type]) || 'ellipsis-horizontal';
}
