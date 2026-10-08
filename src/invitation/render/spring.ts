// 청첩장 템플릿 'spring'(봄) — 인트로 손글씨 → 사진, 종이 질감·명조체, 달력·카운트다운, 교통 안내, 참석 여부, 방명록 카드
//
// 2026-10-07 사장님 레퍼런스(살롱드레터 청첩장)를 따라 만들었다. 칸은 WeddingContent 그대로이고 봄 전용 칸
// (intro·parentPhones·transport·venue.phone·rsvp)을 더 읽는다. 다른 템플릿은 그 칸을 무시한다.
//
// 외부 자원: 이 템플릿만 구글 폰트 두 벌(나눔명조, Allura)을 싣는다(사장님 허용, 링크는 themes.ts THEME_FONTS). 글꼴이 늦게 와도
// font-display=swap 이라 글자는 바로 보인다. 지도 이미지는 넣지 않는다(지도 API 키 필요 — 앱 열기 버튼만).
//
// 인트로(3~4초): 어두운 판 위에 문구가 왼쪽부터 써지고(clip-path), 판이 걷히면 표지 사진이 드러나며
// 스크롤이 풀린다. 자바스크립트가 없어도 CSS 애니메이션만으로 끝까지 가고(스크롤 잠금은 JS 가 거는 것이라
// 없으면 처음부터 스크롤된다), '동작 줄이기' 설정이면 인트로를 건너뛴다.
import type { WeddingContent } from '../../domain/invitation.ts';
import type { Locale } from '../../i18n/dict.ts';
import { accountRow, attr, esc, koreanDate, koreanTime, tFor, type GuestbookEndpoint, type GuestbookMessage } from './html.ts';
import type { AssetUrl } from './wedding.ts';

// 템플릿 안에서만 쓰는 문구. 공용 사전(dict.ts)에 넣지 않는다 — 다른 화면이 쓰지 않는다.
const S = {
  ko: {
    invite: '소중한 분들을 초대합니다.',
    contactParents: '혼주에게 연락하기',
    groomSide: '신랑측', brideSide: '신부측',
    father: '아버지', mother: '어머니', son: '아들', daughter: '딸', of: '의',
    until: '결혼식까지', days: 'Days', hours: 'Hours', minutes: 'Minutes', seconds: 'Seconds', passed: '함께해 주셔서 감사합니다',
    gallery: '갤러리', directions: '오시는 길', bus: '버스', subway: '지하철', car: '자차',
    rsvpTitle: '참석 여부 전달', rsvpBody: '소중한 시간을 내어 결혼식에\n참석해 주시는 모든 분들께 감사드립니다.\n참석 여부를 회신해 주시면\n더욱 감사하겠습니다.',
    rsvpButton: '참석 여부 전달', attend: '참석', absent: '불참', name: '성함', partySize: '본인 포함 인원', meal: '식사',
    mealYes: '예정', mealNo: '안 함', mealUnknown: '미정', messageOpt: '전하실 말씀 (선택)', send: '보내기', close: '닫기',
    sending: '보내는 중…', sent: '전해 드렸어요. 감사합니다.', failed: '보내지 못했어요. 잠시 뒤 다시 해 주세요.', fill: '측과 성함, 참석 여부를 골라 주세요.',
    accounts: '마음 전하실 곳', guestbook: '방명록', all: '전체보기', write: '작성', gbName: '이름', gbMessage: '축하의 한마디',
    gbEmpty: '첫 축하를 남겨 주세요.', gbSent: '남겨 주셔서 고마워요.', top: '맨 위로', share: '공유', copied: '주소를 복사했어요.',
    tmap: '티맵', kakao: '카카오맵', naver: '네이버지도', google: '구글 지도',
  },
  en: {
    invite: 'We invite you to celebrate with us.',
    contactParents: 'Contact the families',
    groomSide: "Groom's side", brideSide: "Bride's side",
    father: 'father', mother: 'mother', son: 'Son', daughter: 'Daughter', of: 'of',
    until: 'until the wedding', days: 'Days', hours: 'Hours', minutes: 'Minutes', seconds: 'Seconds', passed: 'Thank you for celebrating with us',
    gallery: 'Gallery', directions: 'Directions', bus: 'Bus', subway: 'Subway', car: 'By car',
    rsvpTitle: 'RSVP', rsvpBody: 'Thank you for making time for our wedding.\nPlease let us know if you can join us.',
    rsvpButton: 'Send RSVP', attend: 'Attending', absent: 'Not attending', name: 'Name', partySize: 'Guests (incl. you)', meal: 'Meal',
    mealYes: 'Yes', mealNo: 'No', mealUnknown: 'Not sure', messageOpt: 'Message (optional)', send: 'Send', close: 'Close',
    sending: 'Sending…', sent: 'Thank you, we got it.', failed: 'Could not send. Please try again.', fill: 'Choose a side, your name and attendance.',
    accounts: 'Gift accounts', guestbook: 'Guestbook', all: 'See all', write: 'Write', gbName: 'Name', gbMessage: 'Your message',
    gbEmpty: 'Be the first to leave a message.', gbSent: 'Thank you for your message.', top: 'Top', share: 'Share', copied: 'Link copied.',
    tmap: 'TMAP', kakao: 'Kakao Map', naver: 'Naver Map', google: 'Google Maps',
  },
  ja: {
    invite: '大切な皆さまをご招待いたします。',
    contactParents: 'ご両家への連絡',
    groomSide: '新郎側', brideSide: '新婦側',
    father: '父', mother: '母', son: '長男', daughter: '長女', of: 'の',
    until: '結婚式まで', days: 'Days', hours: 'Hours', minutes: 'Minutes', seconds: 'Seconds', passed: 'ご参列ありがとうございました',
    gallery: 'ギャラリー', directions: 'アクセス', bus: 'バス', subway: '地下鉄', car: 'お車',
    rsvpTitle: 'ご出欠', rsvpBody: 'ご多用のところ恐縮ですが\nご出欠をお知らせいただけますと幸いです。',
    rsvpButton: '出欠を送る', attend: '出席', absent: '欠席', name: 'お名前', partySize: '人数(ご本人含む)', meal: 'お食事',
    mealYes: 'あり', mealNo: 'なし', mealUnknown: '未定', messageOpt: 'メッセージ(任意)', send: '送信', close: '閉じる',
    sending: '送信中…', sent: 'ありがとうございます。', failed: '送信できませんでした。', fill: '側・お名前・出欠を選んでください。',
    accounts: 'ご祝儀の送り先', guestbook: '芳名帳', all: 'すべて見る', write: '書く', gbName: 'お名前', gbMessage: 'お祝いのひとこと',
    gbEmpty: '最初のお祝いを残してください。', gbSent: 'ありがとうございます。', top: 'トップへ', share: '共有', copied: 'リンクをコピーしました。',
    tmap: 'TMAP', kakao: 'カカオマップ', naver: 'NAVERマップ', google: 'Googleマップ',
  },
} as const;
type Strings = (typeof S)['ko'];

