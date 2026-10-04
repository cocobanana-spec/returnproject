// 공개 페이지 HTML 의 공통 조각 — 이스케이프, 날짜 글자, 지도 링크, 계좌 복사, 문서 껍데기, 안내 페이지
//
// 이 폴더는 React Native 도 DOM 도 모른다. 문자열만 만든다. Cloudflare 워커가 그대로 내보내고,
// 앱은 같은 문자열을 웹뷰에 넣어 미리보기로 쓴다(docs/08 §3.3 "템플릿은 HTML 한 벌").
// 외부 자원(폰트·스크립트·CSS)을 싣지 않는다. 하객은 데이터로 한 번 열어 본다.

export function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 속성 값용. esc 와 같지만 이름을 나눠 의도를 드러낸다.
export const attr = esc;

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

// 'YYYY-MM-DD' → '2027년 5월 1일 토요일'. 형식이 틀리면 원문을 돌려준다(공개 페이지가 죽지 않게).
export function koreanDate(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const [, y, mo, d] = m;
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  return `${Number(y)}년 ${Number(mo)}월 ${Number(d)}일 ${WEEKDAY[dt.getUTCDay()]}요일`;
}

// 'HH:mm' → '오후 12시 30분'. 정각이면 분을 뺀다.
export function koreanTime(hm: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hm);
  if (!m) return hm;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const half = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return min === 0 ? `${half} ${h12}시` : `${half} ${h12}시 ${min}분`;
}

// 'YYYY-MM-DD HH:mm' → '2026년 11월 3일 화요일 오전 8시'
export function koreanDateTime(v: string): string {
  const [d, t] = v.split(' ');
  if (!d || !t) return v;
  return `${koreanDate(d)} ${koreanTime(t)}`;
}

// 지도 SDK 를 넣지 않는다. 검색 링크로 보낸다(docs/08 §3.3).
export function mapLinks(query: string): string {
  const q = encodeURIComponent(query);
  return `<div class="maps">
    <a href="https://map.kakao.com/link/search/${q}" target="_blank" rel="noopener">카카오맵</a>
    <a href="https://map.naver.com/p/search/${q}" target="_blank" rel="noopener">네이버지도</a>
  </div>`;
}

export type AccountRow = { side?: 'groom' | 'bride'; holder: string; bank: string; number: string };

// 계좌 한 줄. 복사 버튼은 아래 COPY_SCRIPT 가 처리한다.
export function accountRow(a: AccountRow): string {
  const text = `${a.bank} ${a.number} ${a.holder}`;
  return `<div class="account">
    <div><span class="bank">${esc(a.bank)}</span> <span class="num">${esc(a.number)}</span><br><span class="holder">${esc(a.holder)}</span></div>
    <button type="button" class="copy" data-copy="${attr(text)}">복사</button>
  </div>`;
}

export const COPY_SCRIPT = `<script>
document.addEventListener('click',function(e){
  var b=e.target.closest&&e.target.closest('button.copy'); if(!b) return;
  var t=b.getAttribute('data-copy')||'';
  function done(){ b.textContent='복사됨'; setTimeout(function(){ b.textContent='복사'; },1500); }
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(t).then(done,function(){ fallback(); }); } else { fallback(); }
  function fallback(){ var ta=document.createElement('textarea'); ta.value=t; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); done(); }catch(_){ } document.body.removeChild(ta); }
});
</script>`;

