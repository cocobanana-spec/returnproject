// 사진에서 읽은 글줄을 가져오기 표로 바꾼다 — 손으로 쓴 명부·축의금 봉투 묶음·방명록 사진이 대상이다
//
// OCR(ML Kit)은 글줄만 준다. "김철수 100,000", "이영희 10만원", "박지호 5만" 같은 줄에서 이름과
// 금액을 뽑아 [이름, 금액] 두 열의 표로 만든다. 그 뒤는 파일 가져오기와 같은 길(guessMapping →
// buildRows → 미리보기)이라 동명이인·금액 오류 판정을 다시 만들지 않는다.
//
// 못 읽은 줄은 버리지 않고 [원문, ''] 로 남긴다. 미리보기에서 금액 없음으로 보이고 사용자가 고친다.
// 손글씨 인식은 틀릴 수 있으므로 **저장 전에 사람이 본다**는 전제는 그대로다.
import type { Table } from './importPlan.ts';

// 금액으로 볼 수 있는 조각. 숫자+원/만/만원, 쉼표 숫자, 그냥 숫자(4자리 이상)
const AMOUNT = /(\d{1,3}(?:,\d{3})+|\d+)\s*(만\s*원|만|원)?/g;

export type OcrRow = { name: string; amount: string; raw: string };

export function parseOcrLine(line: string): OcrRow | null {
  const raw = line.replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  // 금액 후보 중 가장 뒤의 것을 쓴다 — 이름 뒤에 금액이 오는 것이 보통이다
  let best: { text: string; index: number; end: number } | null = null;
  for (const m of raw.matchAll(AMOUNT)) {
    const num = m[1]!;
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
    rows.push([r.name, r.amount]);
  }
  return rows;
}
