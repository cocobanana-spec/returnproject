// 템플릿 샘플 청첩장 — ppurin.com/i/sample-{템플릿 id} 로 누구나 열어 보는 견본(2026-10-07 사장님 요청)
//
// 실제 DB 를 거치지 않는다. 워커가 이 내용으로 바로 그린다. 사진은 site/sample/ 의 견본 그림이다.
// 방명록·참석 여부는 눌러 볼 수 있지만 보내지지 않는다(demo — 보낸 척만 한다).
import type { WeddingContent } from '../domain/invitation.ts';
import type { GuestbookMessage } from './render/html.ts';

export const SAMPLE_TEMPLATE_IDS = ['basic', 'spring'] as const;
export type SampleTemplateId = (typeof SAMPLE_TEMPLATE_IDS)[number];

export function sampleSlug(templateId: string): string {
  return `sample-${templateId}`;
}

export function sampleTemplateFromSlug(slug: string): SampleTemplateId | null {
  const id = slug.startsWith('sample-') ? slug.slice('sample-'.length) : '';
  return (SAMPLE_TEMPLATE_IDS as readonly string[]).includes(id) ? (id as SampleTemplateId) : null;
}

export const SAMPLE_WEDDING: WeddingContent = {
  groom: { name: '도윤', father: '김민수', mother: '이정희' },
  bride: { name: '서연', father: '박성호', mother: '최미경' },
  date: '2027-04-17',
  time: '12:30',
  venue: { name: '더채플 앳 청담', hall: '3층 그랜드홀', address: '서울 강남구 선릉로 757', phone: '02-0000-0000' },
  greeting: '봄볕처럼 따뜻한 날에\n서로의 손을 잡고\n같은 곳을 바라보려 합니다.\n\n귀한 걸음 하시어\n축복해 주시면 감사하겠습니다.',
  intro: "We're getting married",
  cover: 'cover.jpg',
  gallery: ['g1.jpg', 'g2.jpg', 'g3.jpg', 'g4.jpg', 'g5.jpg', 'g6.jpg'],
  accounts: [
    { side: 'groom', holder: '김도윤', bank: '국민은행', number: '000000-00-000000' },
    { side: 'bride', holder: '박서연', bank: '카카오뱅크', number: '3333-00-0000000' },
  ],
  contact: { groom: '010-0000-0000', bride: '010-0000-0000' },
  parentPhones: { groomFather: '010-0000-0000', groomMother: '010-0000-0000', brideFather: '010-0000-0000', brideMother: '010-0000-0000' },
  transport: {
    bus: '청담사거리 정류장 하차\n301, 342, 472',
    subway: '7호선 청담역 9번 출구 도보 5분',
    car: '건물 지하 주차장 2시간 무료',
  },
  rsvp: true,
};

export const SAMPLE_GUESTBOOK: GuestbookMessage[] = [
  { name: '지민', message: '두 사람 너무 잘 어울려요! 결혼 진심으로 축하해 💐', created_at: '2027-04-02T03:12:00Z' },
  { name: '현우', message: '행복하게 오래오래 잘 살아라~', created_at: '2027-03-28T11:40:00Z' },
  { name: '수아', message: '언니 결혼 축하해! 그날 꼭 갈게 🥰', created_at: '2027-03-25T08:05:00Z' },
];