// 모든 템플릿이 공유하는 바닥 CSS. 템플릿은 자기 색·글꼴만 더한다.
export const BASE_CSS = `
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font:16px/1.7 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;-webkit-font-smoothing:antialiased;word-break:keep-all}
.page{max-width:480px;margin:0 auto;padding:0 0 48px}
section{padding:28px 24px}
h1{margin:0;font-weight:700;letter-spacing:-0.02em}
h2{margin:0 0 12px;font-size:0.85rem;letter-spacing:0.12em;font-weight:600;text-transform:uppercase}
p{margin:0 0 8px}
.muted{opacity:0.7;font-size:0.95rem}
.cover{width:100%;display:block;aspect-ratio:3/4;object-fit:cover}
.gallery{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}
.gallery img{width:100%;aspect-ratio:1;object-fit:cover;display:block;border-radius:6px}
.maps{display:flex;gap:8px;margin-top:10px}
.maps a{flex:1;text-align:center;padding:10px;border-radius:999px;text-decoration:none;font-size:0.92rem;border:1px solid currentColor;color:inherit}
.account{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid rgba(0,0,0,0.08)}
.account:first-of-type{border-top:0}
.account .bank{font-weight:600}
.account .holder{opacity:0.7;font-size:0.9rem}
button.copy{border:1px solid currentColor;background:transparent;color:inherit;border-radius:999px;padding:6px 12px;font-size:0.85rem;cursor:pointer}
.marquee{overflow:hidden;white-space:nowrap;background:rgba(0,0,0,0.04);font-size:0.92rem;padding:10px 0}
.mq-track{display:inline-flex;animation:mq var(--mq-dur,40s) linear infinite}
.mq-run{display:inline-block;padding-right:48px}
.mq-item{margin:0 10px}
.mq-dot{opacity:0.4}
.mq-empty{opacity:0.6}
@keyframes mq{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@media (prefers-reduced-motion: reduce){.mq-track{animation:none}}
.guestbook form{display:grid;gap:8px}
.guestbook input,.guestbook textarea{font:inherit;padding:10px 12px;border:1px solid rgba(0,0,0,0.15);border-radius:10px;background:transparent;color:inherit}
.guestbook button{font:inherit;font-weight:700;padding:12px;border-radius:999px;border:0;background:#111;color:#fff;cursor:pointer}
.guestbook button:disabled{opacity:0.5}
.gb-note{font-size:0.85rem;opacity:0.7;min-height:1.2em;margin:0}
.footer{text-align:center;padding:24px;font-size:0.8rem;opacity:0.55}
.footer a{color:inherit}
`;

// ---------------------------------------------------------------------------
// 방명록 — 위에는 전광판(마키), 아래에는 입력칸. 하객은 로그인이 없으므로 anon 키로 함수를 부른다.
// ---------------------------------------------------------------------------
export type GuestbookMessage = { name: string; message: string };
export type GuestbookEndpoint = { supabaseUrl: string; anonKey: string; slug: string };

// 전광판. CSS 만으로 돈다(자바스크립트 없이도 움직인다). 메시지가 없으면 안내 한 줄.
// 같은 내용을 두 번 이어 붙여 끊김 없이 돌게 한다.
export function marquee(messages: GuestbookMessage[]): string {
  const items = messages.length
    ? messages.map((m) => `<span class="mq-item"><b>${esc(m.name)}</b> ${esc(m.message)}</span>`).join('<span class="mq-dot">·</span>')
    : `<span class="mq-item mq-empty">아래에서 첫 축하 메시지를 남겨 주세요</span>`;
  const dur = Math.max(18, Math.min(120, messages.reduce((n, m) => n + m.name.length + m.message.length, 0) / 2.2));
  return `<div class="marquee" id="marquee" aria-live="polite" style="--mq-dur:${dur.toFixed(0)}s">
    <div class="mq-track"><div class="mq-run">${items}</div><div class="mq-run" aria-hidden="true">${items}</div></div>
  </div>`;
}

export function guestbookForm(count: number): string {
  return `<section class="guestbook" id="guestbook">
    <h2>방명록</h2>
    <p class="muted">${count ? `${count}개의 메시지` : '아직 메시지가 없습니다'}. 남기신 말은 위에서 돌아갑니다.</p>
    <form id="gb-form">
      <input name="name" maxlength="20" placeholder="이름" required autocomplete="name">
      <textarea name="message" maxlength="200" rows="3" placeholder="축하 또는 위로의 한마디" required></textarea>
      <button type="submit">남기기</button>
      <p class="gb-note" id="gb-note"></p>
    </form>
  </section>`;
}

