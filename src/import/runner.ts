// 가져오기 저장 실행기 — 사람 → 행사 → 기록 순차 INSERT, 중간 실패 시 만든 것을 기억해 이어서 재시도
//
// 플랫폼 중립이라 통합 검증이 실패를 주입해 그대로 돌린다. 화면은 진행률만 그린다.
// 하나의 데이터 수정 CTE로 묶으면 뒤 문장이 앞 CTE가 넣은 행을 못 본다(docs/03 결정 26).
// 재시도 규칙 — 끝난 행은 건너뛰고, 이미 만든 사람·행사는 키로 다시 쓴다. 앞 행을 중복 생성하지 않는다.
import { pickClosestEvent } from '../domain/quickRecord.ts';
import type { ImportTarget, SaveItem } from '../domain/importPlan.ts';
import { autoEventTitle } from '../domain/title.ts';
import type { EventType } from '../domain/constants.ts';
import { createEntry } from '../repositories/entries.ts';
import { createEvent, findMatchingEvent } from '../repositories/events.ts';
import { createPerson } from '../repositories/people.ts';

export type ImportDeps = {
  createPerson: typeof createPerson;
  createEvent: typeof createEvent;
  findMatchingEvent: typeof findMatchingEvent;
  createEntry: typeof createEntry;
};

export const defaultDeps: ImportDeps = { createPerson, createEvent, findMatchingEvent, createEntry };

// 재시도를 위해 실행 사이에 살아남는 상태. 화면이 ref로 들고 있다.
export type ImportState = {
  done: Set<number>; // 기록까지 끝난 rowIndex
  people: Map<string, string>; // personKey → person id (새로 만들었거나 기존에 붙인 것)
  events: Map<string, string>; // eventKey → event id
};

export function emptyImportState(): ImportState {
  return { done: new Set(), people: new Map(), events: new Map() };
}

export type ImportProgress = { done: number; total: number };

export type RunOptions = {
  ledgerId: string;
  target: ImportTarget;
  eventId: string | null; // received면 명부를 붙일 내 행사. null이면 종류별로 나눠 담는다
  // 받은돈에서 행사가 정해지지 않았을 때 종류별 대상. 없는 종류는 그 자리에서 내 행사를 만든다.
  myEventByType?: Map<EventType, { id: string | null; title: string; date: string }>;
  items: SaveItem[];
  state: ImportState;
  deps?: ImportDeps;
  onProgress?: (p: ImportProgress) => void;
};

export class ImportRunError extends Error {
  readonly rowIndex: number;
  constructor(rowIndex: number, cause: unknown) {
    super(`${rowIndex}행에서 멈췄습니다 · ${(cause as Error)?.message ?? String(cause)}`);
    this.name = 'ImportRunError';
    this.rowIndex = rowIndex;
  }
}

function eventKey(personId: string, type: EventType, date: string): string {
  return `${personId}|${type}|${date}`;
}

export async function runImport(opts: RunOptions): Promise<ImportProgress> {
  const { ledgerId, target, items, state } = opts;
  const deps = opts.deps ?? defaultDeps;
  const total = items.length;
  let done = items.filter((it) => state.done.has(it.rowIndex)).length;
  opts.onProgress?.({ done, total });

  for (const item of items) {
    if (state.done.has(item.rowIndex)) continue;
    try {
      // 1. 사람 — 기존에 붙이거나, 이번 실행에서 만든 것을 다시 쓰거나, 새로 만든다.
      let personId = item.attachTo ?? state.people.get(item.personKey) ?? null;
      if (!personId) {
        const made = await deps.createPerson(ledgerId, {
          name: item.name,
          relation_group: 'other',
          label: item.label,
        });
        personId = made.id;
        state.people.set(item.personKey, personId);
      }

      // 2. 행사 — 준돈은 사람·종류·날짜로 기존 행사를 찾거나 만든다(S02 규칙).
      //    받은돈은 대상이 정해졌으면 그 행사, 아니면 **종류별로 내 행사에 나눠 담는다.**
      //    한 파일에 결혼식과 장례식이 섞여 있으면 행사 하나에 다 넣을 수 없기 때문이다.
      let eventId = opts.eventId;
      if (target === 'received' && !eventId) {
        const key = `mine:${item.type}`;
        eventId = state.events.get(key) ?? null;
        if (!eventId) {
          const plan = opts.myEventByType?.get(item.type);
          if (plan?.id) {
            eventId = plan.id;
          } else {
            const date = plan?.date ?? item.date;
            const made = await deps.createEvent(ledgerId, {
              type: item.type,
              is_mine: true,
              title: plan?.title ?? autoEventTitle({ type: item.type, isMine: true, date }),
              date,
            });
            eventId = made.id;
          }
          state.events.set(key, eventId);
        }
      }
      if (target === 'given') {
        const key = eventKey(personId, item.type, item.date);
        eventId = state.events.get(key) ?? null;
        if (!eventId) {
          const matches = await deps.findMatchingEvent(ledgerId, {
            hostPersonId: personId,
            type: item.type,
            date: item.date,
          });
          const best = pickClosestEvent(matches, item.date);
          if (best) {
            eventId = best.id;
          } else {
            const made = await deps.createEvent(ledgerId, {
              type: item.type,
              is_mine: false,
              host_person_id: personId,
              title: autoEventTitle({ type: item.type, isMine: false, hostName: item.name, date: item.date }),
              date: item.date,
            });
            eventId = made.id;
          }
          state.events.set(key, eventId);
        }
      }
      if (!eventId) throw new Error('붙일 행사가 없습니다.');

      // 3. 기록
      await deps.createEntry(ledgerId, {
        event_id: eventId,
        person_id: personId,
        amount: item.amount,
        method: 'cash',
        memo: item.memo,
      });
      state.done.add(item.rowIndex);
      done += 1;
      opts.onProgress?.({ done, total });
    } catch (error) {
      throw new ImportRunError(item.rowIndex, error);
    }
  }
  return { done, total };
}
