// 플랫폼 중립 Supabase 클라이언트 보관소
//
// 리포지토리는 이 모듈의 db()만 쓴다. AsyncStorage 같은 React Native 전용 모듈을 직접 끌어오지
// 않기 때문에 Node에서도 그대로 불러 통합 검증을 돌릴 수 있다(supabase/tests/app_integration.mjs).
// 앱은 src/lib/supabase.ts 가 부팅될 때 setDb()로 실제 클라이언트를 꽂는다.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../db/database.types.ts';

export type Db = SupabaseClient<Database>;

let current: Db | null = null;

export function createDb(url: string, anonKey: string, storage?: unknown): Db {
  return createClient<Database>(url, anonKey, {
    auth: {
      ...(storage ? { storage: storage as never } : {}),
      persistSession: Boolean(storage),
      autoRefreshToken: Boolean(storage),
      // 앱에는 주소창이 없다. OAuth 복귀는 딥링크로 받아 직접 교환한다.
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
}

export function setDb(client: Db): void {
  current = client;
}

export function db(): Db {
  if (!current) {
    throw new Error('Supabase 클라이언트가 설정되지 않았다. src/lib/supabase 를 먼저 불러야 한다.');
  }
  return current;
}

// PostgREST가 한 번에 돌려주는 기본 상한이 1000행이다. 목록 조회는 반드시 페이지로 끊는다.
export const SERVER_MAX_ROWS = 1000;