// 전광판은 CSS 가 돌리고, 이 스크립트는 남기기만 처리한다. 성공하면 전광판 맨 앞에 바로 붙인다.
export function guestbookScript(ep: GuestbookEndpoint): string {
  return `<script>
(function(){
  var f=document.getElementById('gb-form'); if(!f) return;
  var note=document.getElementById('gb-note');
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var name=f.name.value.trim(), msg=f.message.value.trim();
    if(!name||!msg){ note.textContent='이름과 메시지를 적어 주세요.'; return; }
    f.querySelector('button').disabled=true; note.textContent='남기는 중…';
    fetch(${JSON.stringify(ep.supabaseUrl)}+'/rest/v1/rpc/add_guestbook_message',{method:'POST',
      headers:{'apikey':${JSON.stringify(ep.anonKey)},'Authorization':'Bearer '+${JSON.stringify(ep.anonKey)},'Content-Type':'application/json'},
      body:JSON.stringify({p_slug:${JSON.stringify(ep.slug)},p_name:name,p_message:msg})})
    .then(function(r){ if(!r.ok) throw new Error(String(r.status)); return r.json(); })
    .then(function(){
      note.textContent='고맙습니다. 메시지를 남겼습니다.';
      var esc=function(s){ return s.replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
      var html='<span class="mq-item"><b>'+esc(name)+'</b> '+esc(msg)+'</span><span class="mq-dot">·</span>';
      document.querySelectorAll('.mq-run').forEach(function(run){ var empty=run.querySelector('.mq-empty'); if(empty) run.innerHTML=''; run.insertAdjacentHTML('afterbegin',html); });
      f.reset();
    })
    .catch(function(){ note.textContent='남기지 못했습니다. 잠시 뒤 다시 시도해 주세요.'; })
    .then(function(){ f.querySelector('button').disabled=false; });
  });
})();
</script>`;
}

export type PageMeta = {
  title: string;
  description: string;
  url: string;
  image?: string;
  // 공개 페이지는 검색에 안 잡히게 둔다. 청첩장은 받은 사람만 보는 것이다.
  noindex?: boolean;
};

// 문서 껍데기. 본문·CSS 는 템플릿이 준다.
// footerNoun — 바닥 줄의 명사. 청첩장은 '초대장', 부고장은 '부고장'. 부고에 '초대'라는 말을 쓰지 않는다.
export function document(meta: PageMeta, css: string, body: string, script = '', footerNoun = '초대장'): string {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(meta.title)}</title>
<meta name="description" content="${attr(meta.description)}">
${meta.noindex === false ? '' : '<meta name="robots" content="noindex, nofollow">'}
<meta property="og:type" content="website">
<meta property="og:title" content="${attr(meta.title)}">
<meta property="og:description" content="${attr(meta.description)}">
<meta property="og:url" content="${attr(meta.url)}">
${meta.image ? `<meta property="og:image" content="${attr(meta.image)}">` : ''}
<meta name="twitter:card" content="${meta.image ? 'summary_large_image' : 'summary'}">
<style>${BASE_CSS}${css}</style>
</head>
<body>
<div class="page">
${body}
<div class="footer"><a href="https://ppurin.com/">뿌린대로거두리라</a>로 만든 ${esc(footerNoun)}입니다</div>
</div>
${script}
</body>
</html>`;
}

// 없는 주소·내려간 청첩장·만료된 청첩장. 어느 경우든 "무엇이 있었는지"는 말하지 않는다.
export function noticePage(kind: 'not_found' | 'expired', url: string): string {
  const title = kind === 'expired' ? '기간이 지난 초대장입니다' : '초대장을 찾을 수 없습니다';
  const text =
    kind === 'expired'
      ? '이 초대장은 공개 기간이 끝났습니다. 보내 주신 분께 다시 확인해 주세요.'
      : '주소가 잘못되었거나 내려간 초대장입니다. 보내 주신 분께 다시 확인해 주세요.';
  const css = `body{background:#faf9f6;color:#333}.notice{min-height:70vh;display:grid;place-items:center;text-align:center}`;
  return document(
    { title, description: text, url, noindex: true },
    css,
    `<section class="notice"><div><h1 style="font-size:1.3rem">${esc(title)}</h1><p class="muted">${esc(text)}</p></div></section>`,
  );
}