// 달 이름 — '시월', '유월'처럼 읽는 대로
const MONTH_KO = ['일월', '이월', '삼월', '사월', '오월', '유월', '칠월', '팔월', '구월', '시월', '십일월', '십이월'];
const ORD_ONES = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉'];
const ORD_TENS = ['', '열', '스물', '서른'];

// 1 → '첫 번째', 11 → '열한 번째', 20 → '스무 번째', 21 → '스물한 번째', 31 → '서른한 번째'
export function koreanOrdinalDay(n: number): string {
  if (n === 1) return '첫 번째';
  if (n === 20) return '스무 번째';
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${ORD_TENS[tens]}${ORD_ONES[ones]} 번째`;
}

const WEEK_HEAD: Record<Locale, string[]> = {
  ko: ['일', '월', '화', '수', '목', '금', '토'],
  en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  ja: ['日', '月', '火', '水', '木', '金', '土'],
};

// 그 달의 달력. 예식일에 동그라미와 시간
export function calendarHtml(ymd: string, hm: string, locale: Locale): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return '';
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const first = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay();
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const cells: string[] = [];
  for (let i = 0; i < first; i++) cells.push('<span></span>');
  for (let day = 1; day <= last; day++) {
    const wd = (first + day - 1) % 7;
    if (day === d) {
      cells.push(`<span class="on${wd === 0 ? ' sun' : ''}"><b>${day}</b><small>${esc(koreanTime(hm, locale))}</small></span>`);
    } else {
      cells.push(`<span${wd === 0 ? ' class="sun"' : ''}>${day}</span>`);
    }
  }
  const title =
    locale === 'ko'
      ? `${MONTH_KO[mo - 1]}의<br>${koreanOrdinalDay(d)} 날.`
      : locale === 'ja'
        ? `${mo}月<br>${d}日。`
        : `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][mo - 1]}<br>the ${d}${d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th'}.`;
  return `<section class="cal reveal">
  <h3 class="cal-title">${title}</h3>
  <div class="cal-grid">
    ${WEEK_HEAD[locale].map((w, i) => `<span class="wk${i === 0 ? ' sun' : ''}">${esc(w)}</span>`).join('')}
    ${cells.join('')}
  </div>
</section>`;
}

function phoneLink(phone: string | undefined): string {
  const p = phone?.trim();
  if (!p) return '';
  return ` <a class="tel" href="tel:${attr(p.replace(/[^0-9+]/g, ''))}" aria-label="${attr(p)}">${PHONE_SVG}</a>`;
}

const PHONE_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z"/></svg>';

