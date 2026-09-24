// 계정 삭제. 배포된 Edge Function delete-account 를 부른다
//
// 이 함수가 사용자 JWT로 prepare_account_deletion RPC를 먼저 돌려 장부를 정리하고
// (혼자면 장부와 데이터 삭제, 함께면 나만 제거) 그 다음 service role로 계정을 지운다.
// RPC가 실패하면 계정을 남기므로 데이터가 주인 없이 떠도는 방향으로는 실패하지 않는다.
//
// 반대 방향의 부분 실패는 막을 수 없다. 장부 정리가 끝난 뒤 계정 삭제만 실패하면 데이터는
// 이미 사라진 상태다. 그때 "아무 일도 없었다"고 안내하면 거짓말이므로 kind로 구분해 준다.
import { supabase } from '../lib/supabase';
import { mapAuthError } from './errors.ts';

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; kind: 'failed' | 'partial'; message: string };

const PARTIAL_MESSAGE =
  '장부 정리는 끝났지만 계정 삭제가 남았습니다. 장부와 기록은 이미 지워졌습니다. 다시 시도해 주세요.';
const FAILED_MESSAGE = '계정을 삭제하지 못했습니다. 잠시 뒤에 다시 시도해 주세요.';

// Edge Function이 500을 주면 supabase-js는 error로 넘기고 본문은 error.context에 남는다.
async function readBody(error: unknown): Promise<Record<string, unknown> | null> {
  const context = (error as { context?: { json?: () => Promise<unknown> } } | null)?.context;
  if (!context?.json) return null;
  try {
    const body = await context.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function deleteAccount(): Promise<DeleteAccountResult> {
  try {
    const { data, error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    if (error) {
      const body = await readBody(error);
      if (body?.prepared === true) return { ok: false, kind: 'partial', message: PARTIAL_MESSAGE };
      // 인증 만료 같은 원인은 그대로 구분해 알려 준다.
      const mapped = mapAuthError({ message: error.message });
      return { ok: false, kind: 'failed', message: mapped.message };
    }
    if (data && typeof data === 'object' && (data as { ok?: unknown }).ok === true) {
      return { ok: true };
    }
    if (data && typeof data === 'object' && (data as { prepared?: unknown }).prepared === true) {
      return { ok: false, kind: 'partial', message: PARTIAL_MESSAGE };
    }
    return { ok: false, kind: 'failed', message: FAILED_MESSAGE };
  } catch (error) {
    return { ok: false, kind: 'failed', message: mapAuthError(error as never).message };
  }
}
