// 사람을 목록·자동완성에서 어떻게 요약해 보여 줄지 정하는 순수 함수들
//
// 동명이인 구분은 여기서만 정한다(docs/02 §5). 이름을 보여 주는 모든 화면이 displayName과
// distinguishLine을 쓰고, 화면이 직접 문자열을 조립하지 않는다.
import { RELATION_GROUP_LABEL, type RelationGroup } from './constants.ts';
import { formatWonShort } from './money.ts';
import { normalizeName } from './name.ts';

export type PersonSummary = {
  name: string | null;
  label?: string | null;
  relation_group?: string | null;
  kind?: string | null;
  given_total?: number | null;
  received_total?: number | null;
  entry_count?: number | null;
  last_entry_at?: string | null;
};

// 이름 뒤에 구분 라벨을 붙인 표시 이름. "김철수 · 회사". 라벨이 없으면 이름만.
export function displayName(p: { name?: string | null; label?: string | null } | null): string {
  const name = p?.name?.trim() || '(이름 없음)';
  const label = p?.label?.trim();
  return label ? `${name} · ${label}` : name;
}

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

// 자동완성·S15에서 같은 이름을 구별해 주는 한 줄. 라벨 → 관계 그룹 → 주고받은 요약 순이다.
// 라벨이 없으면 마지막 기록 시점까지 붙여, 라벨 없는 동명이인끼리도 다르게 보이게 한다.
// 라벨이 없는 동명이인(dupKeys에 이름이 있는 사람)에게는 "구분 없음"을 덧붙여 사용자가
// 라벨을 붙이도록 유도한다(자동 라벨은 만들지 않는다). 동명이 아닌 사람에게는 붙이지 않는다.
export function distinguishLine(p: PersonSummary, dupKeys: Set<string> = new Set()): string {
  const parts: string[] = [];
  const label = p.label?.trim();
  if (label) parts.push(label);
  const group = p.relation_group as RelationGroup | undefined;
  if (group && RELATION_GROUP_LABEL[group]) parts.push(RELATION_GROUP_LABEL[group]);
  if (p.kind === 'group') parts.push('단체');
  parts.push(balanceHint(p));
  if (!label && p.last_entry_at) parts.push(`최근 ${p.last_entry_at.slice(0, 7).replace('-', '.')}`);
  if (needsLabel(p, dupKeys)) parts.push('구분 없음');
  return parts.join(' · ');
}

// 입력한 이름과 정규화 결과가 같은 사람들. S02에서 "새 사람으로 추가"를 눌렀을 때 구분 칸을
// 띄울지 정한다(docs/02 §5 동명이인).
export function sameNameCandidates<T extends { name?: string | null }>(list: T[], typed: string): T[] {
  const key = normalizeName(typed);
  if (key.length === 0) return [];
  return list.filter((p) => normalizeName(p.name ?? '') === key);
}

