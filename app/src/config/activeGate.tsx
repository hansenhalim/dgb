import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { Gate } from "@/domain/entities";

import { useServices } from "./container";
import { useSession } from "./session";

const STORAGE_KEY = "dgb.activeGate.v1";

type ActiveGateContextValue = {
  /** The currently selected gate (matched against the latest `gates` list), or null until loaded. */
  activeGate: Gate | null;
  /** Cached list of gates from the most recent fetch. Null before the first fetch. */
  gates: Gate[] | null;
  loading: boolean;
  error: Error | null;
  /** Lazy-fetch the gates list. Safe to call multiple times — concurrent calls are deduped. */
  fetchGates: () => void;
  selectGate: (gateId: number) => Promise<void>;
};

const ActiveGateContext = createContext<ActiveGateContextValue | null>(null);

export function ActiveGateProvider({ children }: { children: ReactNode }) {
  const { session: sessionRepo } = useServices();
  const { session } = useSession();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [gates, setGates] = useState<Gate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = parseInt(raw, 10);
          if (Number.isFinite(parsed)) setSelectedId(parsed);
        }
      })
      .catch(() => {})
      .finally(() => setStorageReady(true));
  }, []);

  const fetchGates = useCallback(() => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    setError(null);
    sessionRepo
      .listGates()
      .then((list) => {
        setGates(list);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e : new Error("Gagal memuat gerbang."));
      })
      .finally(() => {
        setLoading(false);
        inFlightRef.current = false;
      });
  }, [sessionRepo]);

  // Fetch when we have a session (and storage has loaded so we can match the
  // stored selection without racing the auto-select). Clear on logout.
  useEffect(() => {
    if (!storageReady) return;
    if (!session) {
      setGates(null);
      setError(null);
      return;
    }
    fetchGates();
  }, [storageReady, session, fetchGates]);

  useEffect(() => {
    if (selectedId !== null) return;
    if (!gates) return;
    const firstAvailable = gates.find((g) => g.isAvailable) ?? gates[0];
    if (!firstAvailable) return;
    setSelectedId(firstAvailable.id);
    SecureStore.setItemAsync(STORAGE_KEY, String(firstAvailable.id)).catch(
      () => {},
    );
  }, [gates, selectedId]);

  const selectGate = useCallback(async (gateId: number) => {
    setSelectedId(gateId);
    await SecureStore.setItemAsync(STORAGE_KEY, String(gateId));
  }, []);

  const activeGate = useMemo<Gate | null>(() => {
    if (selectedId === null || !gates) return null;
    return gates.find((g) => g.id === selectedId) ?? null;
  }, [gates, selectedId]);

  const value = useMemo<ActiveGateContextValue>(
    () => ({ activeGate, gates, loading, error, fetchGates, selectGate }),
    [activeGate, gates, loading, error, fetchGates, selectGate],
  );

  return (
    <ActiveGateContext.Provider value={value}>
      {children}
    </ActiveGateContext.Provider>
  );
}

export function useActiveGate(): ActiveGateContextValue {
  const value = useContext(ActiveGateContext);
  if (!value) {
    throw new Error("useActiveGate must be used inside <ActiveGateProvider>.");
  }
  return value;
}
