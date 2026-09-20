// 로그인 세션 상태를 앱 전체에 공급한다. 세션 저장은 supabase-js가 AsyncStorage로 한다
import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

type AuthState = {
  session: Session | null;
  userId: string | null;
  // 최초 세션 복원이 끝나기 전에는 화면을 정하지 않는다. 로그인 화면이 깜빡이는 것을 막는다.
  restoring: boolean;
};

const AuthContext = createContext<AuthState>({ session: null, userId: null, restoring: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true);

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

  const value = useMemo<AuthState>(
    () => ({ session, userId: session?.user.id ?? null, restoring }),
    [session, restoring],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