// 목록 안에서 이름이 겹치는 사람들의 정규화 키. 사람 목록이 "구분 없음"을 표시할 때 쓴다.
export function duplicateNameKeys(list: { name?: string | null }[]): Set<string> {
  const seen = new Map<string, number>();
  for (const p of list) {
    const key = normalizeName(p.name ?? '');
    if (key.length === 0) continue;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return new Set([...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k));
}

// 동명이인인데 라벨이 없어 나중에 헷갈릴 사람인지.
export function needsLabel(p: { name?: string | null; label?: string | null }, dupKeys: Set<string>): boolean {
  return !p.label?.trim() && dupKeys.has(normalizeName(p.name ?? ''));
}

// ---------------------------------------------------------------- 같은 이름을 만났을 때
//
// **기본은 "이 사람이 그 사람이다"이다.** 내가 축의금을 낸 김철수가 내 결혼식에 와서 축의금을 낸
// 그 김철수다. 이 앱은 사람 하나에 준 돈과 받은 돈을 함께 보려고 만들었다(docs/01 비전).
// 같은 이름을 만났다고 새 사람을 만들면 그 전제가 깨진다.
//
// 구분 라벨은 **"이름이 같은 다른 사람을 새로 만들 때"** 를 위한 것이다. 그 규칙을 흔한 경우인
// "이 사람이 그 사람이다"에까지 걸어 두면, 명부를 가져올 때 겹치는 이름마다 수정을 요구하게 된다
// (2026-09-26 사용자 피드백). 세 화면(S02·S09·가져오기)이 이 함수 하나를 쓴다.
export const SAME_NAME_LABEL_ERROR = '같은 이름이 이미 있어요. 구분할 말을 적어 주세요(예: 회사, 고등학교).';
export const CHOOSE_SAME_NAME_ERROR = '같은 이름이 여러 명 있어요. 누구인지 골라 주세요.';

// new — 새로 만든다 / attach — 기존 한 명에게 붙인다 / choose — 여럿이라 골라야 한다
// needs_label — "다른 사람"이라고 했는데 구분할 말이 없다
export type SameNameDecision = 'new' | 'attach' | 'choose' | 'needs_label';

export function sameNameDecision(
  candidateCount: number,
  opts: { wantsNewPerson: boolean; label: string },
): SameNameDecision {
  if (candidateCount <= 0) return 'new';
  // 사용자가 "다른 사람이에요"라고 한 경우에만 구분할 말을 요구한다.
  if (opts.wantsNewPerson) return opts.label.trim().length > 0 ? 'new' : 'needs_label';
  if (candidateCount === 1) return 'attach';
  return 'choose';
}

// 구분 칸을 띄워야 하는지. S02·S09가 같은 조건을 쓴다. **화면이 따로 조립하면 안 된다.**
// 라벨을 이미 적었어도 true다 — 타이핑 중에 칸이 사라지면 안 된다.
export function labelFieldNeeded(opts: {
  hasExisting: boolean;
  sameNameCount: number;
  wantsNewPerson: boolean;
}): boolean {
  if (opts.hasExisting) return false;
  return opts.wantsNewPerson && opts.sameNameCount > 0;
}

export type SameNameCandidate = { id: string; name?: string | null; label?: string | null };

export type SameNameResolution =
  | { kind: 'new' }
  | { kind: 'attach'; personId: string; display: string }
  | { kind: 'choose'; count: number }
  | { kind: 'needs_label' };

// 후보 목록을 아는 쪽(가져오기 미리보기·저장 직전 서버 재확인)이 쓴다.
export function resolveSameName(
  candidates: SameNameCandidate[],
  opts: { wantsNewPerson: boolean; label: string },
): SameNameResolution {
  const decision = sameNameDecision(candidates.length, opts);
  if (decision === 'attach') {
    const only = candidates[0] as SameNameCandidate;
    return { kind: 'attach', personId: only.id, display: displayName(only) };
  }
  if (decision === 'choose') return { kind: 'choose', count: candidates.length };
  if (decision === 'needs_label') return { kind: 'needs_label' };
  return { kind: 'new' };
}

// 새 사람을 만들 때 채택할 구분 라벨. 같은 이름이 없으면 남아 있는 값도 채택하지 않는다
// (칸이 보이지 않았으므로 사용자가 확인한 값이 아니다).
export function newPersonLabelRule(
  hasExisting: boolean,
  sameNameCount: number,
  labelText: string,
  wantsNewPerson: boolean,
): { error: string | null; label: string | null } {
  if (hasExisting) return { error: null, label: null };
  const label = labelText.trim();
  const decision = sameNameDecision(sameNameCount, { wantsNewPerson, label: labelText });
  if (decision === 'needs_label') return { error: SAME_NAME_LABEL_ERROR, label: null };
  if (decision === 'choose') return { error: CHOOSE_SAME_NAME_ERROR, label: null };
  return { error: null, label: sameNameCount > 0 && label.length > 0 ? label : null };
}
