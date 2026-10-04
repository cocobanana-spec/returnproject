// ppurin.com 워커 — /i/{slug} 는 서버가 청첩장 HTML 을 만들어 주고, 나머지는 정적 자산(랜딩·처리방침)이다
//
// 왜 서버가 그리나 — 카카오톡·슬랙 미리보기는 자바스크립트를 실행하지 않는다. 청첩장마다 다른
// 제목·사진이 미리보기에 잡히려면 HTML 자체에 OG 태그가 있어야 한다(docs/08 §2.4, §3.3).
// 게다가 하객은 데이터로 한 번 열어 본다. 3.5MB 앱 번들 대신 완성된 HTML 몇 KB 를 준다.
//
// 데이터는 Supabase 의 public_invitation(slug) RPC 로만 읽는다(0009). anon 키는 공개 키다(앱 번들에도
// 들어 있다). 서비스 키는 이 워커에 없다 — 있을 이유가 없다.
import { type InvitationContent, type InvitationKind } from '../src/domain/invitation.ts';
import { noticePage, renderInvitationPage } from '../src/invitation/render/index.ts';
import type { GuestbookMessage } from '../src/invitation/render/html.ts';

type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
};

type PublicInvitation = {
  kind: InvitationKind;
  template_id: string;
  content: InvitationContent;
  published_at: string;
  expires_at: string;
};

const SLUG = /^\/i\/([A-Za-z0-9]{10})\/?$/;

const HTML = { 'content-type': 'text/html; charset=utf-8' };

function assetUrlFor(env: Env) {
  return (path: string) => `${env.SUPABASE_URL}/storage/v1/object/public/invitations/${path}`;
}

async function fetchInvitation(env: Env, slug: string): Promise<PublicInvitation | null> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/public_invitation`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ p_slug: slug }),
  });
  if (!res.ok) throw new Error(`public_invitation ${res.status}`);
  const rows = (await res.json()) as PublicInvitation[];
  return rows[0] ?? null;
}

// 방명록. 실패하면 빈 목록으로 그린다 — 방명록 때문에 청첩장이 안 뜨면 안 된다.
async function fetchGuestbook(env: Env, slug: string): Promise<GuestbookMessage[]> {
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/public_guestbook`, {
      method: 'POST',
      headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${env.SUPABASE_ANON_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_slug: slug }),
    });
    if (!res.ok) return [];
    return (await res.json()) as GuestbookMessage[];
  } catch {
    return [];
  }
}

// 조회수. 응답을 기다리지 않는다(waitUntil). 실패해도 페이지는 나간다.
function countView(env: Env, slug: string): Promise<unknown> {
  return fetch(`${env.SUPABASE_URL}/rest/v1/rpc/record_invitation_view`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ p_slug: slug }),
  }).catch(() => undefined);
}

export default {
  async fetch(request: Request, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
    const url = new URL(request.url);
    const m = SLUG.exec(url.pathname);
    if (!m) return env.ASSETS.fetch(request);

    const slug = m[1]!;
    const pageUrl = `${url.origin}/i/${slug}`;
    // 미리보기 봇은 HEAD 로 올 때가 있다. GET 과 같게 처리하고 본문만 뗀다.
    const head = request.method === 'HEAD';
    if (request.method !== 'GET' && !head) {
      return new Response('method not allowed', { status: 405 });
    }

    let inv: PublicInvitation | null;
    let guestbook: GuestbookMessage[] = [];
    try {
      [inv, guestbook] = await Promise.all([fetchInvitation(env, slug), fetchGuestbook(env, slug)]);
    } catch {
      // 데이터 쪽 장애. 캐시하지 않는 503 으로 돌려 봇이 '없음'으로 기억하지 않게 한다.
      return new Response('잠시 뒤 다시 열어 주세요.', { status: 503, headers: { ...HTML, 'cache-control': 'no-store' } });
    }

    if (!inv) {
      // 없음·내려감·만료를 구분하지 않는다. 함수가 그 셋을 모두 '없음'으로 돌려준다.
      return new Response(head ? null : noticePage('not_found', pageUrl), {
        status: 404,
        headers: { ...HTML, 'cache-control': 'no-store' },
      });
    }

    if (!head) ctx.waitUntil(countView(env, slug));
    const html = renderInvitationPage({
      kind: inv.kind,
      templateId: inv.template_id,
      content: inv.content,
      url: pageUrl,
      assetUrl: assetUrlFor(env),
      guestbook,
      guestbookEndpoint: { supabaseUrl: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY, slug },
    });
    return new Response(head ? null : html, {
      status: 200,
      // 짧게만 캐시한다. 내리기·수정이 1분 안에 보여야 한다.
      // 방명록이 남긴 직후 새로고침에서 보여야 한다. 캐시는 20초.
      headers: { ...HTML, 'cache-control': 'public, max-age=20' },
    });
  },
};
