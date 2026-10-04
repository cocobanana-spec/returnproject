// 공개 페이지 렌더 검증 — 내용이 들어가고, 위험한 입력이 이스케이프되고, 미리보기 태그가 맞고, 안내 페이지가 말을 아끼는지
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FuneralContent, WeddingContent } from '../../domain/invitation.ts';
import { koreanDate, koreanDateTime, koreanTime } from './html.ts';
import { noticePage, renderInvitationPage, shareDescription } from './index.ts';

const assetUrl = (p: string) => `https://cdn.example/${p}`;

const wedding: WeddingContent = {
  groom: { name: '김철수', father: '김아버지', mother: '박어머니' },
  bride: { name: '이영희' },
  date: '2027-05-01',
  time: '12:30',
  venue: { name: '서울 웨딩홀', hall: '3층', address: '서울시 강남구 테헤란로 1' },
  greeting: '첫째 줄\n둘째 줄',
  cover: 'L/I/cover.jpg',
  gallery: ['L/I/g1.jpg', 'L/I/g2.jpg'],
  accounts: [
    { side: 'groom', holder: '김철수', bank: '국민', number: '123-456' },
    { side: 'bride', holder: '이영희', bank: '신한', number: '789' },
  ],
  contact: { groom: '010-1111-2222' },
};

const funeral: FuneralContent = {
  deceased: { name: '김아버지', age: 82, title: '아버지' },
  chiefMourners: [
    { relation: '아들', name: '김철수' },
    { relation: '딸', name: '김영희' },
  ],
  mortuary: { name: '서울병원 장례식장', room: '3호실' },
  passedAt: '2026-11-01 03:20',
  funeralAt: '2026-11-03 08:00',
  burialPlace: '서울추모공원',
  accounts: [{ holder: '김철수', bank: '국민', number: '123-456' }],
  contact: '010-3333-4444',
};

test('한국어 날짜·시간 글자', () => {
  assert.equal(koreanDate('2027-05-01'), '2027년 5월 1일 토요일');
  assert.equal(koreanTime('12:30'), '오후 12시 30분');
  assert.equal(koreanTime('09:00'), '오전 9시');
  assert.equal(koreanTime('00:00'), '오전 12시');
  assert.equal(koreanDateTime('2026-11-03 08:00'), '2026년 11월 3일 화요일 오전 8시');
  assert.equal(koreanDate('이상한값'), '이상한값');
});

test('청첩장 — 이름·일시·장소·부모·계좌·사진·지도·연락처가 다 들어간다', () => {
  const html = renderInvitationPage({ kind: 'wedding', templateId: 'basic', content: wedding, url: 'https://ppurin.com/i/abc', assetUrl });
  for (const s of ['김철수', '이영희', '2027년 5월 1일 토요일', '오후 12시 30분', '서울 웨딩홀', '3층',
                   '김아버지 · 박어머니의 아들', '국민', '123-456', '신한', '신랑 측', '신부 측',
                   'https://cdn.example/L/I/cover.jpg', 'https://cdn.example/L/I/g2.jpg',
                   'map.kakao.com/link/search/', 'map.naver.com/p/search/', 'tel:010-1111-2222',
                   '첫째 줄<br>둘째 줄']) {
    assert.ok(html.includes(s), `빠짐: ${s}`);
  }
  // 신부 부모가 없으면 '의 딸' 문장을 만들지 않는다
  assert.ok(!html.includes('의 딸 <strong>이영희'));
  assert.ok(html.includes('<strong>이영희</strong> <span class="muted">딸</span>'));
});

test('부고장 — 고인·호칭·향년·상주·빈소·발인·장지·계좌·연락처', () => {
  const html = renderInvitationPage({ kind: 'funeral', templateId: 'basic', content: funeral, url: 'https://ppurin.com/i/abc', assetUrl });
  assert.ok(html.includes('로 만든 부고장입니다'));
  for (const s of ['아버지 故 김아버지', '향년 82세', '아들', '김철수', '딸', '김영희', '서울병원 장례식장', '3호실',
                   '2026년 11월 1일 일요일 오전 3시 20분', '2026년 11월 3일 화요일 오전 8시', '서울추모공원',
                   '조의금 계좌', '123-456', 'tel:010-3333-4444']) {
    assert.ok(html.includes(s), `빠짐: ${s}`);
  }
});

test('위험한 입력은 이스케이프된다 — 이름에 스크립트를 넣어도 실행 코드가 되지 않는다', () => {
  const evil: WeddingContent = { ...wedding, groom: { name: '<script>alert(1)</script>' }, greeting: '"><img src=x onerror=alert(1)>' };
  const html = renderInvitationPage({ kind: 'wedding', templateId: 'basic', content: evil, url: 'https://ppurin.com/i/x', assetUrl });
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!html.includes('<img src=x onerror'));
  // 복사 버튼의 data-copy 속성도 이스케이프된다
  const evilAcct: FuneralContent = { ...funeral, accounts: [{ holder: '"><b>x', bank: '국민', number: '1' }] };
  const h2 = renderInvitationPage({ kind: 'funeral', templateId: 'basic', content: evilAcct, url: 'u', assetUrl });
  assert.ok(h2.includes('data-copy="국민 1 &quot;&gt;&lt;b&gt;x"'));
});