function nameLine(parents: { father?: string; mother?: string }, child: string, role: string, phone: string | undefined, s: Strings): string {
  const names = [parents.father, parents.mother].filter((v) => v && v.trim()).map((v) => esc(v));
  const lead = names.length ? `${names.join(' <i>·</i> ')} <span class="of">${esc(s.of)}</span> ` : '';
  return `<p class="nl">${lead}<span class="role">${esc(role)}</span> <strong>${esc(child)}</strong>${phoneLink(phone)}</p>`;
}

function mapButtons(query: string, s: Strings, locale: Locale): string {
  const q = encodeURIComponent(query);
  const google = `<a href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener">${esc(s.google)}</a>`;
  return `<div class="mapbtns">
    ${locale !== 'ko' ? google : `<a href="tmap://search?name=${q}">${esc(s.tmap)}</a>`}
    <a href="https://map.kakao.com/link/search/${q}" target="_blank" rel="noopener">${esc(s.kakao)}</a>
    <a href="https://map.naver.com/p/search/${q}" target="_blank" rel="noopener">${esc(s.naver)}</a>
  </div>`;
}

function multiline(v: string): string {
  return esc(v).replace(/\n/g, '<br>');
}

export type SpringOptions = {
  guestbook?: GuestbookMessage[];
  guestbookEndpoint?: GuestbookEndpoint;
};

// 같은 본문 구조를 쓰는 테마들 — 봄(기본), 브라운(나무·앤티크), 꾸러기(만화). 다른 것은 인트로 모양과 CSS(themes.ts) 뿐이다
export type RichTheme = 'spring' | 'brown' | 'cartoon' | 'game';
export const RICH_THEMES: readonly RichTheme[] = ['spring', 'brown', 'cartoon', 'game'];
export function isRichTheme(id: string): id is RichTheme {
  return (RICH_THEMES as readonly string[]).includes(id);
}

const DEFAULT_INTRO: Record<RichTheme, string> = {
  spring: "We're getting married",
  brown: "We're getting married",
  cartoon: '우리 결혼해요!',
  game: 'WE ARE GETTING MARRIED',
};

function introHtml(theme: RichTheme, text: string): string {
  if (theme === 'brown') {
    // 나무 문 두 짝 — 문구가 금빛으로 써지고 문이 양쪽으로 열린다
    return `<div class="intro brown-intro" id="intro" aria-hidden="true"><div class="door l"></div><div class="door r"></div><p class="script"><span>${esc(text)}</span></p></div>`;
  }
  if (theme === 'cartoon') {
    // 만화 말풍선 — 톡 튀어나오고 글자가 타자 치듯 찍힌 뒤 하트가 터진다
    return `<div class="intro toon-intro" id="intro" aria-hidden="true"><div class="bubble"><span>${esc(text)}</span></div><b class="pow">♥</b></div>`;
  }
  if (theme === 'game') {
    // 게임 시작 화면 — 검은 화면에 픽셀 글자가 찍히고 PRESS START 가 깜박인 뒤 하얗게 번쩍
    return `<div class="intro game-intro" id="intro" aria-hidden="true"><p class="hud">1UP ♥ 000000</p><p class="script"><span>${esc(text)}</span></p><p class="press">▶ PRESS START</p><div class="flash"></div></div>`;
  }
  return `<div class="intro" id="intro" aria-hidden="true"><div class="veil"></div><p class="script"><span>${esc(text)}</span></p></div>`;
}

