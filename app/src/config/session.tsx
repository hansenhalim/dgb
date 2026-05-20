import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { Session } from "@/domain/entities";

import { useServices } from "./container";

type SessionContextValue = {
  session: Session | null;
  loading: boolean;
  setSession: (session: Session) => void;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { auth } = useServices();
  const [session, setSessionState] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    auth
      .currentSession()
      .then((s) => {
        if (!cancelled) setSessionState(s);
      })
      .catch(() => {
        if (!cancelled) setSessionState(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [auth]);

  const setSession = useCallback((next: Session) => {
    setSessionState(next);
  }, []);

  const logout = useCallback(async () => {
    await auth.logout();
    setSessionState(null);
  }, [auth]);

  const value = useMemo<SessionContextValue>(
    () => ({ session, loading, setSession, logout }),
    [session, loading, setSession, logout],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession must be used inside <SessionProvider>.");
  }
  return value;
}
