// 받은돈 가져오기에서 파일의 경조사 종류를 내 행사에 나눠 담는 계획(docs/02 §3.14)
//
// 받은돈은 행사에 속하고 종류는 행사가 가진다. 그래서 한 파일에 결혼식과 장례식이 섞여 있으면
// **행사 하나에 다 넣을 수 없다.** 종류별로 내 행사를 나눠 잡아야 한다(2026-09-26 사용자 피드백 —
// "장례식으로 종류를 지정해도 그냥 결혼식으로 입력된다").
//
// 행사 상세(S07)에서 들어온 경우는 대상이 이미 정해져 있으므로 이 모듈을 쓰지 않는다.
import { EVENT_TYPE_LABEL, type EventType } from './constants.ts';
import { autoEventTitle } from './title.ts';
import { rowStatus, type ImportRow } from './importPlan.ts';

// 고를 수 있는 내 행사. 화면이 질의해 넘긴다.
export type MyEventOption = { id: string; title: string; type: string; date: string };

export type TypeGroup = {
  type: EventType;
  typeLabel: string;
  count: number;
  total: number;
  // 붙일 기존 내 행사. null이면 새로 만든다.
  attachTo: string | null;
  // 새로 만들 때 쓸 값. 사용자가 미리보기에서 바꿀 수 있다.
  newTitle: string;
  newDate: string;
  // 같은 종류의 내 행사 후보. 화면이 칩으로 보여 준다.
  options: MyEventOption[];
};

// 저장 대상이 되는 행만 센다. 건너뛰거나 수정 필요인 행은 아직 어디에도 안 간다.
function savableRows(rows: ImportRow[]): ImportRow[] {
  return rows.filter((r) => {
    const status = rowStatus(r);
    return status !== 'skip' && status !== 'fix' && r.amount !== null;
  });
}

// 그 종류의 행들이 가진 날짜 중 가장 이른 것. 명부의 날짜가 행사 날짜에 가장 가깝다.
// 날짜 열이 없으면 전부 기본 날짜라 결과도 기본 날짜다.
function earliestDate(rows: ImportRow[], fallback: string): string {
  let best: string | null = null;
  for (const r of rows) {
    const d = r.date;
    if (!d) continue;
    if (best === null || d < best) best = d;
  }
  return best ?? fallback;
}

// 종류별 묶음. 같은 종류의 내 행사가 딱 하나면 그것을 기본 대상으로 잡고,
// 여럿이면 가장 최근 것을 잡는다(명부를 넣는 시점에 가까운 행사일 가능성이 높다).
// 하나도 없으면 새로 만든다 — 이때 사용자가 미리보기에서 그 사실을 볼 수 있어야 한다.
export function groupRowsByType(
  rows: ImportRow[],
  myEvents: MyEventOption[],
  fallbackDate: string,
): TypeGroup[] {
  const byType = new Map<EventType, ImportRow[]>();
  for (const row of savableRows(rows)) {
    const type = (row.type ?? 'other') as EventType;
    byType.set(type, [...(byType.get(type) ?? []), row]);
  }

  const groups: TypeGroup[] = [];
  for (const [type, list] of byType) {
    const options = myEvents
      .filter((e) => e.type === type)
      .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
    const date = earliestDate(list, fallbackDate);
    groups.push({
      type,
      typeLabel: EVENT_TYPE_LABEL[type],
      count: list.length,
      total: list.reduce((sum, r) => sum + (r.amount ?? 0), 0),
      attachTo: options[0]?.id ?? null,
      newTitle: autoEventTitle({ type, isMine: true, date }),
      newDate: date,
      options,
    });
  }
  // 건수가 많은 묶음이 위로. 사용자가 가장 먼저 확인해야 할 것이다.
  return groups.sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
}

// 묶음 하나의 대상을 바꾼다. null이면 새로 만든다.
export function setGroupTarget(
  groups: TypeGroup[],
  type: EventType,
  attachTo: string | null,
): TypeGroup[] {
  return groups.map((g) => (g.type === type ? { ...g, attachTo } : g));
}

// 행이 바뀌어 묶음을 다시 접을 때, 사용자가 고른 대상을 얹어 준다.
// **더 이상 없는 행사를 가리키면 버린다.** 배우자가 다른 기기에서 그 행사를 지웠을 수 있다.
// 그대로 두면 미리보기에는 "기존 행사"라고만 뜨고 저장은 외래키에서 터진다.
export function carryOverTargets(fresh: TypeGroup[], previous: TypeGroup[]): TypeGroup[] {
  return fresh.map((g) => {
    const before = previous.find((x) => x.type === g.type);
    if (!before) return g;
    if (before.attachTo === null) return { ...g, attachTo: null };
    const stillThere = g.options.some((o) => o.id === before.attachTo);
    return stillThere ? { ...g, attachTo: before.attachTo } : g;
  });
}

// 러너에 넘길 종류별 대상. 행마다 다시 계산하지 않도록 한 번에 접는다.
export type MyEventPlan = { id: string | null; title: string; date: string };

export function planByType(groups: TypeGroup[]): Map<EventType, MyEventPlan> {
  const out = new Map<EventType, MyEventPlan>();
  for (const g of groups) {
    out.set(g.type, { id: g.attachTo, title: g.newTitle, date: g.newDate });
  }
  return out;
}

// 미리보기 한 줄. "장례식 12건 · 1,200,000원 → 내 장례식 (새로 만듦)".
export function groupSummaryLine(group: TypeGroup): string {
  const target = group.attachTo
    ? (group.options.find((o) => o.id === group.attachTo)?.title ?? '기존 행사')
    : `${group.newTitle} (새로 만듦)`;
  return `${group.typeLabel} ${group.count}건 → ${target}`;
}