export function renderSpringBody(c: WeddingContent, assetUrl: AssetUrl, opts: SpringOptions = {}, theme: RichTheme = 'spring'): string {
  const locale: Locale = c.lang ?? 'ko';
  const s: Strings = S[locale] as Strings;
  const t = tFor(locale);
  const intro = (c.intro?.trim() || DEFAULT_INTRO[theme]).slice(0, 60);
  const cover = c.cover ? esc(assetUrl(c.cover)) : '';
  const pp = c.parentPhones ?? {};
  const hasParentPhones = !!(pp.groomFather || pp.groomMother || pp.brideFather || pp.brideMother);

  const groomAccounts = (c.accounts ?? []).filter((a) => a.side === 'groom');
  const brideAccounts = (c.accounts ?? []).filter((a) => a.side === 'bride');
  const accordion = (label: string, cls: string, rows: typeof groomAccounts) =>
    rows.length ? `<details class="acc ${cls}"><summary>${esc(label)}<span class="chev"></span></summary>${rows.map((a) => accountRow(a, t)).join('')}</details>` : '';

  const transport = c.transport ?? {};
  const transportHtml = [
    [s.bus, transport.bus],
    [s.subway, transport.subway],
    [s.car, transport.car],
  ]
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => `<div class="tr"><h4>${esc(k)}</h4><p>${multiline(v!)}</p></div>`)
    .join('');

  const venueQuery = c.venue.address?.trim() || c.venue.name;
  const gb = opts.guestbook ?? [];
  const gbCards = gb
    .map(
      (m, i) => `<div class="gb-card${i >= 3 ? ' more' : ''}"><div class="gb-head"><b>${esc(m.name)}</b>${m.created_at ? `<time>${esc(gbTime(m.created_at))}</time>` : ''}</div><p>${multiline(m.message)}</p></div>`,
    )
    .join('');

  return `
${introHtml(theme, intro)}

${cover ? `<img class="hero" src="${cover}" alt="">` : '<div class="hero blank"></div>'}

<section class="when reveal">
  <p>${esc(koreanDate(c.date, locale))} ${esc(koreanTime(c.time, locale))}</p>
  <p>${esc(c.venue.name)}</p>
  ${c.venue.hall ? `<p>${esc(c.venue.hall)}</p>` : ''}
</section>

<section class="greet reveal">
  <h2 class="g">${esc(s.invite)}</h2>
  ${c.greeting ? `<p class="body">${multiline(c.greeting)}</p>` : ''}
</section>

<section class="names reveal">
  ${nameLine(c.groom, c.groom.name, s.son, c.contact?.groom, s)}
  ${nameLine(c.bride, c.bride.name, s.daughter, c.contact?.bride, s)}
  ${hasParentPhones ? `<button type="button" class="outline" data-open="parents">${esc(s.contactParents)}</button>` : ''}
</section>

${calendarHtml(c.date, c.time, locale)}

<section class="count reveal" data-at="${attr(`${c.date}T${c.time}:00+09:00`)}" data-passed="${attr(s.passed)}">
  <p class="who">${esc(c.groom.name)} <span class="heart">♥</span> ${esc(c.bride.name)} ${esc(s.until)}</p>
  <div class="dials">
    <div><b data-u="d">0</b><small>${esc(s.days)}</small></div>
    <div><b data-u="h">0</b><small>${esc(s.hours)}</small></div>
    <div><b data-u="m">0</b><small>${esc(s.minutes)}</small></div>
    <div><b data-u="s">0</b><small>${esc(s.seconds)}</small></div>
  </div>
</section>

${
  c.gallery && c.gallery.length
    ? `<section class="gal reveal"><h2 class="g">${esc(s.gallery)}</h2><div class="grid">${c.gallery
        .map((g) => `<img src="${esc(assetUrl(g))}" alt="" loading="lazy" data-zoom>`)
        .join('')}</div></section>`
    : ''
}

<section class="way reveal">
  <h2 class="g">${esc(s.directions)}</h2>
  <p class="vn">${esc(c.venue.name)}${phoneLink(c.venue.phone)}</p>
  ${c.venue.hall ? `<p>${esc(c.venue.hall)}</p>` : ''}
  ${c.venue.address ? `<p>${esc(c.venue.address)}</p>` : ''}
  ${mapButtons(venueQuery, s, locale)}
  ${transportHtml ? `<div class="trs">${transportHtml}</div>` : ''}
</section>

${
  c.rsvp && opts.guestbookEndpoint
    ? `<section class="rsvp reveal"><h2 class="g">${esc(s.rsvpTitle)}</h2><p class="body">${multiline(s.rsvpBody)}</p>
  <button type="button" class="dark" data-open="rsvp">${esc(s.rsvpButton)}</button></section>`
    : ''
}

${
  groomAccounts.length || brideAccounts.length
    ? `<section class="gift reveal"><h2 class="g">${esc(s.accounts)}</h2>${accordion(s.groomSide, 'groom', groomAccounts)}${accordion(s.brideSide, 'bride', brideAccounts)}</section>`
    : ''
}

${
  opts.guestbookEndpoint
    ? `<section class="gbs reveal" id="guestbook"><h2 class="g">${esc(s.guestbook)}</h2>
  <div class="gb-list" id="gb-list">${gbCards || `<p class="gb-empty">${esc(s.gbEmpty)}</p>`}</div>
  <div class="gb-actions">${gb.length > 3 ? `<button type="button" class="outline sm" id="gb-all">${esc(s.all)}</button>` : '<span></span>'}<button type="button" class="outline sm" data-open="gb">${esc(s.write)}</button></div>
</section>`
    : ''
}

${hasParentPhones ? sheet('parents', s.contactParents, `
  <h4>${esc(s.groomSide)}</h4>
  ${pp.groomFather ? `<p class="pl">${esc(s.father)} ${esc(c.groom.father ?? '')}${phoneLink(pp.groomFather)}</p>` : ''}
  ${pp.groomMother ? `<p class="pl">${esc(s.mother)} ${esc(c.groom.mother ?? '')}${phoneLink(pp.groomMother)}</p>` : ''}
  <h4>${esc(s.brideSide)}</h4>
  ${pp.brideFather ? `<p class="pl">${esc(s.father)} ${esc(c.bride.father ?? '')}${phoneLink(pp.brideFather)}</p>` : ''}
  ${pp.brideMother ? `<p class="pl">${esc(s.mother)} ${esc(c.bride.mother ?? '')}${phoneLink(pp.brideMother)}</p>` : ''}
