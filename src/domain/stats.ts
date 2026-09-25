// 서버 집계 RPC가 돌려준 잘게 쪼개진 행을 화면이 쓰는 모양으로 접는다
// 쿼리를 여러 번 날리지 않고 한 번 받아 메모리에서 접는 것이 docs/03 §5의 방침이다
import {
  EVENT_TYPES,
  EVENT_TYPE_LABEL,
  RELATION_GROUP_LABEL,
  METHOD_LABEL,
  type EventType,
  type Method,
  type RelationGroup,
  type Side,
} from './constants.ts';

export type StatsRow = {
  year: number;
  is_mine: boolean;
  type: string;
  relation_group: string;
  cnt: number;
  total: number;
  unconfirmed: number;
};

export type Bucket = { key: string; label: string; total: number; cnt: number };

// person_stats_by_year 한 행. person_balances 뷰와 같은 이름을 써서 화면이 둘을 구분할 일이 없다.
export type PersonStatsRow = {
  id: string;
  name: string;
  relation_group: string;
  given_total: number;
  received_total: number;
  balance: number;
  entry_count: number;
};

// "차액이 큰 사람" 블록의 기간 표시. 전체 기간이 기본이고 세그먼트의 연도를 고를 수 있다.
export function topPeopleScopeLabel(year: number | null): string {
  return year === null ? '전체 기간' : `${year}년`;
}

export type YearStats = {
  givenTotal: number;
  receivedTotal: number;
  balance: number;
  givenCount: number;
  receivedCount: number;
  unconfirmedCount: number;
  // 방향별로도 나눠 둔다. 홈의 준돈 탭에 받은돈의 미확정 건수가 섞여 나오면
  // 사용자는 있지도 않은 준돈 미확정을 찾아 헤맨다.
  givenUnconfirmed: number;
  receivedUnconfirmed: number;
  givenByType: Bucket[];
  receivedByType: Bucket[];
  givenByGroup: Bucket[];
  receivedByGroup: Bucket[];
};

function sortDesc(map: Map<string, Bucket>): Bucket[] {
  return [...map.values()].sort((a, b) => b.total - a.total || b.cnt - a.cnt);
}

function bump(map: Map<string, Bucket>, key: string, label: string, total: number, cnt: number) {
  const prev = map.get(key);
  if (prev) {
    prev.total += total;
    prev.cnt += cnt;
  } else {
    map.set(key, { key, label, total, cnt });
  }
}

export function foldYearStats(rows: StatsRow[]): YearStats {
  const givenByType = new Map<string, Bucket>();
  const receivedByType = new Map<string, Bucket>();
  const givenByGroup = new Map<string, Bucket>();
  const receivedByGroup = new Map<string, Bucket>();

  let givenTotal = 0;
  let receivedTotal = 0;
  let givenCount = 0;
  let receivedCount = 0;
  let unconfirmedCount = 0;
  let givenUnconfirmed = 0;
  let receivedUnconfirmed = 0;

  for (const row of rows) {
    const typeLabel = EVENT_TYPE_LABEL[row.type as EventType] ?? row.type;
    const groupLabel = RELATION_GROUP_LABEL[row.relation_group as RelationGroup] ?? row.relation_group;
    unconfirmedCount += row.unconfirmed;

    if (row.is_mine) {
      receivedTotal += row.total;
      receivedCount += row.cnt;
      receivedUnconfirmed += row.unconfirmed;
      bump(receivedByType, row.type, typeLabel, row.total, row.cnt);
      bump(receivedByGroup, row.relation_group, groupLabel, row.total, row.cnt);
    } else {
      givenTotal += row.total;
      givenCount += row.cnt;
      givenUnconfirmed += row.unconfirmed;
      bump(givenByType, row.type, typeLabel, row.total, row.cnt);
      bump(givenByGroup, row.relation_group, groupLabel, row.total, row.cnt);
    }
  }

  return {
    givenTotal,
    receivedTotal,
    balance: givenTotal - receivedTotal,
    givenCount,
    receivedCount,
    unconfirmedCount,
    givenUnconfirmed,
    receivedUnconfirmed,
    givenByType: sortDesc(givenByType),
    receivedByType: sortDesc(receivedByType),
    givenByGroup: sortDesc(givenByGroup),
    receivedByGroup: sortDesc(receivedByGroup),
  };
}

// 통계 화면(S11)의 연도 세그먼트. stats_by_year를 연도마다 부르면 왕복이 늘어나므로
// p_year 없이 한 번만 받아 여기서 연도를 뽑고 연도별로 접는다(docs/03 §5의 방침과 같다).
export function yearsOf(rows: StatsRow[]): number[] {
  return [...new Set(rows.map((row) => row.year))].sort((a, b) => b - a);
}

