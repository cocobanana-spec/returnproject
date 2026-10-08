// 청첩장·부고장의 내용 규칙 — 종류별 칸, 검증, 기본값, 템플릿 목록, 만료·공유 주소. 앱과 워커가 함께 쓴다
//
// 이 파일은 React Native 를 모른다. Cloudflare 워커(공개 페이지)와 앱이 같은 규칙을 쓰기 위해서다.
// 서버(0009)는 내용의 크기와 모양(object)만 본다. 칸의 뜻과 필수 여부는 여기서 정한다.
// **입력 칸은 종류별로 고정**이다. 템플릿을 바꿔도 적은 내용이 사라지지 않는다(docs/08 §3.3).
import { LANDING_URL } from '../lib/urls.ts';
import type { Locale } from '../i18n/dict.ts';

export type InvitationKind = 'wedding' | 'funeral';
export type InvitationStatus = 'draft' | 'published' | 'unpublished' | 'expired';
export type InvitationPlan = 'free' | 'premium';

// 축의금·조의금 계좌. 공개 페이지에서 복사 버튼으로 보여 준다.
export type BankAccount = {
  // 청첩장은 측(신랑/신부), 부고장은 비워 둔다.
  side?: 'groom' | 'bride';
  holder: string;
  bank: string;
  number: string;
};

export type WeddingContent = {
  // 공개 페이지의 안내 글자 언어(오시는 길·계좌·방명록 등). 내용 자체는 적은 그대로다. 없으면 한국어.
  lang?: Locale;
  groom: { name: string; father?: string; mother?: string };
  bride: { name: string; father?: string; mother?: string };
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  venue: { name: string; hall?: string; address?: string; phone?: string };
  greeting?: string;
  cover?: string; // 스토리지 경로
  gallery?: string[];
  accounts?: BankAccount[];
  contact?: { groom?: string; bride?: string };
  // 아래는 '봄' 템플릿이 쓰는 칸(2026-10-07). 다른 템플릿은 무시한다.
  // 인트로에서 손글씨로 써지는 문구. 비우면 "We're getting married"
  intro?: string;
  // 혼주 전화 — "혼주에게 연락하기"
  parentPhones?: { groomFather?: string; groomMother?: string; brideFather?: string; brideMother?: string };
  // 오시는 길 아래 교통 안내
  transport?: { bus?: string; subway?: string; car?: string };
  // 참석 여부 받기(공개 페이지에 버튼이 생긴다)
  rsvp?: boolean;
};

export type FuneralContent = {
  lang?: Locale;
  deceased: { name: string; age?: number; title?: string }; // title: 故 OOO 님 앞의 호칭(예: 아버지)
  chiefMourners: { relation: string; name: string }[];
  mortuary: { name: string; room?: string; address?: string };
  passedAt?: string; // YYYY-MM-DD HH:mm
  funeralAt: string; // 발인 YYYY-MM-DD HH:mm
  burialPlace?: string;
  accounts?: BankAccount[];
  contact?: string;
  note?: string;
};

export type InvitationContent = WeddingContent | FuneralContent;

// ---------------------------------------------------------------------------
// 행사 종류 → 청첩장 종류
// ---------------------------------------------------------------------------
export function invitationKindForEvent(eventType: string): InvitationKind | null {
  if (eventType === 'wedding') return 'wedding';
  if (eventType === 'funeral') return 'funeral';
  return null;
}

export const KIND_LABEL: Record<InvitationKind, string> = { wedding: '청첩장', funeral: '부고장' };

// ---------------------------------------------------------------------------
// 템플릿 목록 — 2A 는 종류별 하나. 2B 에서 늘린다. free 가 false 면 프리미엄 전용.
// ---------------------------------------------------------------------------
export type Template = { id: string; kind: InvitationKind; name: string; free: boolean };

export const TEMPLATES: Template[] = [
  { id: 'basic', kind: 'wedding', name: '단정', free: true },
  // 인트로 손글씨 애니메이션 → 사진, 종이 질감·명조체·달력·카운트다운·교통 안내·참석 여부(2026-10-07)
  { id: 'spring', kind: 'wedding', name: '봄', free: true },
  // 봄과 같은 구조에 나무·앤티크 / 만화·웹툰 옷을 입힌 것(2026-10-08)
  { id: 'brown', kind: 'wedding', name: '브라운', free: true },
  { id: 'cartoon', kind: 'wedding', name: '꾸러기', free: true },
  // 8비트 레트로 게임 — 픽셀 하늘·벽돌·코인, 게임 시작 화면 인트로(2026-10-08)
  { id: 'game', kind: 'wedding', name: '짜잔', free: true },
  { id: 'basic', kind: 'funeral', name: '흰 바탕', free: true },
];

