// 리포지토리 공통 — 페이지네이션과 서버 오류를 사람이 읽을 수 있는 말로 바꾸는 매핑
import type { PostgrestError } from '@supabase/supabase-js';
import { SERVER_MAX_ROWS } from '../lib/supabaseClient.ts';

// PostgREST 기본 상한이 1000행이라 그보다 작게 끊는다. 목록은 전부 이 단위로 가져온다.
export const PAGE_SIZE = 100;

export type PageParams = { limit?: number; offset?: number };

export type Page<T> = {
  rows: T[];
  hasMore: boolean;
  nextOffset: number | null;
};

// limit + 1 행을 요청해 다음 페이지가 있는지 판별한다.
export function pageRange(params?: PageParams): { from: number; to: number; limit: number } {
  // limit + 1 행을 요청하므로 서버 상한(1000)보다 하나 작게 잡아야 조용히 잘리지 않는다.
  const limit = Math.max(1, Math.min(params?.limit ?? PAGE_SIZE, SERVER_MAX_ROWS - 1));
  const offset = params?.offset ?? 0;
  return { from: offset, to: offset + limit, limit };
}

export function toPage<T>(rows: T[], offset: number, limit: number): Page<T> {
  const hasMore = rows.length > limit;
  const trimmed = hasMore ? rows.slice(0, limit) : rows;
  return { rows: trimmed, hasMore, nextOffset: hasMore ? offset + limit : null };
}

// 서버 함수가 RAISE로 던지는 약속된 문구를 화면 문구로 바꾼다.
const MESSAGES: Record<string, string> = {
  invalid_or_expired_code: '코드가 올바르지 않거나 만료되었습니다.',
  not_owner: '장부를 만든 사람만 할 수 있습니다.',
  not_member: '이 장부의 구성원이 아닙니다.',
  sole_member_cannot_leave:
    '이 장부의 유일한 구성원입니다. 장부를 없애려면 계정 삭제를 이용하세요.',
  merge_same_person: '같은 사람끼리는 합칠 수 없습니다.',
  merge_would_self_reference: '공동 부조로 묶인 두 사람은 합칠 수 없습니다.',
  different_ledger: '다른 장부의 사람과는 합칠 수 없습니다.',
  person_not_found: '이미 삭제된 사람입니다.',
  event_has_entries_is_mine_locked: '기록이 있는 행사는 내 행사 여부를 바꿀 수 없습니다.',
  host_person_required: '남의 행사에는 당사자가 필요합니다.',
  host_person_in_other_ledger: '다른 장부의 사람은 당사자로 지정할 수 없습니다.',
  person_in_other_ledger: '다른 장부의 사람으로는 기록할 수 없습니다.',
  event_in_other_ledger: '다른 장부의 행사에는 기록할 수 없습니다.',
  co_person_in_other_ledger: '다른 장부의 사람은 공동 부조자로 지정할 수 없습니다.',
  ledger_id_immutable: '기록을 다른 장부로 옮길 수 없습니다.',
  event_not_found: '이 장부의 행사가 아닙니다.',
  not_authenticated: '로그인이 필요합니다.',
};

export class RepositoryError extends Error {
  readonly code: string | undefined;
  readonly cause: PostgrestError | undefined;

  constructor(message: string, code?: string, cause?: PostgrestError) {
    super(message);
    this.name = 'RepositoryError';
    this.code = code;
    this.cause = cause;
  }
}

export function toRepositoryError(error: PostgrestError): RepositoryError {
  const raw = error.message ?? '';
  const known = Object.keys(MESSAGES).find((key) => raw.includes(key));
  if (known) return new RepositoryError(MESSAGES[known] as string, known, error);

  // RLS로 걸러진 INSERT는 42501로 온다. 사용자에게는 권한 문제로 보여 준다.
  if (error.code === '42501') {
    return new RepositoryError('이 장부에 쓸 권한이 없습니다.', error.code, error);
  }
  return new RepositoryError(raw || '알 수 없는 오류가 발생했습니다.', error.code, error);
}

// supabase-js 응답을 풀어 준다. 오류면 RepositoryError로 바꿔 던진다.
export function unwrap<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw toRepositoryError(result.error);
  return result.data as T;
}