`, s) : ''}

${
  c.rsvp && opts.guestbookEndpoint
    ? sheet('rsvp', s.rsvpTitle, `
  <form id="rsvp-form" data-fill="${attr(s.fill)}" data-sending="${attr(s.sending)}" data-sent="${attr(s.sent)}" data-failed="${attr(s.failed)}">
    <div class="seg"><label><input type="radio" name="side" value="groom"><span>${esc(s.groomSide)}</span></label><label><input type="radio" name="side" value="bride"><span>${esc(s.brideSide)}</span></label></div>
    <div class="seg"><label><input type="radio" name="attending" value="yes"><span>${esc(s.attend)}</span></label><label><input type="radio" name="attending" value="no"><span>${esc(s.absent)}</span></label></div>
    <input name="name" maxlength="20" placeholder="${attr(s.name)}" autocomplete="name">
    <div class="only-attend"><label class="row">${esc(s.partySize)} <input name="size" type="number" min="1" max="20" value="1" inputmode="numeric"></label>
    <div class="seg three"><label><input type="radio" name="meal" value="yes"><span>${esc(s.meal)} ${esc(s.mealYes)}</span></label><label><input type="radio" name="meal" value="no"><span>${esc(s.mealNo)}</span></label><label><input type="radio" name="meal" value="unknown"><span>${esc(s.mealUnknown)}</span></label></div></div>
    <textarea name="message" maxlength="200" rows="2" placeholder="${attr(s.messageOpt)}"></textarea>
    <button type="submit" class="dark">${esc(s.send)}</button>
    <p class="note" id="rsvp-note"></p>
  </form>`, s)
    : ''
}

${
  opts.guestbookEndpoint
    ? sheet('gb', s.guestbook, `
  <form id="gbx-form" data-fill="${attr(t('gb.fillBoth'))}" data-sending="${attr(s.sending)}" data-sent="${attr(s.gbSent)}" data-failed="${attr(s.failed)}">
    <input name="name" maxlength="20" placeholder="${attr(s.gbName)}" autocomplete="name">
    <textarea name="message" maxlength="200" rows="4" placeholder="${attr(s.gbMessage)}"></textarea>
    <button type="submit" class="dark">${esc(s.write)}</button>
    <p class="note" id="gbx-note"></p>
  </form>`, s)
    : ''
}

<div class="zoom" id="zoom" hidden><img alt=""></div>
<div class="fabs"><button type="button" id="to-top" aria-label="${attr(s.top)}">${UP_SVG}</button><button type="button" id="share" aria-label="${attr(s.share)}" data-copied="${attr(s.copied)}">${SHARE_SVG}</button></div>
`;
}

const UP_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" d="M6 14l6-6 6 6"/></svg>';
const SHARE_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="18" cy="5" r="2.5" fill="currentColor"/><circle cx="6" cy="12" r="2.5" fill="currentColor"/><circle cx="18" cy="19" r="2.5" fill="currentColor"/><path stroke="currentColor" stroke-width="1.6" d="M8 11l8-5M8 13l8 5"/></svg>';

function sheet(id: string, title: string, inner: string, s: Strings): string {
  return `<div class="sheet" id="sheet-${id}" hidden><div class="sheet-bg" data-close></div><div class="sheet-card" role="dialog" aria-label="${attr(title)}">
  <div class="sheet-head"><b>${esc(title)}</b><button type="button" data-close aria-label="${attr(s.close)}">✕</button></div>${inner}</div></div>`;
}

