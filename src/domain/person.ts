// 사람을 목록·자동완성에서 어떻게 요약해 보여 줄지 정하는 순수 함수들
import { RELATION_GROUP_LABEL, type RelationGroup } from './constants.ts';
import { formatWonShort } from './money.ts';

export type PersonSummary = {
  name: string | null;
  label?: string | null;
  relation_group?: string | null;
  kind?: string | null;
  given_total?: number | null;
  received_total?: number | null;
  entry_count?: number | null;
};

// 이름 아래 한 줄. 동명이인을 구별하는 근거가 되므로 구분 라벨을 관계 그룹보다 앞세운다.
export function personSubtitle(p: PersonSummary): string {
  const parts: string[] = [];
  if (p.label && p.label.trim()) parts.push(p.label.trim());
  const group = p.relation_group as RelationGroup | undefined;
  if (group && RELATION_GROUP_LABEL[group]) parts.push(RELATION_GROUP_LABEL[group]);
  if (p.kind === 'group') parts.push('단체');
  return parts.join(' · ');
}

// 자동완성·목록에서 쓰는 주고받은 요약. 기획의 "마지막 기록 요약" 자리를 대신한다.
export function balanceHint(p: PersonSummary): string {
  const given = p.given_total ?? 0;
  const received = p.received_total ?? 0;
  if ((p.entry_count ?? 0) === 0) return '기록 없음';
  const parts: string[] = [];
  if (given > 0) parts.push(`준 ${formatWonShort(given)}`);
  if (received > 0) parts.push(`받은 ${formatWonShort(received)}`);
  if (parts.length === 0) return `기록 ${p.entry_count}건`;
  return parts.join(' · ');
}

// 같은 이름이 이미 있는지. 있으면 저장 전에 한 번 물어본다(docs/02 §5 동명이인).
export function hasSameName(candidates: PersonSummary[], excludeId?: string | null): boolean {
  return candidates.some((c) => (c as { id?: string }).id !== excludeId);
}
