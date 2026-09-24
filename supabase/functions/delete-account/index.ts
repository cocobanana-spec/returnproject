// 계정 삭제 — 사용자 JWT로 장부를 먼저 정리한 뒤(prepare_account_deletion) service role로 계정을 지운다
// 장부 처리 규칙은 docs/03 §6·§7. 혼자 쓰던 장부는 데이터까지 삭제되고, 함께 쓰던 장부에서는 나만 빠진다.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

// Expo 웹(2단계 청첩장 포함)에서 호출될 수 있어 최소 CORS만 둔다. React Native는 프리플라이트를 보내지 않는다.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'missing_authorization' }, 401)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // 1. 호출자의 JWT로 동작하는 클라이언트. RPC 안의 auth.uid()가 이 사용자를 가리킨다.
  const asUser = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })

  const { data: userData, error: userErr } = await asUser.auth.getUser()
  if (userErr || !userData?.user) return json({ error: 'invalid_token' }, 401)
  const userId = userData.user.id

  // 2. 장부 정리. 실패하면 계정을 지우지 않는다(데이터가 주인 없이 남는 것을 막는다).
  const { error: rpcErr } = await asUser.rpc('prepare_account_deletion')
  if (rpcErr) {
    console.error('prepare_account_deletion 실패', userId, rpcErr)
    return json({ error: 'prepare_failed', detail: rpcErr.message }, 500)
  }

  // 3. 계정 삭제. 남은 참조(entries.created_by)는 FK의 ON DELETE SET NULL로 비워진다.
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { error: delErr } = await admin.auth.admin.deleteUser(userId)
  if (delErr) {
    // 이 시점에는 장부 정리가 이미 커밋됐다. "아무 일도 없었다"고 안내하면 거짓말이 된다.
    // 앱이 구분해서 안내할 수 있도록 별도 코드를 준다.
    console.error('deleteUser 실패', userId, delErr)
    return json({ error: 'delete_failed', prepared: true, detail: delErr.message }, 500)
  }

  return json({ ok: true }, 200)
})
