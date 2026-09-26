// 현재 장부 선택을 담아 두는 AsyncStorage 키. 로그아웃 때 지워야 해서 한 곳에 모아 둔다
export const CURRENT_LEDGER_KEY = 'ppurin.currentLedgerId';

// 마지막으로 보던 하단 탭. 로그아웃 때 함께 지운다 — 다음 사용자가 이전 사용자의 위치를
// 물려받으면 안 된다.
export const LAST_TAB_KEY = 'ppurin.lastTab';
