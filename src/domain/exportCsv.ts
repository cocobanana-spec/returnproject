// 장부 기록을 CSV 한 장으로 만든다. 열 구성은 가져오기와 같아서 다시 넣을 수 있다
//
// **엑셀이 한글을 깨뜨리지 않게 BOM을 앞에 붙인다.** 붙이지 않으면 한국어 윈도우 엑셀이
// CSV를 CP949로 읽어 이름이 전부 깨진다. 메모장이나 구글 시트는 BOM이 있어도 괜찮다.
//
// 쉼표·따옴표·줄바꿈이 든 값은 따옴표로 감싸고 안쪽 따옴표는 두 번 쓴다(RFC 4180).
// 메모에 줄바꿈이 들어가는 일이 실제로 있다.
import { EVENT_TYPE_LABEL, type EventType } from './constants.ts';

export const CSV_HEADERS = ['이름', '구분', '날짜', '경조사', '방향', '금액', '메모'] as const;

export type ExportRow = {
  // 스키마상 금액은 비어 있을 수 있다. 빈 값을 0으로 적는 것이 칸을 비우는 것보다 낫다 —
  // 엑셀에서 합계를 낼 때 빈 칸은 조용히 건너뛰어지지만 0은 눈에 보인다.
  amount: number | null;
  memo?: string | null;
  person: { name?: string | null; label?: string | null } | null;
  event: {
    type?: string | null;
    is_mine?: boolean | null;
    date?: string | null;
    date_precision?: string | null;
  } | null;
};

export function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// 날짜 정밀도가 '월'이나 '년'이면 모르는 자리를 지어내지 않는다.
export function exportDate(date?: string | null, precision?: string | null): string {
  if (!date) return '';
  if (precision === 'year') return date.slice(0, 4);
  if (precision === 'month') return date.slice(0, 7);
  return date;
}

function typeLabel(type?: string | null): string {
  if (!type) return '';
  return EVENT_TYPE_LABEL[type as EventType] ?? type;
}

export function toCsvRow(row: ExportRow): string[] {
  return [
    row.person?.name?.trim() ?? '',
    row.person?.label?.trim() ?? '',
    exportDate(row.event?.date, row.event?.date_precision),
    typeLabel(row.event?.type),
    row.event?.is_mine ? '받은 돈' : '준 돈',
    String(row.amount ?? 0),
    row.memo?.trim() ?? '',
  ];
}

export function buildCsv(rows: ExportRow[]): string {
  const lines = [CSV_HEADERS.join(','), ...rows.map((r) => toCsvRow(r).map(csvCell).join(','))];
  return `﻿${lines.join('\r\n')}\r\n`;
}

// 파일 이름. 장부 이름이 파일 이름에 못 쓰는 글자를 담을 수 있다.
export function exportFileName(ledgerName: string, today: string): string {
  const safe = (ledgerName || '장부').replace(/[\\/:*?"<>|]/g, '').trim() || '장부';
  return `${safe}_${today}.csv`;
}
