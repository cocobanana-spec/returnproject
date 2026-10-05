// 사진에서 읽은 글줄을 가져오기 표로 바꾼다 — 손으로 쓴 명부·축의금 봉투 묶음·방명록 사진이 대상이다
//
// OCR(ML Kit)은 글줄만 준다. "김철수 100,000", "이영희 10만원", "박지호 5만" 같은 줄에서 이름과
// 금액을 뽑아 [이름, 금액] 두 열의 표로 만든다. 그 뒤는 파일 가져오기와 같은 길(guessMapping →
// buildRows → 미리보기)이라 동명이인·금액 오류 판정을 다시 만들지 않는다.
//
// 못 읽은 줄은 버리지 않고 [원문, ''] 로 남긴다. 미리보기에서 금액 없음으로 보이고 사용자가 고친다.
// 손글씨 인식은 틀릴 수 있으므로 **저장 전에 사람이 본다**는 전제는 그대로다.
//
// 2026-10-05 실기기 결과: ML Kit 은 이름 열과 금액 열을 **다른 블록**으로 떼어 준다. 그래서 "김철수" 와
// "100,000" 이 서로 다른 줄로 오고, 순서도 열 단위다. 글자 상자(frame)의 세로 위치로 같은 줄을 다시 묶는다
// (groupOcrLines). 쉼표 대신 띄어쓴 "50 000", 0 을 O 로 읽은 "1OO,OOO", 제목 줄("축의금 명부")도 여기서 처리한다.
import type { Table } from './importPlan.ts';

// 금액으로 볼 수 있는 조각. 숫자+원/만/만원, 쉼표(또는 띄어쓰기) 숫자, 그냥 숫자(4자리 이상)
const AMOUNT = /(\d{1,3}(?:[,\s]\d{3})+|\d+)\s*(만\s*원|만|원)?/g;

export type OcrLine = { text: string; frame?: { top: number; left: number; width: number; height: number } };

// 세로로 겹치는 줄끼리 한 줄로 묶고, 묶음 안은 왼쪽부터 순서대로 잇는다. 상자가 없는 줄은 그대로 한 줄이다.
export function groupOcrLines(lines: OcrLine[]): string[] {
  const boxed = lines.filter((l): l is OcrLine & { frame: NonNullable<OcrLine['frame']> } => !!l.frame && l.frame.height > 0);
  const loose = lines.filter((l) => !l.frame || l.frame.height <= 0).map((l) => l.text);
  const sorted = [...boxed].sort((a, b) => a.frame.top - b.frame.top);
  const rows: { top: number; bottom: number; items: typeof boxed }[] = [];
  for (const l of sorted) {
    const cy = l.frame.top + l.frame.height / 2;
    const row = rows.find((r) => cy >= r.top && cy <= r.bottom);
    if (row) {
      row.items.push(l);
      row.top = Math.min(row.top, l.frame.top);
      row.bottom = Math.max(row.bottom, l.frame.top + l.frame.height);
    } else {
      rows.push({ top: l.frame.top, bottom: l.frame.top + l.frame.height, items: [l] });
    }
  }
  return [
    ...rows.map((r) => r.items.sort((a, b) => a.frame.left - b.frame.left).map((l) => l.text).join(' ')),
    ...loose,
  ];
}

// 숫자 사이의 O/o 는 0 이다("1OO,OOO"). 한글 이름에는 O 가 안 들어가므로 안전하다.
function fixZeroLikeO(text: string): string {
  let prev = '';
  let cur = text;
  while (cur !== prev) {
    prev = cur;
    cur = cur.replace(/(?<=[\d,])[Oo]/g, '0').replace(/[Oo](?=[\d,])/g, '0');
  }
  return cur;
}

export type OcrRow = { name: string; amount: string; raw: string };

export function parseOcrLine(line: string): OcrRow | null {
  const raw = fixZeroLikeO(line.replace(/\s+/g, ' ').trim());
  if (!raw) return null;
  // 금액 후보 중 가장 뒤의 것을 쓴다 — 이름 뒤에 금액이 오는 것이 보통이다
  let best: { text: string; index: number; end: number } | null = null;
  for (const m of raw.matchAll(AMOUNT)) {
    const num = m[1]!.replace(/\s/g, '');
    const unit = (m[2] ?? '').replace(/\s/g, '');
    const digits = num.replace(/,/g, '');
    // 단위 없이 3자리 이하 숫자는 금액이 아니다(번호·날짜 조각)
    if (!unit && digits.length < 4) continue;
    best = { text: `${num}${unit}`, index: m.index ?? 0, end: (m.index ?? 0) + m[0].length };
  }
  if (!best) return { name: raw, amount: '', raw };
  const name = (raw.slice(0, best.index) + ' ' + raw.slice(best.end))
    .replace(/[·|:：\-–—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { name, amount: best.text, raw };
}

// 표 머리글은 넣지 않는다. guessMapping 이 '이름/금액' 열을 내용으로 알아본다.
export function linesToTable(lines: string[]): Table {
  const rows: Table = [];
  for (const line of lines) {
    const r = parseOcrLine(line);
    if (!r) continue;
    // 이름도 금액도 없는 줄(머리글·장식)은 뺀다
    if (!r.name && !r.amount) continue;
    // 머리글 줄('이름 금액', '성명 축의금')은 뺀다 — 머리글 낱말로만 된 줄
    if (!r.amount && /^((이름|성명|금액|축의금|조의금|합계|총계|번호|no\.?)\s*)+$/i.test(r.name)) continue;
    // 제목 줄("축의금 명부", 손글씨라 "축의글 부"로도 읽힌다)도 뺀다 — 금액 없이 명부 낱말이 든 줄
    if (!r.amount && /명부|축의|조의|부의|방명록|하객|접수/.test(r.name)) continue;
    rows.push([r.name, r.amount]);
  }
  return rows;
}