// 세그먼트의 기본 선택은 반드시 세그먼트 안에 있는 값이어야 한다. 기기의 올해를 그대로
// 고르면, 올해 기록이 없는 장부에서 아무 칩도 선택 표시가 안 된 채 전부 0으로 보인다.
// 올해 기록이 있으면 올해, 없으면 가장 최근 기록 연도, 기록이 아예 없으면 전체(null)다.
export function defaultYear(years: number[], thisYear: number): number | null {
  if (years.includes(thisYear)) return thisYear;
  return years[0] ?? null;
}

// year가 null이면 전체 기간이다. 세그먼트의 "전체"가 이 경로를 쓴다.
export function foldYearStatsFor(rows: StatsRow[], year: number | null): YearStats {
  return foldYearStats(year === null ? rows : rows.filter((row) => row.year === year));
}

export type EventSummaryRow = {
  side: string | null;
  method: string;
  cnt: number;
  total: number;
  unconfirmed: number;
  returned: number;
};

export type SideBucket = {
  side: Side | null;
  total: number;
  cnt: number;
  unconfirmed: number;
  returned: number;
};

export type EventSummary = {
  total: number;
  cnt: number;
  unconfirmed: number;
  returned: number;
  bySide: SideBucket[];
  byMethod: Bucket[];
};

export function foldEventSummary(rows: EventSummaryRow[]): EventSummary {
  const bySide = new Map<string, SideBucket>();
  const byMethod = new Map<string, Bucket>();

  let total = 0;
  let cnt = 0;
  let unconfirmed = 0;
  let returned = 0;

  for (const row of rows) {
    total += row.total;
    cnt += row.cnt;
    unconfirmed += row.unconfirmed;
    returned += row.returned;

    const sideKey = row.side ?? '';
    const prev = bySide.get(sideKey);
    if (prev) {
      prev.total += row.total;
      prev.cnt += row.cnt;
      prev.unconfirmed += row.unconfirmed;
      prev.returned += row.returned;
    } else {
      bySide.set(sideKey, {
        side: (row.side as Side | null) ?? null,
        total: row.total,
        cnt: row.cnt,
        unconfirmed: row.unconfirmed,
        returned: row.returned,
      });
    }

    bump(byMethod, row.method, METHOD_LABEL[row.method as Method] ?? row.method, row.total, row.cnt);
  }

  return {
    total,
    cnt,
    unconfirmed,
    returned,
    // 측은 a → b → 미지정 순으로 고정한다. 합계 정렬로 순서가 흔들리면 화면이 튄다.
    bySide: [...bySide.values()].sort((x, y) => {
      const rank = (s: Side | null) => (s === 'a' ? 0 : s === 'b' ? 1 : 2);
      return rank(x.side) - rank(y.side);
    }),
    byMethod: sortDesc(byMethod),
  };
}

// ============================================================================
// 통계 화면(S11)의 방향 탭·필터·정렬 (2026-09-25 개편)
// ============================================================================

export type StatsDirection = 'all' | 'given' | 'received';

export const STATS_DIRECTION_LABEL: Record<StatsDirection, string> = {
  all: '전체',
  given: '준 돈',
  received: '받은 돈',
};

// 필터에 쓸 수 있는 경조사 종류. 기록이 있는 것만 보여 준다(없는 칩을 눌러 0을 보게 하지 않는다).
export function typesOf(rows: StatsRow[]): string[] {
  const order = new Map(EVENT_TYPES.map((t, i) => [t as string, i]));
  return [...new Set(rows.map((row) => row.type))].sort(
    (a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99),
  );
}

export function filterStatsRows(
  rows: StatsRow[],
  year: number | null,
  type: string | null,
): StatsRow[] {
  return rows.filter((row) => (year === null || row.year === year) && (type === null || row.type === type));
}

// ---------------------------------------------------------------- 행사별
// event_totals RPC 한 행. 화면이 이 모양을 그대로 그린다.
export type EventTotalRow = {
  event_id: string;
  title: string;
  type: string;
  is_mine: boolean;
  event_date: string;
  cnt: number;
  total: number;
  unconfirmed: number;
};

export function filterEventTotals(
  rows: EventTotalRow[],
  direction: StatsDirection,
  type: string | null,
): EventTotalRow[] {
  return rows.filter(
    (row) =>
      (direction === 'all' || (direction === 'received') === row.is_mine) &&
      (type === null || row.type === type),
  );
}

// 최신순 고정. 정렬 칩은 화면에서 뺐다(2026-09-25 가독성 정리).
// 같은 날이면 제목으로 순서를 고정해 목록이 흔들리지 않게 한다.
export function sortEventTotals(rows: EventTotalRow[]): EventTotalRow[] {
  return [...rows].sort(
    (a, b) => b.event_date.localeCompare(a.event_date) || a.title.localeCompare(b.title),
  );
}