// 인트로·달력·카운트다운·교통 안내·참석 여부가 있는 템플릿. 편집 화면에서 추가 칸을 연다
export const RICH_TEMPLATE_IDS = ['spring', 'brown', 'cartoon', 'game'] as const;
export function isRichTemplate(id: string | null | undefined): boolean {
  return !!id && (RICH_TEMPLATE_IDS as readonly string[]).includes(id);
}

export function templatesFor(kind: InvitationKind): Template[] {
  return TEMPLATES.filter((t) => t.kind === kind);
}

// ---------------------------------------------------------------------------
// 기본값
// ---------------------------------------------------------------------------
export function emptyContent(kind: 'wedding'): WeddingContent;
export function emptyContent(kind: 'funeral'): FuneralContent;
export function emptyContent(kind: InvitationKind): InvitationContent;
export function emptyContent(kind: InvitationKind): InvitationContent {
  if (kind === 'wedding') {
    return {
      groom: { name: '' },
      bride: { name: '' },
      date: '',
      time: '',
      venue: { name: '' },
      accounts: [],
    };
  }
  return {
    deceased: { name: '' },
    chiefMourners: [],
    mortuary: { name: '' },
    funeralAt: '',
    accounts: [],
  };
}

// ---------------------------------------------------------------------------
// 검증 — 발행 전에 반드시 통과해야 한다. 오류는 사람이 읽는 문장이다.
// ---------------------------------------------------------------------------
export type Validation = { ok: true } | { ok: false; errors: string[] };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;
const DATETIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;

const LIMITS = {
  name: 30,
  short: 60,
  address: 120,
  greeting: 1000,
  note: 500,
  gallery: 20,
  accounts: 6,
  mourners: 12,
} as const;

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function checkAccounts(accounts: unknown, errors: string[], needSide: boolean): void {
  if (accounts === undefined) return;
  if (!Array.isArray(accounts)) {
    errors.push('계좌 목록의 형식이 잘못되었습니다.');
    return;
  }
  if (accounts.length > LIMITS.accounts) errors.push(`계좌는 ${LIMITS.accounts}개까지 넣을 수 있습니다.`);
  accounts.forEach((a, i) => {
    const n = i + 1;
    if (!str(a?.holder)) errors.push(`${n}번째 계좌의 예금주를 적어 주세요.`);
    if (!str(a?.bank)) errors.push(`${n}번째 계좌의 은행을 적어 주세요.`);
    if (!str(a?.number)) errors.push(`${n}번째 계좌의 번호를 적어 주세요.`);
    if (needSide && a?.side !== 'groom' && a?.side !== 'bride') {
      errors.push(`${n}번째 계좌가 신랑 측인지 신부 측인지 골라 주세요.`);
    }
  });
}

export function validateWedding(c: Partial<WeddingContent> | null | undefined): Validation {
  const errors: string[] = [];
  if (!c || typeof c !== 'object') return { ok: false, errors: ['내용이 비어 있습니다.'] };
  if (!str(c.groom?.name)) errors.push('신랑 이름을 적어 주세요.');
  if (!str(c.bride?.name)) errors.push('신부 이름을 적어 주세요.');
  if (!DATE.test(str(c.date))) errors.push('예식 날짜를 골라 주세요.');
  if (!TIME.test(str(c.time))) errors.push('예식 시간을 골라 주세요.');
  if (!str(c.venue?.name)) errors.push('예식장 이름을 적어 주세요.');
  for (const [label, v, max] of [
    ['신랑 이름', c.groom?.name, LIMITS.name],
    ['신부 이름', c.bride?.name, LIMITS.name],
    ['예식장 이름', c.venue?.name, LIMITS.short],
    ['예식장 주소', c.venue?.address, LIMITS.address],
    ['인사말', c.greeting, LIMITS.greeting],
    ['인트로 문구', c.intro, LIMITS.short],
    ['예식장 전화', c.venue?.phone, LIMITS.name],
    ['버스 안내', c.transport?.bus, LIMITS.note],
    ['지하철 안내', c.transport?.subway, LIMITS.note],
    ['자가용 안내', c.transport?.car, LIMITS.note],
  ] as const) {
    if (str(v).length > max) errors.push(`${label}은(는) ${max}자까지입니다.`);
  }
  if (c.gallery && c.gallery.length > LIMITS.gallery) {
    errors.push(`사진은 ${LIMITS.gallery}장까지 넣을 수 있습니다.`);
  }
  checkAccounts(c.accounts, errors, true);
  return errors.length ? { ok: false, errors } : { ok: true };
}

