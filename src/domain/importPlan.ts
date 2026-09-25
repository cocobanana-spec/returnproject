// 가져오기(docs/02 §3.14)의 판단 로직 — 제목 행 감지, 열 역할 추정, 행 상태 판정, 저장 계획
//
// 화면은 이 함수들이 준 결과를 그리기만 한다. 파일 읽기는 importFile.ts, 금액은 importAmount.ts가 맡는다.
import { EVENT_TYPE_LABEL, type EventType } from './constants.ts';
import { AMOUNT_ERROR_LABEL, parseImportedAmount } from './importAmount.ts';
import { isValidName, normalizeName, trimName } from './name.ts';

export type ImportTarget = 'given' | 'received';

export type ColumnRole = 'name' | 'amount' | 'type' | 'date' | 'memo' | 'side' | 'ignore';

export const COLUMN_ROLE_LABEL: Record<ColumnRole, string> = {
  name: '이름',
  amount: '금액',
  type: '종류',
  date: '날짜',
  memo: '메모',
  side: '측',
  ignore: '무시',
};

// 셀은 문자열 아니면 숫자다(xlsx 통화 서식 셀은 값이 숫자다). 빈 셀은 빈 문자열.
export type Cell = string | number;
export type Table = Cell[][];

export type Mapping = { hasHeader: boolean; roles: ColumnRole[] };

