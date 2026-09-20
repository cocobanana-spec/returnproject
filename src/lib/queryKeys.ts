// TanStack Query 키 규칙 — [도메인, 동작, { ledgerId, ... }]
// 장부가 키에 들어가야 장부를 전환했을 때 다른 장부의 캐시를 보지 않는다
export const queryKeys = {
  ledgers: {
    mine: (userId: string) => ['ledgers', 'mine', { userId }] as const,
    detail: (ledgerId: string) => ['ledgers', 'detail', { ledgerId }] as const,
    members: (ledgerId: string) => ['ledgers', 'members', { ledgerId }] as const,
  },
  people: {
    list: (ledgerId: string, params?: Record<string, unknown>) =>
      ['people', 'list', { ledgerId, ...params }] as const,
    search: (ledgerId: string, prefix: string) =>
      ['people', 'search', { ledgerId, prefix }] as const,
    detail: (ledgerId: string, personId: string) =>
      ['people', 'detail', { ledgerId, personId }] as const,
    recent: (ledgerId: string) => ['people', 'recent', { ledgerId }] as const,
  },
  events: {
    list: (ledgerId: string, params?: Record<string, unknown>) =>
      ['events', 'list', { ledgerId, ...params }] as const,
    detail: (ledgerId: string, eventId: string) =>
      ['events', 'detail', { ledgerId, eventId }] as const,
    summary: (ledgerId: string, eventId: string) =>
      ['events', 'summary', { ledgerId, eventId }] as const,
    upcoming: (ledgerId: string) => ['events', 'upcoming', { ledgerId }] as const,
  },
  entries: {
    byPerson: (ledgerId: string, personId: string) =>
      ['entries', 'byPerson', { ledgerId, personId }] as const,
    byEvent: (ledgerId: string, eventId: string) =>
      ['entries', 'byEvent', { ledgerId, eventId }] as const,
    recent: (ledgerId: string) => ['entries', 'recent', { ledgerId }] as const,
    detail: (ledgerId: string, entryId: string) =>
      ['entries', 'detail', { ledgerId, entryId }] as const,
  },
  stats: {
    byYear: (ledgerId: string, year: number | null) =>
      ['stats', 'byYear', { ledgerId, year }] as const,
  },
} as const;

// 장부 하나에 속한 캐시를 통째로 무효화할 때 쓴다(장부 전환·가져오기 후).
export const ledgerScopedDomains = ['people', 'events', 'entries', 'stats'] as const;
