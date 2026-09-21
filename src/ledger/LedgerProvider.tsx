// 현재 장부 컨텍스트. 앱의 모든 조회는 여기서 꺼낸 ledgerId를 붙여야 한다
//
// RLS는 "내가 구성원인 모든 장부"를 허용하므로 앱이 장부를 고르지 않으면 두 장부가 섞여 보인다.
// 고르는 규칙 — 저장된 id가 아직 유효하면 유지, 아니면 owner인 장부를 먼저, 그것도 없으면 첫 번째.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { queryKeys } from '../lib/queryKeys';
import { listMyLedgers, type MyLedger } from '../repositories/ledgers';
import { CURRENT_LEDGER_KEY as STORAGE_KEY } from './storage.ts';

type LedgerState = {
  ledgers: MyLedger[];
  currentLedgerId: string | null;
  current: MyLedger | null;
  // loading = 목록을 아직 못 받음, none = 장부 0권(초대 코드 입력만 가능), ready = 정상
  status: 'loading' | 'none' | 'ready' | 'error';
  error: Error | null;
  setCurrentLedger: (ledgerId: string) => void;
  refetch: () => void;
};

const LedgerContext = createContext<LedgerState | null>(null);

function pickDefault(ledgers: MyLedger[], stored: string | null): string | null {
  if (stored && ledgers.some((l) => l.ledgerId === stored)) return stored;
  const owned = ledgers.find((l) => l.role === 'owner');
  return owned?.ledgerId ?? ledgers[0]?.ledgerId ?? null;
}

export function LedgerProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const [stored, setStored] = useState<string | null>(null);
  const [storedLoaded, setStoredLoaded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => setStored(value))
      .catch(() => setStored(null))
      .finally(() => setStoredLoaded(true));
  }, []);

  const query = useQuery({
    queryKey: queryKeys.ledgers.mine(userId ?? 'anonymous'),
    queryFn: () => listMyLedgers(userId as string),
    enabled: Boolean(userId),
  });

  const ledgers = useMemo(() => query.data ?? [], [query.data]);

  // 목록이 바뀌면(합류·탈퇴·제거) 선택이 아직 유효한지 다시 본다.
  useEffect(() => {
    if (!storedLoaded || !query.isSuccess) return;
    const next = pickDefault(ledgers, selected ?? stored);
    if (next !== selected) setSelected(next);
  }, [ledgers, storedLoaded, query.isSuccess, selected, stored]);

  useEffect(() => {
    if (selected) AsyncStorage.setItem(STORAGE_KEY, selected).catch(() => {});
  }, [selected]);

  // 로그아웃하면 선택을 비운다. 다음 로그인 계정이 이전 사용자의 장부를 물려받지 않게 한다.
  // 메모리뿐 아니라 저장소에서도 지운다. 남겨 두면 다음 계정이 남의 장부 id를 들고 시작한다.
  useEffect(() => {
    if (!userId) {
      setSelected(null);
      setStored(null);
      AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    }
  }, [userId]);

  // 장부가 0권으로 보일 때, 진짜 0권인지 세션이 이미 죽은 것인지 가른다.
  //
  // 다른 기기에서 계정을 지웠거나 토큰이 무효해진 경우에도 JWT는 만료 전까지 형식상 유효하다.
  // 그 토큰으로 조회하면 RLS가 오류 없이 0건을 돌려주므로 "장부 없음"과 구별되지 않는다.
  // 그대로 두면 장부가 멀쩡히 있는 사용자에게 초대 코드 입력 화면이 계속 보인다(실제로 재현됨).
  // 서버에 사용자를 물어보고 아니라면 로그아웃해 로그인 화면으로 돌려보낸다.
  useEffect(() => {
    if (!userId || !query.isSuccess || ledgers.length > 0) return;
    let alive = true;
    supabase.auth
      .getUser()
      .then(({ error }) => {
        if (alive && error) void supabase.auth.signOut();
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId, query.isSuccess, ledgers.length]);

  const setCurrentLedger = useCallback((ledgerId: string) => setSelected(ledgerId), []);

  const { isError, isSuccess, error, refetch } = query;

  const value = useMemo<LedgerState>(() => {
    let status: LedgerState['status'] = 'loading';
    if (isError) status = 'error';
    else if (!userId || !storedLoaded || !isSuccess) status = 'loading';
    else if (ledgers.length === 0) status = 'none';
    else if (selected) status = 'ready';

    return {
      ledgers,
      currentLedgerId: selected,
      current: ledgers.find((l) => l.ledgerId === selected) ?? null,
      status,
      error: error ?? null,
      setCurrentLedger,
      refetch: () => void refetch(),
    };
  }, [ledgers, selected, isError, isSuccess, error, refetch, storedLoaded, userId, setCurrentLedger]);

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger(): LedgerState {
  const value = useContext(LedgerContext);
  if (!value) throw new Error('LedgerProvider 안에서만 쓸 수 있다.');
  return value;
}

// 장부가 반드시 있어야 하는 화면에서 쓴다. 없으면 바로 터뜨려 실수를 드러낸다.
export function useLedgerId(): string {
  const { currentLedgerId } = useLedger();
  if (!currentLedgerId) throw new Error('현재 장부가 없다. 장부 게이트를 거치지 않은 화면이다.');
  return currentLedgerId;
}