// 방명록 시각 — '2026.10.02 10:48'(서울 시간)
export function gbTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const k = new Date(d.getTime() + 9 * 3600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${k.getUTCFullYear()}.${p(k.getUTCMonth() + 1)}.${p(k.getUTCDate())} ${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`;
}

// 종이 질감 — 외부 그림 없이 SVG 잡음 한 장
const PAPER = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.45  0 0 0 0 0.44  0 0 0 0 0.42  0 0 0 0.09 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;

export const SPRING_CSS = `
:root{--ink:#333;--green:#3e5b3c;--rose:#b4656c;--line:#2f4a2d}
body{background:#f6f5f1 ${PAPER};color:var(--ink);font-family:"Nanum Myeongjo",serif;font-size:17px;line-height:1.9}
.page{max-width:480px;padding:0}
section{padding:56px 28px;text-align:center}
h2.g{color:var(--green);font-size:1.45rem;letter-spacing:0.02em;text-transform:none;font-weight:400;margin:0 0 28px}
.body{line-height:2.1;margin:0}
.hero{width:100%;height:100svh;object-fit:cover;display:block}
.hero.blank{background:#d8d6cf}
.when{padding:40px 28px}
.when p{margin:0;line-height:1.9;font-size:1.05rem}
.when{border-top:1.5px solid #222;border-bottom:1.5px solid #222;margin:40px 44px 0;padding:20px 0}
.names .nl{margin:0 0 18px;font-size:1.05rem}
.names i{font-style:normal;opacity:.6;margin:0 4px}
.names .of{opacity:.75;margin-right:6px}
.names .role{opacity:.75;margin-right:8px}
a.tel{color:inherit;display:inline-flex;vertical-align:-3px;margin-left:8px}
button{font-family:inherit;cursor:pointer}
button.outline{background:transparent;border:1px solid #cfccc4;border-radius:4px;padding:14px 40px;font-size:1rem;color:#555;margin-top:28px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
button.outline.sm{padding:10px 26px;margin:0}
button.dark{background:#262626;color:#fff;border:0;border-radius:4px;padding:16px 56px;font-size:1rem;margin-top:36px}
.cal{text-align:left;padding:56px 22px}
.cal-title{color:var(--green);font-weight:400;font-size:2rem;line-height:1.45;margin:0 0 20px 12px}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);border-top:3px solid var(--line);border-bottom:3px solid var(--line);padding:18px 0 26px;row-gap:22px;text-align:center;font-family:-apple-system,"Apple SD Gothic Neo",sans-serif;font-size:1.05rem;color:#444}
.cal-grid .wk{font-weight:600}
.cal-grid .wk.sun{color:var(--green)}
.cal-grid span{position:relative;line-height:2.4}
.cal-grid .on b{display:inline-grid;place-items:center;width:2.4em;height:2.4em;border-radius:50%;background:#262626;color:#fff;font-weight:400}
.cal-grid .on small{position:absolute;left:50%;top:100%;transform:translateX(-50%);white-space:nowrap;font-size:.72rem;line-height:1.2;color:#333}
.count .who{font-size:1.1rem;margin-bottom:26px}
.count .heart{color:#222}
.dials{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.dials div{display:grid;justify-items:center;gap:8px}
.dials b{display:grid;place-items:center;width:64px;height:64px;border-radius:50%;background:#262626;color:#fff;font-weight:400;font-size:1.35rem;font-family:-apple-system,sans-serif;font-variant-numeric:tabular-nums}
.dials small{font-family:-apple-system,sans-serif;font-size:.8rem;color:#555}
.gal{padding:56px 0}
.gal .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}
.gal img{width:100%;aspect-ratio:1;object-fit:cover;display:block;cursor:zoom-in}
.way .vn{font-size:1.1rem}
.way p{margin:0 0 10px}
.mapbtns{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:28px}
.mapbtns a{padding:14px 4px;background:rgba(255,255,255,.55);box-shadow:0 1px 3px rgba(0,0,0,.08);color:#444;text-decoration:none;font-size:.92rem;font-family:-apple-system,sans-serif}
.trs{text-align:left;margin-top:40px}
.tr{margin-bottom:34px}
.tr h4{color:var(--green);font-weight:400;font-size:1.15rem;margin:0 0 12px}
.tr p{margin:0;font-family:-apple-system,"Apple SD Gothic Neo",sans-serif;font-size:.98rem;line-height:2}
.acc{border:1px solid #d9d6ce;border-radius:4px;margin:0 -12px 14px;background:rgba(255,255,255,.35);text-align:left;box-shadow:0 1px 2px rgba(0,0,0,.05)}
.acc summary{list-style:none;padding:18px 22px;font-size:1.15rem;display:flex;justify-content:space-between;align-items:center;cursor:pointer}
.acc summary::-webkit-details-marker{display:none}
.acc.groom summary{color:var(--green)}
.acc.bride summary{color:var(--rose)}
.acc .chev{width:10px;height:10px;border-right:1.5px solid #888;border-bottom:1.5px solid #888;transform:rotate(45deg);margin-top:-6px;transition:transform .2s}
.acc[open] .chev{transform:rotate(-135deg);margin-top:4px}
.acc .account{padding:12px 22px;font-family:-apple-system,sans-serif;font-size:.95rem}
.gbs{padding:56px 22px}
.gb-card{background:rgba(255,255,255,.55);box-shadow:0 1px 4px rgba(0,0,0,.07);border-radius:4px;padding:22px 24px;margin-bottom:18px;text-align:left}
.gb-card.more{display:none}
.gbs.all .gb-card.more{display:block}
.gb-head{display:flex;align-items:baseline;gap:14px;margin-bottom:10px}
.gb-head b{color:var(--green);font-weight:400;font-size:1.15rem}
.gb-head time{font-family:-apple-system,sans-serif;font-size:.82rem;color:#666}
.gb-card p{margin:0;font-family:-apple-system,"Apple SD Gothic Neo",sans-serif;font-size:.98rem;line-height:1.9}
.gb-empty{opacity:.7}
.gb-actions{display:flex;justify-content:space-between;margin-top:10px}
.reveal{opacity:0;transform:translateY(18px);transition:opacity .8s ease,transform .8s ease}
.reveal.in{opacity:1;transform:none}
.intro{position:fixed;inset:0;z-index:50;display:grid;place-items:center;pointer-events:none;animation:intro-out .9s ease 3.1s forwards}
.intro .veil{position:absolute;inset:0;background:rgba(28,26,24,.55)}
.intro .script{position:relative;margin:0;font-family:"Allura",cursive;font-size:min(3.2rem,10.5vw);white-space:nowrap;line-height:1.2;color:#f5ecd6;text-align:center;padding:0 24px;text-shadow:0 1px 8px rgba(0,0,0,.25)}
.intro .script span{display:inline-block;clip-path:inset(0 100% 0 0);animation:write 2.4s cubic-bezier(.45,.1,.4,1) .35s forwards}
@keyframes write{to{clip-path:inset(0 0 0 0)}}
@keyframes intro-out{to{opacity:0;visibility:hidden}}
body.locked{overflow:hidden}
@media (prefers-reduced-motion: reduce){.intro{display:none}.reveal{opacity:1;transform:none}}
.sheet{position:fixed;inset:0;z-index:60;display:grid;align-items:end}
.sheet[hidden]{display:none}
.sheet-bg{position:absolute;inset:0;background:rgba(0,0,0,.35)}
.sheet-card{position:relative;background:#fbfaf7;border-radius:16px 16px 0 0;padding:20px 24px calc(28px + env(safe-area-inset-bottom));max-width:480px;width:100%;margin:0 auto;max-height:85vh;overflow:auto;font-family:-apple-system,"Apple SD Gothic Neo",sans-serif;font-size:1rem;text-align:left}
.sheet-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
.sheet-head button{background:none;border:0;font-size:1.1rem;color:#666}
.sheet-card h4{color:var(--green);margin:16px 0 6px;font-weight:600}
.sheet-card .pl{margin:0 0 6px}
.sheet-card form{display:grid;gap:12px}
.sheet-card input[name=name],.sheet-card textarea,.sheet-card input[type=number]{font:inherit;padding:12px 14px;border:1px solid #d9d6ce;border-radius:8px;background:#fff;color:inherit}
.sheet-card input[type=number]{width:84px;margin-left:10px}
.sheet-card .row{display:flex;align-items:center;justify-content:space-between}
.seg{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.seg.three{grid-template-columns:1fr 1fr 1fr;margin-top:12px}
.seg input{position:absolute;opacity:0}
.seg span{display:block;text-align:center;padding:12px 6px;border:1px solid #d9d6ce;border-radius:8px;background:#fff}
.seg input:checked+span{background:#262626;color:#fff;border-color:#262626}
.sheet-card button.dark{margin-top:6px;width:100%}
.note{font-size:.9rem;min-height:1.2em;margin:0;color:#555}
form.absent .only-attend{display:none}
.zoom{position:fixed;inset:0;z-index:70;background:rgba(0,0,0,.92);display:grid;place-items:center}
.zoom[hidden]{display:none}
.zoom img{max-width:100%;max-height:100%}
.fabs{position:fixed;right:16px;bottom:calc(20px + env(safe-area-inset-bottom));display:grid;gap:12px;z-index:40}
.fabs button{width:52px;height:52px;border-radius:50%;border:0;background:rgba(235,233,228,.9);color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.12);display:grid;place-items:center}
.footer{font-family:-apple-system,sans-serif}
`;

// 인트로·등장·카운트다운·시트·확대·공유·참석·방명록. 남기기 요청은 anon 키로 함수만 부른다.
export function springScript(ep: GuestbookEndpoint | undefined, demo = false): string {
  // demo(샘플 페이지)는 보낸 척만 한다
  const call = demo
    ? 'function rpc(){ return Promise.resolve(null); } var SLUG="";'
    : ep
    ? `function rpc(fn,body){ return fetch(${JSON.stringify(ep.supabaseUrl)}+'/rest/v1/rpc/'+fn,{method:'POST',headers:{'apikey':${JSON.stringify(ep.anonKey)},'Authorization':'Bearer '+${JSON.stringify(ep.anonKey)},'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){ if(!r.ok) throw new Error(String(r.status)); return r.json(); }); }
  var SLUG=${JSON.stringify(ep.slug)};`
    : 'function rpc(){ return Promise.reject(new Error("preview")); } var SLUG="";';
  return `<script>
(function(){
  ${call}
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 인트로 동안 스크롤을 잠근다(JS 가 있을 때만). 3.6초 뒤 풀고 인트로를 걷어 낸다.
  var intro=document.getElementById('intro');
  if(intro&&!reduce){ document.body.classList.add('locked'); setTimeout(function(){ document.body.classList.remove('locked'); intro.remove(); },3700); }
  else if(intro){ intro.remove(); }
  // 화면에 들어오면 떠오른다
  var els=document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window&&!reduce){ var io=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } }); },{rootMargin:'0px 0px -10% 0px'}); els.forEach(function(e){ io.observe(e); }); }
  else els.forEach(function(e){ e.classList.add('in'); });
  // 카운트다운
  var cd=document.querySelector('.count');
  if(cd){ var at=Date.parse(cd.getAttribute('data-at')); var u={}; cd.querySelectorAll('[data-u]').forEach(function(b){ u[b.getAttribute('data-u')]=b; });
    function tick(){ var ms=at-Date.now(); if(!(ms>0)){ cd.querySelector('.dials').outerHTML='<p>'+cd.getAttribute('data-passed')+'</p>'; return; }
      var s=Math.floor(ms/1000); u.d.textContent=Math.floor(s/86400); u.h.textContent=Math.floor(s%86400/3600); u.m.textContent=Math.floor(s%3600/60); u.s.textContent=s%60; setTimeout(tick,1000); }
    if(!isNaN(at)) tick(); }
  // 시트 열고 닫기
  document.addEventListener('click',function(e){
    var o=e.target.closest&&e.target.closest('[data-open]'); if(o){ var sh=document.getElementById('sheet-'+o.getAttribute('data-open')); if(sh) sh.hidden=false; return; }
    var c=e.target.closest&&e.target.closest('[data-close]'); if(c){ var p=c.closest('.sheet'); if(p) p.hidden=true; return; }
    var z=e.target.closest&&e.target.closest('img[data-zoom]'); if(z){ var zm=document.getElementById('zoom'); zm.querySelector('img').src=z.src; zm.hidden=false; return; }
    if(e.target.closest&&e.target.closest('#zoom')){ document.getElementById('zoom').hidden=true; }
  });
  var top=document.getElementById('to-top'); if(top) top.addEventListener('click',function(){ window.scrollTo({top:0,behavior:'smooth'}); });
  var sh=document.getElementById('share'); if(sh) sh.addEventListener('click',function(){ var url=location.href; if(navigator.share){ navigator.share({title:document.title,url:url}).catch(function(){}); } else if(navigator.clipboard){ navigator.clipboard.writeText(url).then(function(){ alert(sh.getAttribute('data-copied')); }); } });
  var all=document.getElementById('gb-all'); if(all) all.addEventListener('click',function(){ document.getElementById('guestbook').classList.add('all'); all.remove(); });
  // 참석 여부
  var rf=document.getElementById('rsvp-form');
  if(rf){ var rn=document.getElementById('rsvp-note');
    rf.addEventListener('change',function(){ var a=rf.querySelector('input[name=attending]:checked'); rf.classList.toggle('absent',!!a&&a.value==='no'); });
    rf.addEventListener('submit',function(e){ e.preventDefault();
      var side=(rf.querySelector('input[name=side]:checked')||{}).value, att=(rf.querySelector('input[name=attending]:checked')||{}).value, name=rf.name.value.trim();
      if(!side||!att||!name){ rn.textContent=rf.getAttribute('data-fill'); return; }
      var meal=(rf.querySelector('input[name=meal]:checked')||{}).value||null;
      var btn=rf.querySelector('button[type=submit]'); btn.disabled=true; rn.textContent=rf.getAttribute('data-sending');
      rpc('submit_rsvp',{p_slug:SLUG,p_side:side,p_name:name,p_attending:att==='yes',p_party_size:parseInt(rf.size.value,10)||1,p_meal:att==='yes'?meal:null,p_message:rf.message.value.trim()||null})
        .then(function(){ rn.textContent=rf.getAttribute('data-sent'); rf.reset(); rf.classList.remove('absent'); })
        .catch(function(){ rn.textContent=rf.getAttribute('data-failed'); })
        .then(function(){ btn.disabled=false; });
    });
  }
  // 방명록 남기기 — 성공하면 목록 맨 위에 붙인다
  var gf=document.getElementById('gbx-form');
  if(gf){ var gn=document.getElementById('gbx-note');
    gf.addEventListener('submit',function(e){ e.preventDefault();
      var name=gf.name.value.trim(), msg=gf.message.value.trim();
      if(!name||!msg){ gn.textContent=gf.getAttribute('data-fill'); return; }
      var btn=gf.querySelector('button[type=submit]'); btn.disabled=true; gn.textContent=gf.getAttribute('data-sending');
      rpc('add_guestbook_message',{p_slug:SLUG,p_name:name,p_message:msg}).then(function(){
        gn.textContent=gf.getAttribute('data-sent');
        var esc=function(s){ return s.replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
        var list=document.getElementById('gb-list'); var empty=list.querySelector('.gb-empty'); if(empty) empty.remove();
        list.insertAdjacentHTML('afterbegin','<div class="gb-card"><div class="gb-head"><b>'+esc(name)+'</b></div><p>'+esc(msg).replace(/\\n/g,'<br>')+'</p></div>');
        gf.reset();
      }).catch(function(){ gn.textContent=gf.getAttribute('data-failed'); }).then(function(){ btn.disabled=false; });
    });
  }
})();
</script>`;
}
