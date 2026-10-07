// 참석 여부 응답을 모아 세는 순수 함수 — 앱의 응답 목록 머리에 쓴다
export type RsvpRow = { side: string; attending: boolean; party_size: number; meal: string | null };

export type RsvpSummary = {
  responses: number;
  attendingPeople: number;
  absentResponses: number;
  bySide: { groom: number; bride: number };
  meal: { yes: number; no: number; unknown: number };
};

// 인원은 '본인 포함'이라 참석 응답의 party_size 를 더한다. 식사도 인원 단위로 센다.
export function summarizeRsvp(rows: RsvpRow[]): RsvpSummary {
  const s: RsvpSummary = { responses: rows.length, attendingPeople: 0, absentResponses: 0, bySide: { groom: 0, bride: 0 }, meal: { yes: 0, no: 0, unknown: 0 } };
  for (const r of rows) {
    if (!r.attending) {
      s.absentResponses += 1;
      continue;
    }
    const n = Math.max(1, r.party_size);
    s.attendingPeople += n;
    if (r.side === 'groom') s.bySide.groom += n;
    else if (r.side === 'bride') s.bySide.bride += n;
    const meal = r.meal === 'yes' || r.meal === 'no' ? r.meal : 'unknown';
    s.meal[meal] += n;
  }
  return s;
}

export type RsvpFilter = 'all' | 'groom' | 'bride' | 'absent';
export type RsvpFull = RsvpRow & { name: string; message: string | null; created_at: string };

// 필터·이름 검색. 측 필터는 참석한 사람만(불참은 '불참' 칸에서 본다)
export function filterRsvp<T extends RsvpFull>(rows: T[], filter: RsvpFilter, query: string): T[] {
  const q = query.trim();
  return rows.filter((r) => {
    if (filter === 'absent' && r.attending) return false;
    if ((filter === 'groom' || filter === 'bride') && (!r.attending || r.side !== filter)) return false;
    return q === '' || r.name.includes(q);
  });
}

const MEAL_KO: Record<string, string> = { yes: '식사', no: '식사 안 함', unknown: '식사 미정' };
export function mealLabel(meal: string | null): string {
  return meal ? (MEAL_KO[meal] ?? '') : '';
}

// 엑셀로 여는 명단. 맨 앞 BOM 은 엑셀이 한글을 깨뜨리지 않게 하려는 것
export function rsvpCsv(rows: RsvpFull[]): string {
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const head = ['이름', '측', '참석', '인원', '식사', '한마디', '보낸 때'];
  const body = rows.map((r) =>
    [r.name, r.side === 'groom' ? '신랑측' : '신부측', r.attending ? '참석' : '불참', String(r.attending ? r.party_size : 0), mealLabel(r.meal), r.message ?? '', r.created_at.slice(0, 16).replace('T', ' ')].map(cell).join(','),
  );
  return '﻿' + [head.join(','), ...body].join('\n');
}

// 메신저로 보내는 한눈 요약
export function rsvpShareText(title: string, rows: RsvpFull[]): string {
  const s = summarizeRsvp(rows);
  const lines = rows
    .filter((r) => r.attending)
    .map((r) => `· ${r.name} (${r.side === 'groom' ? '신랑측' : '신부측'}) ${r.party_size}명${r.meal ? ` · ${mealLabel(r.meal)}` : ''}`);
  return [
    `[${title}] 참석 여부`,
    `참석 ${s.attendingPeople}명 (신랑측 ${s.bySide.groom} · 신부측 ${s.bySide.bride}) · 불참 ${s.absentResponses}건`,
    `식사 ${s.meal.yes} · 안 함 ${s.meal.no} · 미정 ${s.meal.unknown}`,
    '',
    ...lines,
  ].join('\n');
}
