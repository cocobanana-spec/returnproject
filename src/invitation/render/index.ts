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
import { COPY_SCRIPT, document, noticePage } from './html.ts';
import { WEDDING_BASIC_CSS, renderWeddingBody, type AssetUrl } from './wedding.ts';

export { noticePage } from './html.ts';

export type RenderInput = {
  kind: InvitationKind;
  templateId: string;
  content: InvitationContent;
  // 이 페이지의 절대 주소. OG 태그에 쓴다.
  url: string;
  // 스토리지 경로 → 공개 URL
  assetUrl: AssetUrl;
};

// 미리보기(OG)에 쓸 한 줄 설명. 카카오톡 미리보기의 둘째 줄이다.
export function shareDescription(kind: InvitationKind, content: InvitationContent): string {
  if (kind === 'wedding') {
    const c = content as WeddingContent;
    return `${c.date} ${c.time} · ${c.venue.name}`;
  }
  const c = content as FuneralContent;
  return `빈소 ${c.mortuary.name} · 발인 ${c.funeralAt}`;
}

export function renderInvitationPage(input: RenderInput): string {
  const { kind, content, url, assetUrl } = input;
  const title = shareTitle(kind, content);
  const description = shareDescription(kind, content);

  if (kind === 'wedding') {
    const c = content as WeddingContent;
    return document(
      { title, description, url, image: c.cover ? assetUrl(c.cover) : undefined },
      WEDDING_BASIC_CSS,
      renderWeddingBody(c, assetUrl),
      COPY_SCRIPT,
    );
  }
  const c = content as FuneralContent;
  return document({ title, description, url }, FUNERAL_BASIC_CSS, renderFuneralBody(c), COPY_SCRIPT, '부고장');
}