const ROLE_PATTERNS: { role: ColumnRole; re: RegExp }[] = [
  { role: 'ignore', re: /^(no\.?|번호|순번|#)$/i },
  { role: 'name', re: /^(이름|성명|성함|name)$/i },
  { role: 'amount', re: /^(금액|축의금|부조금|조의금|부의금|amount)$/i },
  { role: 'type', re: /^(구분|종류|경조사|type)$/i },
  { role: 'date', re: /^(날짜|일자|date)$/i },
  { role: 'memo', re: /^(메모|비고|memo|note)$/i },
  { role: 'side', re: /^(측|side)$/i },
];

function cellText(cell: Cell | undefined): string {
  if (cell === undefined || cell === null) return '';
  return typeof cell === 'number' ? String(cell) : cell.trim();
}

// 비어 있는 선행 열(견본의 A열)과 완전히 빈 행을 걷어낸다. 열 개수는 가장 긴 행에 맞춘다.
export function trimTable(raw: Table): Table {
  const rows = raw.filter((row) => row.some((cell) => cellText(cell).length > 0));
  if (rows.length === 0) return [];
  const width = Math.max(...rows.map((row) => row.length));
  let lead = 0;
  while (lead < width && rows.every((row) => cellText(row[lead]).length === 0)) lead += 1;
  return rows.map((row) => {
    const out: Cell[] = [];
    for (let i = lead; i < width; i += 1) out.push(row[i] ?? '');
    return out;
  });
}

function roleOfHeader(text: string): ColumnRole | null {
  for (const { role, re } of ROLE_PATTERNS) if (re.test(text)) return role;
  return null;
}

// 첫 행의 셀이 둘 이상 열 이름으로 읽히면 제목 행으로 본다.
export function detectHeader(table: Table): boolean {
  const first = table[0];
  if (!first) return false;
  const hits = first.filter((cell) => typeof cell === 'string' && roleOfHeader(cellText(cell)) !== null);
  return hits.length >= 2;
}

// 열 역할 추정. 제목 행이 없으면 "숫자가 많은 열 = 금액, 그 앞 문자열 열 = 이름"으로 짐작한다.
export function guessMapping(table: Table): Mapping {
  const width = Math.max(0, ...table.map((row) => row.length));
  const roles: ColumnRole[] = Array.from({ length: width }, () => 'ignore');
  const hasHeader = detectHeader(table);
  if (hasHeader) {
    const first = table[0] ?? [];
    first.forEach((cell, i) => {
      const role = roleOfHeader(cellText(cell));
      if (role && !roles.includes(role)) roles[i] = role;
      else if (role === 'ignore') roles[i] = 'ignore';
    });
    return { hasHeader, roles };
  }
  const body = table;
  const numericScore = (i: number) =>
    body.filter((row) => parseImportedAmount(row[i] ?? '').ok).length;
  const textScore = (i: number) =>
    body.filter((row) => typeof row[i] === 'string' && isValidName(row[i] as string)).length;
  let amountCol = -1;
  let best = 0;
  for (let i = 0; i < width; i += 1) {
    const score = numericScore(i);
    if (score > best) {
      best = score;
      amountCol = i;
    }
  }
  if (amountCol >= 0) roles[amountCol] = 'amount';
  let nameCol = -1;
  best = 0;
  for (let i = 0; i < width; i += 1) {
    if (i === amountCol) continue;
    const score = textScore(i);
    if (score > best) {
      best = score;
      nameCol = i;
    }
  }
  if (nameCol >= 0) roles[nameCol] = 'name';
  return { hasHeader, roles };
}

export function mappingErrors(mapping: Mapping): string[] {
  const errors: string[] = [];
  if (!mapping.roles.includes('name')) errors.push('이름 열을 골라 주세요.');
  if (!mapping.roles.includes('amount')) errors.push('금액 열을 골라 주세요.');
  for (const role of ['name', 'amount', 'type', 'date', 'memo', 'side'] as ColumnRole[]) {
    if (mapping.roles.filter((r) => r === role).length > 1) {
      errors.push(`${COLUMN_ROLE_LABEL[role]} 열이 둘 이상입니다.`);
    }
  }
  return errors;
}

// 구분 열의 글자를 행사 종류로. 못 알아보면 null(화면이 "종류 미확인"으로 표시하고 기타로 둔다).
const TYPE_PATTERNS: { type: EventType; re: RegExp }[] = [
  { type: 'wedding', re: /결혼|웨딩|혼례|화촉/ },
  { type: 'first_birthday', re: /돌/ },
  { type: 'funeral', re: /장례|조문|부고|상가|별세|조의|부의/ },
  { type: 'senior_birthday', re: /회갑|칠순|팔순|환갑|고희|구순|생신/ },
  { type: 'opening', re: /개업|개소|개원|오픈/ },
];

export function mapEventType(text: string): EventType | null {
  const t = text.trim();
  if (t.length === 0) return null;
  for (const { type, re } of TYPE_PATTERNS) if (re.test(t)) return type;
  if (/기타/.test(t)) return 'other';
  return null;
}

// 날짜 셀. 엑셀 일련번호(숫자)·YYYY-MM-DD·YYYY.MM.DD·YYYY/MM/DD를 받는다.
export function parseImportedDate(cell: Cell | undefined): string | null {
  if (cell === undefined || cell === '') return null;
  if (typeof cell === 'number') {
    // 엑셀 1900 기준 일련번호. 25569는 1970-01-01.
    if (cell < 20000 || cell > 80000) return null;
    const ms = Math.round((cell - 25569) * 86_400_000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  const m = cell.trim().match(/^(\d{4})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})일?$/);
  if (!m) return null;
  const y = m[1] as string;
  const mo = (m[2] as string).padStart(2, '0');
  const d = (m[3] as string).padStart(2, '0');
  const iso = `${y}-${mo}-${d}`;
  return Number.isNaN(Date.parse(`${iso}T00:00:00Z`)) ? null : iso;
}

export type RowIssue =
  | 'empty_name'
  | 'bad_amount'
  | 'unitless_amount'
  | 'unknown_type'
  | 'type_mismatch'
  | 'same_name_in_ledger'
  | 'same_name_in_file';

export type ImportRow = {
  index: number; // 파일 행 번호(1부터, 제목 행 포함)
  name: string;
  nameKey: string;
  amount: number | null;
  amountText: string;
  type: EventType | null;
  typeText: string;
  date: string | null;
  memo: string;
  issues: RowIssue[];
  // 사용자 수정
  skip: boolean;
  label: string;
  // 장부에 같은 이름이 있을 때 — 기존 사람에게 붙일지(id) 새 사람으로 만들지(null)
  attachTo: string | null;
  // 파일 안 중복 — 같은 사람('same') / 다른 사람('different') / 미결(null)
  dupChoice: 'same' | 'different' | null;
};

export type BuildOptions = {
  target: ImportTarget;
  defaultDate: string; // 날짜 열이 없거나 못 읽을 때
  eventType: EventType | null; // received면 행사 종류(구분 열과 비교)
};

export function buildRows(table: Table, mapping: Mapping, opts: BuildOptions): ImportRow[] {
  const body = mapping.hasHeader ? table.slice(1) : table;
  const col = (role: ColumnRole) => mapping.roles.indexOf(role);
  const nameCol = col('name');
  const amountCol = col('amount');
  const typeCol = col('type');
  const dateCol = col('date');
  const memoCol = col('memo');

  return body.map((row, i) => {
    const index = i + (mapping.hasHeader ? 2 : 1);
    const nameRaw = nameCol >= 0 ? cellText(row[nameCol]) : '';
    const name = trimName(nameRaw);
    const amountCell = amountCol >= 0 ? row[amountCol] : '';
    const parsed = parseImportedAmount(amountCell === '' ? null : amountCell);
    const typeText = typeCol >= 0 ? cellText(row[typeCol]) : '';
    const mapped = typeText.length > 0 ? mapEventType(typeText) : null;
    const date = dateCol >= 0 ? parseImportedDate(row[dateCol]) : null;
    const memo = memoCol >= 0 ? cellText(row[memoCol]) : '';

    const issues: RowIssue[] = [];
    if (!isValidName(name)) issues.push('empty_name');
    if (!parsed.ok) issues.push('bad_amount');
    else if (parsed.unitless) issues.push('unitless_amount');
    if (opts.target === 'given') {
      if (mapped === null) issues.push('unknown_type');
    } else if (typeText.length > 0 && mapped !== null && opts.eventType && mapped !== opts.eventType) {
      issues.push('type_mismatch');
    }

    return {
      index,
      name,
      nameKey: normalizeName(name),
      amount: parsed.ok ? parsed.amount : null,
      amountText: cellText(amountCell),
      type: opts.target === 'given' ? (mapped ?? 'other') : opts.eventType,
      typeText,
      date: date ?? opts.defaultDate,
      memo,
      issues,
      skip: false,
      label: '',
      attachTo: null,
      dupChoice: null,
    };
  });
}

// 장부에 있는 같은 이름과 파일 안 중복을 표시한다. existing은 정규화 이름 → 후보 id 목록.
export function markSameNames(rows: ImportRow[], existing: Map<string, string[]>): ImportRow[] {
  const counts = new Map<string, number>();
  for (const row of rows) if (row.nameKey) counts.set(row.nameKey, (counts.get(row.nameKey) ?? 0) + 1);
  return rows.map((row) => {
    const issues: RowIssue[] = row.issues.filter((i) => i !== 'same_name_in_ledger' && i !== 'same_name_in_file');
    if (row.nameKey && (existing.get(row.nameKey)?.length ?? 0) > 0) issues.push('same_name_in_ledger');
    if (row.nameKey && (counts.get(row.nameKey) ?? 0) > 1) issues.push('same_name_in_file');
    return { ...row, issues };
  });
}

export type RowStatus = 'ok' | 'warn' | 'fix' | 'skip';

// 저장 가능 판정. 수정 필요(fix)가 하나라도 있으면 저장 버튼이 켜지지 않는다.
export function rowStatus(row: ImportRow): RowStatus {
  if (row.skip) return 'skip';
  if (row.issues.includes('empty_name') || row.issues.includes('bad_amount')) return 'fix';
  if (row.issues.includes('same_name_in_ledger') && row.attachTo === null && row.label.trim().length === 0) return 'fix';
  if (row.issues.includes('same_name_in_file')) {
    if (row.dupChoice === null) return 'fix';
    if (row.dupChoice === 'different' && row.label.trim().length === 0) return 'fix';
  }
  if (row.issues.includes('unitless_amount') || row.issues.includes('unknown_type') || row.issues.includes('type_mismatch')) {
    return 'warn';
  }
  return 'ok';
}

export function issueLabel(row: ImportRow, issue: RowIssue): string {
  switch (issue) {
    case 'empty_name':
      return '이름이 비어 있음';
    case 'bad_amount': {
      const parsed = parseImportedAmount(row.amountText === '' ? null : row.amountText);
      return parsed.ok ? '금액 오류' : AMOUNT_ERROR_LABEL[parsed.reason];
    }
    case 'unitless_amount':
      return `단위 없는 금액 — ${row.amount?.toLocaleString('ko-KR')}원으로 읽음`;
    case 'unknown_type':
      return row.typeText ? `종류 미확인 "${row.typeText}" — 기타로 둠` : '종류 없음 — 기타로 둠';
    case 'type_mismatch':
      return `행사 종류와 다름 "${row.typeText}"`;
    case 'same_name_in_ledger':
      return '장부에 같은 이름이 있음';
    case 'same_name_in_file':
      return '파일 안에 같은 이름이 둘 이상';
  }
}

export type ImportSummary = { save: number; skip: number; fix: number; total: number; totalAmount: number };

export function summarize(rows: ImportRow[]): ImportSummary {
  let save = 0;
  let skip = 0;
  let fix = 0;
  let totalAmount = 0;
  for (const row of rows) {
    const status = rowStatus(row);
    if (status === 'skip') skip += 1;
    else if (status === 'fix') fix += 1;
    else {
      save += 1;
      totalAmount += row.amount ?? 0;
    }
  }
  return { save, skip, fix, total: rows.length, totalAmount };
}

export function canSave(rows: ImportRow[]): boolean {
  const s = summarize(rows);
  return s.fix === 0 && s.save > 0;
}

// 저장 계획 한 줄. personKey가 같은 행들은 한 사람으로 묶인다(파일 안 중복을 같은 사람으로 고른 경우).
export type SaveItem = {
  rowIndex: number;
  name: string;
  label: string | null;
  attachTo: string | null;
  personKey: string;
  type: EventType;
  date: string;
  amount: number;
  memo: string | null;
};

export function planSave(rows: ImportRow[], target: ImportTarget): SaveItem[] {
  const items: SaveItem[] = [];
  for (const row of rows) {
    const status = rowStatus(row);
    if (status === 'skip' || status === 'fix' || row.amount === null) continue;
    const label = row.label.trim() || null;
    const different = row.dupChoice === 'different';
    // 다른 사람이면 행 번호까지 키에 넣어 각자 만든다. 같은 사람이면 이름 키로 묶인다.
    const personKey = row.attachTo ? `id:${row.attachTo}` : different ? `${row.nameKey}#${row.index}` : row.nameKey;
    items.push({
      rowIndex: row.index,
      name: row.name,
      label,
      attachTo: row.attachTo,
      personKey,
      type: row.type ?? 'other',
      date: row.date ?? '',
      amount: row.amount,
      memo: row.memo.trim() || null,
    });
  }
  void target;
  return items;
}

export function eventTypeLabelOf(type: EventType | null): string {
  return type ? EVENT_TYPE_LABEL[type] : '기타';
}
