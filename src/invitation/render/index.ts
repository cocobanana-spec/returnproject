// 청첩장·부고장 공개 페이지를 통째로 만든다 — 종류·템플릿에 맞는 본문을 고르고 문서 껍데기에 넣는다
//
// 워커는 renderInvitationPage 의 결과를 그대로 응답한다. 앱은 같은 결과를 웹뷰 미리보기에 넣는다.
// 템플릿 id 를 모르면 'basic' 으로 그린다 — 공개 페이지가 빈 화면으로 죽는 것보다 낫다.
import {
  shareTitle,
  type FuneralContent,
  type InvitationContent,
  type InvitationKind,
  type WeddingContent,
} from '../../domain/invitation.ts';
import { FUNERAL_BASIC_CSS, renderFuneralBody } from './funeral.ts';
import { COPY_SCRIPT, document, koreanDate, koreanTime, guestbookForm, guestbookScript, marquee, noticePage, tFor, type GuestbookEndpoint, type GuestbookMessage } from './html.ts';
import { SPRING_CSS, SPRING_FONTS, renderSpringBody, springScript } from './spring.ts';
import { WEDDING_BASIC_CSS, renderWeddingBody, type AssetUrl } from './wedding.ts';

export { noticePage } from './html.ts';

// 샘플 페이지 띠 — 왼쪽 아래에 작게 고정(위는 전광판·인트로와 겹친다). 인트로보다 위에 뜬다
const DEMO_BADGE = '<div style="position:fixed;bottom:calc(18px + env(safe-area-inset-bottom));left:16px;z-index:80;background:rgba(25,31,40,.78);color:#fff;font:600 12px/1 -apple-system,sans-serif;padding:8px 14px;border-radius:999px;letter-spacing:.02em">샘플 청첩장 · 뿌린대로거두리라</div>';

export type RenderInput = {
  kind: InvitationKind;
  templateId: string;
  content: InvitationContent;
  // 이 페이지의 절대 주소. OG 태그에 쓴다.
  url: string;
  // 스토리지 경로 → 공개 URL
  assetUrl: AssetUrl;
  // 방명록. 메시지 목록과, 남기기 요청을 보낼 곳. 둘 다 없으면 방명록 없이 그린다(앱 미리보기).
  guestbook?: GuestbookMessage[];
  guestbookEndpoint?: GuestbookEndpoint;
  // 샘플 페이지 — 방명록·참석 여부를 눌러 볼 수 있지만 보내지 않는다. 맨 위에 '샘플' 띠를 둔다
  demo?: boolean;
};

// 미리보기(OG)에 쓸 한 줄 설명. 카카오톡 미리보기의 둘째 줄이다.
export function shareDescription(kind: InvitationKind, content: InvitationContent): string {
  if (kind === 'wedding') {
    const c = content as WeddingContent;
    // 카카오톡 미리보기 둘째 줄 — '2026년 10월 11일 일요일 오전 11시 · 더컨벤션 영등포 2층 다이너스티홀'
    const locale = c.lang ?? 'ko';
    const venue = [c.venue.name, c.venue.hall].filter((v) => v && v.trim()).join(' ');
    return `${koreanDate(c.date, locale)} ${koreanTime(c.time, locale)} · ${venue}`;
  }
  const c = content as FuneralContent;
  return `빈소 ${c.mortuary.name} · 발인 ${c.funeralAt}`;
}

export function renderInvitationPage(input: RenderInput): string {
  const { kind, templateId, content, url, assetUrl, guestbook, guestbookEndpoint, demo = false } = input;
  const badge = demo ? DEMO_BADGE : '';
  const locale = content.lang ?? 'ko';
  const t = tFor(locale);
  const title = shareTitle(kind, content);
  const description = shareDescription(kind, content);
  // 방명록은 끝점이 있을 때만(공개 페이지). 전광판은 맨 위, 입력칸은 맨 아래.
  const top = guestbookEndpoint ? marquee(guestbook ?? [], t) : '';
  const bottom = guestbookEndpoint ? guestbookForm((guestbook ?? []).length, t) : '';
  const script = COPY_SCRIPT + (guestbookEndpoint ? guestbookScript(guestbookEndpoint, demo) : '');

  if (kind === 'wedding' && templateId === 'spring') {
    // 봄 — 방명록은 맨 아래 카드 목록이라 전광판을 두지 않는다. 인트로와 겹친다.
    const c = content as WeddingContent;
    // 미리보기 제목도 레퍼런스처럼 '준건, 소영 결혼합니다 💗'
    const springTitle = (c.lang ?? 'ko') === 'ko' ? `${c.groom.name}, ${c.bride.name} 결혼합니다 💗` : title;
    return document(
      { title: springTitle, description, url, image: c.cover ? assetUrl(c.cover) : undefined, head: SPRING_FONTS },
      SPRING_CSS,
      badge + renderSpringBody(c, assetUrl, { guestbook, guestbookEndpoint }),
      COPY_SCRIPT + springScript(guestbookEndpoint, demo),
      t('inv.invitationNoun'),
      locale,
    );
  }
  if (kind === 'wedding') {
    const c = content as WeddingContent;
    return document(
      { title, description, url, image: c.cover ? assetUrl(c.cover) : undefined },
      WEDDING_BASIC_CSS,
      badge + top + renderWeddingBody(c, assetUrl) + bottom,
      script,
      t('inv.invitationNoun'),
      locale,
    );
  }
  const c = content as FuneralContent;
  return document({ title, description, url }, FUNERAL_BASIC_CSS, top + renderFuneralBody(c) + bottom, script, t('inv.funeral'), locale);
}