test('미리보기 태그 — 제목·설명·주소·커버 사진, 검색 제외', () => {
  const html = renderInvitationPage({ kind: 'wedding', templateId: 'basic', content: wedding, url: 'https://ppurin.com/i/abc', assetUrl });
  assert.ok(html.includes('<meta property="og:title" content="김철수 ♥ 이영희 결혼합니다">'));
  assert.ok(html.includes('<meta property="og:url" content="https://ppurin.com/i/abc">'));
  assert.ok(html.includes('<meta property="og:image" content="https://cdn.example/L/I/cover.jpg">'));
  assert.ok(html.includes('<meta name="robots" content="noindex, nofollow">'));
  assert.equal(shareDescription('wedding', wedding), '2027-05-01 12:30 · 서울 웨딩홀');
  assert.equal(shareDescription('funeral', funeral), '빈소 서울병원 장례식장 · 발인 2026-11-03 08:00');
  // 커버가 없으면 og:image 를 내지 않는다(엉뚱한 그림이 잡히는 것보다 낫다)
  const noCover = renderInvitationPage({ kind: 'wedding', templateId: 'basic', content: { ...wedding, cover: undefined }, url: 'u', assetUrl });
  assert.ok(!noCover.includes('og:image'));
});

test('외부 자원을 싣지 않는다 — 하객은 데이터로 한 번 연다', () => {
  const html = renderInvitationPage({ kind: 'wedding', templateId: 'basic', content: wedding, url: 'u', assetUrl });
  assert.ok(!/<link[^>]+rel="stylesheet"/.test(html));
  assert.ok(!/<script[^>]+src=/.test(html));
  assert.ok(!html.includes('fonts.googleapis'));
});

test('안내 페이지는 무엇이 있었는지 말하지 않는다', () => {
  const gone = noticePage('not_found', 'https://ppurin.com/i/x');
  const over = noticePage('expired', 'https://ppurin.com/i/x');
  assert.ok(gone.includes('초대장을 찾을 수 없습니다'));
  assert.ok(over.includes('기간이 지난 초대장입니다'));
  for (const h of [gone, over]) {
    assert.ok(h.includes('noindex'));
    assert.ok(!h.includes('김철수'));
  }
});

test('방명록 — 끝점이 있으면 전광판이 맨 위, 입력칸이 맨 아래에 들어가고 이름·메시지는 이스케이프된다', () => {
  const ep = { supabaseUrl: 'https://x.supabase.co', anonKey: 'anon', slug: 'Ab3xYz9Qw1' };
  const html = renderInvitationPage({
    kind: 'wedding', templateId: 'basic', content: wedding, url: 'u', assetUrl,
    guestbook: [{ name: '박하객', message: '축하해요 <b>진심</b>' }],
    guestbookEndpoint: ep,
  });
  const marqueeAt = html.indexOf('class="marquee"');
  const heroAt = html.indexOf('class="hero"');
  const formAt = html.indexOf('id="gb-form"');
  assert.ok(marqueeAt > 0 && marqueeAt < heroAt, '전광판이 본문보다 앞');
  assert.ok(formAt > heroAt, '입력칸이 본문보다 뒤');
  assert.ok(html.includes('<b>박하객</b> 축하해요 &lt;b&gt;진심&lt;/b&gt;'));
  assert.ok(html.includes('add_guestbook_message'));
  assert.ok(html.includes('"Ab3xYz9Qw1"'));
  assert.ok(html.includes('1개의 메시지'));
});

test('방명록 — 메시지가 없으면 안내 한 줄, 끝점이 없으면(앱 미리보기) 방명록 자체가 없다', () => {
  const ep = { supabaseUrl: 'https://x.supabase.co', anonKey: 'anon', slug: 'Ab3xYz9Qw1' };
  const empty = renderInvitationPage({ kind: 'funeral', templateId: 'basic', content: funeral, url: 'u', assetUrl, guestbook: [], guestbookEndpoint: ep });
  assert.ok(empty.includes('첫 축하 메시지를 남겨 주세요') || empty.includes('mq-empty'));
  const preview = renderInvitationPage({ kind: 'funeral', templateId: 'basic', content: funeral, url: 'u', assetUrl });
  assert.ok(!preview.includes('class="marquee"'));
  assert.ok(!preview.includes('id="gb-form"'));
  assert.ok(!preview.includes('add_guestbook_message'));
});
