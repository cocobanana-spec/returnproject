// 부고장 템플릿 'basic' — 흰 바탕. 내용 → 본문 HTML + 이 템플릿만의 CSS
//
// 부고는 급하다. 상주가 10분 안에 만들어야 하므로 칸이 적고(docs/08 §3.1), 템플릿도 말이 적다.
// 관행대로 고인·상주·빈소·발인·장지·계좌 순서다.
import type { FuneralContent } from '../../domain/invitation.ts';
import { accountRow, esc, koreanDateTime, mapLinks, tFor } from './html.ts';
import type { Locale } from '../../i18n/dict.ts';

export function renderFuneralBody(c: FuneralContent): string {
  const locale: Locale = c.lang ?? 'ko';
  const t = tFor(locale);
  const mourners = c.chiefMourners
    .map((m) => `<li><span class="rel">${esc(m.relation)}</span> ${esc(m.name)}</li>`)
    .join('');
  const accounts = c.accounts?.length
    ? `<section><h2>${esc(t('inv.condolenceAccounts'))}</h2>${c.accounts.map((a) => accountRow(a, t)).join('')}</section>`
    : '';
  const title = c.deceased.title ? `${esc(c.deceased.title)} ` : '';
  const age = c.deceased.age ? ` <span class="muted">(${esc(t('inv.age', { age: c.deceased.age }))})</span>` : '';
  const mortuaryQuery = c.mortuary.address?.trim() || c.mortuary.name;

  return `
<section class="hero">
  <h2>${esc(t('inv.obituary'))}</h2>
  <h1>${title}故 ${esc(c.deceased.name)}${age}</h1>
  ${c.passedAt ? `<p class="muted">${esc(t('inv.passedAway', { when: koreanDateTime(c.passedAt, locale) }))}</p>` : `<p class="muted">${esc(t('inv.passedAwayNoTime'))}</p>`}
</section>
${c.note ? `<section class="note"><p>${esc(c.note).replace(/\n/g, '<br>')}</p></section>` : ''}
<section>
  <h2>${esc(t('inv.mourners'))}</h2>
  <ul class="mourners">${mourners}</ul>
</section>
<section>
  <h2>${esc(t('inv.mortuary'))}</h2>
  <p><strong>${esc(c.mortuary.name)}</strong>${c.mortuary.room ? ` ${esc(c.mortuary.room)}` : ''}</p>
  ${c.mortuary.address ? `<p class="muted">${esc(c.mortuary.address)}</p>` : ''}
  ${mapLinks(mortuaryQuery, t, locale)}
</section>
<section>
  <h2>${esc(t('inv.funeralTime'))}</h2>
  <p>${esc(koreanDateTime(c.funeralAt, locale))}</p>
  ${c.burialPlace ? `<p class="muted">${esc(t('inv.burial', { place: c.burialPlace }))}</p>` : ''}
</section>
${accounts}
${c.contact ? `<section><h2>${esc(t('inv.contact'))}</h2><p><a href="tel:${esc(c.contact)}">${esc(c.contact)}</a></p></section>` : ''}
`;
}

export const FUNERAL_BASIC_CSS = `
body{background:#fff;color:#1a1a1a}
.hero{text-align:center;padding:44px 24px 24px;border-bottom:1px solid #e8e8e8}
.hero h2{color:#777;letter-spacing:0.3em}
.hero h1{font-size:1.6rem;margin:8px 0 12px}
.note{background:#f6f6f6}
.mourners{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,1fr);gap:4px 12px}
.mourners .rel{color:#777;margin-right:6px}
h2{color:#777}
`;
