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
