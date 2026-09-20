// 행사 제목 자동 생성과 날짜 정밀도 표기. 제목 규칙은 docs/03 §2에 정의돼 있다
import { EVENT_TYPE_LABEL, type DatePrecision, type EventType } from './constants.ts';

// 남의 행사 "{당사자 이름} {종류} {연도}", 내 행사 "내 {종류}".
// 같은 사람의 같은 종류 행사가 여러 번일 수 있어 연도를 붙인다.
export function autoEventTitle(params: {
  type: EventType;
  isMine: boolean;
  hostName?: string | null;
  date: string;
}): string {
  const label = EVENT_TYPE_LABEL[params.type];
  if (params.isMine) return `내 ${label}`;
  const year = params.date.slice(0, 4);
  const host = (params.hostName ?? '').trim();
  return host ? `${host} ${label} ${year}` : `${label} ${year}`;
}

// 정밀도에 따라 날짜를 다르게 보여 준다. 저장값은 언제나 YYYY-MM-DD다.
export function formatEventDate(date: string, precision: DatePrecision): string {
  const [y, m, d] = date.split('-');
  // 날짜가 깨졌을 때 "2024.undefined" 같은 문자열이 화면에 나가지 않게 한다.
  if (!y || !m || !d) return date;
  if (precision === 'year') return `${y}년`;
  if (precision === 'month') return `${y}.${m}`;
  return `${y}.${m}.${d}`;
}

// 정밀도를 낮춰 저장할 때 날짜를 맞춘다. 월만 알면 1일, 연도만 알면 1월 1일로 채운다.
export function coerceDateToPrecision(date: string, precision: DatePrecision): string {
  const [y, m] = date.split('-');
  if (precision === 'year') return `${y}-01-01`;
  if (precision === 'month') return `${y}-${m}-01`;
  return date;
}

export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 빠른 기록의 "기존 행사에 추가?" 판정 범위(±7일)를 날짜 문자열로 만든다.
export function dateWindow(date: string, days = 7): { from: string; to: string } {
  const base = new Date(`${date}T00:00:00Z`);
  const shift = (delta: number) => {
    const next = new Date(base);
    next.setUTCDate(next.getUTCDate() + delta);
    return next.toISOString().slice(0, 10);
  };
  return { from: shift(-days), to: shift(days) };
}
