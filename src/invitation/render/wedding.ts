// 청첩장 템플릿 'basic' — 단정한 흰색. 내용 → 본문 HTML + 이 템플릿만의 CSS
//
// 칸은 src/domain/invitation.ts 의 WeddingContent 로 고정이다. 템플릿은 보여 주는 방식만 다르다.
import type { WeddingContent } from '../../domain/invitation.ts';
import { accountRow, esc, koreanDate, koreanTime, mapLinks, tFor, type T } from './html.ts';
import type { Locale } from '../../i18n/dict.ts';

// 스토리지 경로 → 공개 URL 은 부르는 쪽이 정한다(워커와 앱의 베이스가 다르다).
export type AssetUrl = (storagePath: string) => string;

function parents(p: { father?: string; mother?: string }, child: string, role: string, t: T): string {
  const names = [p.father, p.mother].filter((v) => v && v.trim()).map((v) => esc(v));
  if (names.length === 0) return `<p><strong>${esc(child)}</strong> <span class="muted">${esc(role)}</span></p>`;
  return `<p>${t('inv.ofParents', { parents: names.join(' · '), role: esc(role), name: `<strong>${esc(child)}</strong>` })}</p>`;
}

export function renderWeddingBody(c: WeddingContent, assetUrl: AssetUrl): string {
  const locale: Locale = c.lang ?? 'ko';
  const t = tFor(locale);
  const cover = c.cover ? `<img class="cover" src="${esc(assetUrl(c.cover))}" alt="">` : '';
  const gallery =
    c.gallery && c.gallery.length
      ? `<section><h2>${esc(t('inv.gallery'))}</h2><div class="gallery">${c.gallery
          .map((g) => `<img src="${esc(assetUrl(g))}" alt="" loading="lazy">`)
          .join('')}</div></section>`
      : '';
  const greeting = c.greeting
    ? `<section class="greeting"><h2>${esc(t('inv.invitationHeading'))}</h2><p>${esc(c.greeting).replace(/\n/g, '<br>')}</p></section>`
    : '';
  const groomAccounts = (c.accounts ?? []).filter((a) => a.side === 'groom');
  const brideAccounts = (c.accounts ?? []).filter((a) => a.side === 'bride');
  const accounts =
    groomAccounts.length || brideAccounts.length
      ? `<section><h2>${esc(t('inv.accounts'))}</h2>
        ${groomAccounts.length ? `<h3>${esc(t('inv.groomSide'))}</h3>${groomAccounts.map((a) => accountRow(a, t)).join('')}` : ''}
        ${brideAccounts.length ? `<h3>${esc(t('inv.brideSide'))}</h3>${brideAccounts.map((a) => accountRow(a, t)).join('')}` : ''}
      </section>`
      : '';
  const contact =
    c.contact?.groom || c.contact?.bride
      ? `<section><h2>${esc(t('inv.contact'))}</h2>
        ${c.contact.groom ? `<p>${esc(t('inv.groom'))} <a href="tel:${esc(c.contact.groom)}">${esc(c.contact.groom)}</a></p>` : ''}
        ${c.contact.bride ? `<p>${esc(t('inv.bride'))} <a href="tel:${esc(c.contact.bride)}">${esc(c.contact.bride)}</a></p>` : ''}
      </section>`
      : '';
  const venueQuery = c.venue.address?.trim() || c.venue.name;

  return `
${cover}
<section class="hero">
  <h2>${esc(t('inv.weddingHeading'))}</h2>
  <h1>${esc(c.groom.name)} <span class="amp">&amp;</span> ${esc(c.bride.name)}</h1>
  <p class="when">${esc(koreanDate(c.date, locale))}<br>${esc(koreanTime(c.time, locale))}</p>
  <p class="where">${esc(c.venue.name)}${c.venue.hall ? ` ${esc(c.venue.hall)}` : ''}</p>
</section>
${greeting}
<section class="family">
  ${parents(c.groom, c.groom.name, t('inv.son'), t)}
  ${parents(c.bride, c.bride.name, t('inv.daughter'), t)}
</section>
<section>
  <h2>${esc(t('inv.directions'))}</h2>
  <p><strong>${esc(c.venue.name)}</strong>${c.venue.hall ? ` · ${esc(c.venue.hall)}` : ''}</p>
  ${c.venue.address ? `<p class="muted">${esc(c.venue.address)}</p>` : ''}
  ${mapLinks(venueQuery, t, locale)}
</section>
${gallery}
${accounts}
${contact}
`;
}

export const WEDDING_BASIC_CSS = `
body{background:#fff;color:#222}
.hero{text-align:center;padding:40px 24px 28px}
.hero h2{color:#999}
.hero h1{font-size:1.9rem;margin:6px 0 14px}
.hero .amp{color:#c9a86a;font-weight:300;margin:0 6px}
.hero .when{font-size:1.05rem}
.hero .where{color:#666}
.greeting{text-align:center;background:#faf8f3}
.greeting p{line-height:1.9}
.family{text-align:center;color:#444}
h3{font-size:0.95rem;margin:14px 0 4px;color:#666}
`;
