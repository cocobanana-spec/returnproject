// 로그인 세션 상태를 앱 전체에 공급하고, 메일로 돌아오는 인증 딥링크를 받는다
//
// 확인 메일·재설정 메일의 링크는 PKCE 흐름이라 ?code= 를 달고 앱으로 돌아온다.
// 그 코드를 세션으로 교환하는 것이 여기다. 재설정으로 들어온 경우에는 세션이 생겨도
// 홈으로 보내면 안 되므로(비밀번호를 아직 안 바꿨다) resetPending을 세워 게이트가 붙잡는다.
import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import { mapAuthError } from './errors.ts';
import { parseAuthLink } from './links.ts';

type AuthState = {
  session: Session | null;
  userId: string | null;
  // 최초 세션 복원이 끝나기 전에는 화면을 정하지 않는다. 로그인 화면이 깜빡이는 것을 막는다.
  restoring: boolean;
  // 재설정 링크로 들어왔고 아직 새 비밀번호를 안 넣은 상태
  resetPending: boolean;
  // 딥링크 처리 중 생긴 오류를 화면이 보여 줄 수 있게 둔다
  linkError: string | null;
  endPasswordReset: () => void;
  clearLinkError: () => void;
};

const AuthContext = createContext<AuthState>({
  session: null,
  userId: null,
  restoring: true,
  resetPending: false,
  linkError: null,
  endPasswordReset: () => {},
  clearLinkError: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [resetPending, setResetPending] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setRestoring(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setRestoring(false);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // 메일 링크로 돌아온 딥링크 처리
  //
  // 같은 URL이 getInitialURL과 url 이벤트로 두 번 올 수 있다. 같은 code로 두 번 교환하면
  // 두 번째가 실패하는데, 그때 resetPending을 내리면 비밀번호를 바꾸지 않은 사용자가
  // 세션만 들고 홈으로 새어 나간다. 처리한 URL을 기억해 한 번만 다룬다.
  const handledUrls = useRef<Set<string>>(new Set());

  useEffect(() => {
    async function handle(url: string | null) {
      if (!url) return;
      if (handledUrls.current.has(url)) return;

      const link = parseAuthLink(url);
      if (link.kind === 'other') return;
      handledUrls.current.add(url);

      if (link.errorDescription) {
        setLinkError(mapAuthError({ message: link.errorDescription }).message);
        return;
      }
      if (!link.code) {
        setLinkError('링크에서 인증 정보를 찾지 못했습니다. 메일을 다시 보내 주세요.');
        return;
      }

      // 재설정이면 세션이 생기기 전에 먼저 세워 둔다. 게이트가 홈으로 보내는 것을 막는다.
      if (link.kind === 'reset') setResetPending(true);

      const { error } = await supabase.auth.exchangeCodeForSession(link.code);
      if (error) {
        // 세션이 이미 있으면(중복 교환 등) 대기를 유지한다. 내리면 홈으로 새기 때문이다.
        const current = await supabase.auth.getSession();
        if (!current.data.session) setResetPending(false);
        setLinkError(mapAuthError(error).message);
      } else {
        setLinkError(null);
      }
    }

    void Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (event) => void handle(event.url));
    return () => sub.remove();
  }, []);

  const endPasswordReset = useCallback(() => setResetPending(false), []);
  const clearLinkError = useCallback(() => setLinkError(null), []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      userId: session?.user.id ?? null,
      restoring,
      resetPending,
      linkError,
      endPasswordReset,
      clearLinkError,
    }),
    [session, restoring, resetPending, linkError, endPasswordReset, clearLinkError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
