// 서버 집계 RPC가 돌려준 잘게 쪼개진 행을 화면이 쓰는 모양으로 접는다
// 쿼리를 여러 번 날리지 않고 한 번 받아 메모리에서 접는 것이 docs/03 §5의 방침이다
import {
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

export type YearStats = {
  givenTotal: number;
  receivedTotal: number;
  balance: number;
  givenCount: number;
  receivedCount: number;
  unconfirmedCount: number;
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

  for (const row of rows) {
    const typeLabel = EVENT_TYPE_LABEL[row.type as EventType] ?? row.type;
    const groupLabel = RELATION_GROUP_LABEL[row.relation_group as RelationGroup] ?? row.relation_group;
    unconfirmedCount += row.unconfirmed;

    if (row.is_mine) {
      receivedTotal += row.total;
      receivedCount += row.cnt;
      bump(receivedByType, row.type, typeLabel, row.total, row.cnt);
      bump(receivedByGroup, row.relation_group, groupLabel, row.total, row.cnt);
    } else {
      givenTotal += row.total;
      givenCount += row.cnt;
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
    givenByType: sortDesc(givenByType),
    receivedByType: sortDesc(receivedByType),
    givenByGroup: sortDesc(givenByGroup),
    receivedByGroup: sortDesc(receivedByGroup),
  };
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