export function validateFuneral(c: Partial<FuneralContent> | null | undefined): Validation {
  const errors: string[] = [];
  if (!c || typeof c !== 'object') return { ok: false, errors: ['내용이 비어 있습니다.'] };
  if (!str(c.deceased?.name)) errors.push('고인 성함을 적어 주세요.');
  if (!Array.isArray(c.chiefMourners) || c.chiefMourners.length === 0) {
    errors.push('상주를 한 명 이상 적어 주세요.');
  } else {
    if (c.chiefMourners.length > LIMITS.mourners) errors.push(`상주는 ${LIMITS.mourners}명까지입니다.`);
    c.chiefMourners.forEach((m, i) => {
      if (!str(m?.name)) errors.push(`${i + 1}번째 상주의 이름을 적어 주세요.`);
      if (!str(m?.relation)) errors.push(`${i + 1}번째 상주의 관계(아들·딸 등)를 적어 주세요.`);
    });
  }
  if (!str(c.mortuary?.name)) errors.push('빈소를 적어 주세요.');
  if (!DATETIME.test(str(c.funeralAt))) errors.push('발인 일시를 골라 주세요.');
  if (c.passedAt !== undefined && c.passedAt !== '' && !DATETIME.test(str(c.passedAt))) {
    errors.push('별세 일시의 형식이 잘못되었습니다.');
  }
  if (str(c.note).length > LIMITS.note) errors.push(`안내문은 ${LIMITS.note}자까지입니다.`);
  checkAccounts(c.accounts, errors, false);
  return errors.length ? { ok: false, errors } : { ok: true };
}

export function validateInvitation(kind: InvitationKind, content: unknown): Validation {
  return kind === 'wedding'
    ? validateWedding(content as Partial<WeddingContent>)
    : validateFuneral(content as Partial<FuneralContent>);
}

// ---------------------------------------------------------------------------
// 만료·요금제 — 서버(0009 publish_invitation)와 같은 숫자. 화면 안내용이다.
// ---------------------------------------------------------------------------
export function maxMonths(plan: InvitationPlan): number {
  return plan === 'premium' ? 12 : 3;
}

// 남은 기간 안내. 발행 화면과 목록에서 쓴다.
export function expiryLabel(expiresAt: string | null, now: Date = new Date()): string {
  if (!expiresAt) return '';
  const end = new Date(expiresAt);
  const days = Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
  if (days < 0) return '만료됨';
  if (days === 0) return '오늘 만료';
  return `${days}일 남음`;
}

// ---------------------------------------------------------------------------
// 공유 주소 — 랜딩 도메인 밑 /i/{slug}. 가장 짧은 자리(docs/08 §2.3)
// ---------------------------------------------------------------------------
// 템플릿 견본 — 워커가 DB 없이 그리는 샘플(src/invitation/samples.ts)
export function sampleUrl(templateId: string): string {
  return `${LANDING_URL.replace(/\/$/, '')}/i/sample-${templateId}`;
}

export function shareUrl(slug: string): string {
  return `${LANDING_URL.replace(/\/$/, '')}/i/${slug}`;
}

// 공개 페이지 미리보기용 제목 한 줄. OG 제목과 공유 시트 제목에 쓴다.
export function shareTitle(kind: InvitationKind, content: InvitationContent): string {
  if (kind === 'wedding') {
    const c = content as WeddingContent;
    return `${c.groom.name} ♥ ${c.bride.name} 결혼합니다`;
  }
  const c = content as FuneralContent;
  return `[부고] ${c.deceased.title ? `${c.deceased.title} ` : ''}故 ${c.deceased.name}`;
}
