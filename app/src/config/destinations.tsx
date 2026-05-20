import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { Destination } from "@/domain/entities";

import { useServices } from "./container";

type DestinationsContextValue = {
  destinations: Destination[] | null;
  loading: boolean;
  error: Error | null;
  fetch: () => void;
};

const DestinationsContext = createContext<DestinationsContextValue | null>(
  null,
);

export function DestinationsProvider({ children }: { children: ReactNode }) {
  const { session } = useServices();
  const [destinations, setDestinations] = useState<Destination[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const inFlightRef = useRef(false);

  const fetch = useCallback(() => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    setError(null);
    session
      .listDestinations()
      .then((list) => {
        setDestinations(list);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e : new Error("Gagal memuat tujuan."));
      })
      .finally(() => {
        setLoading(false);
        inFlightRef.current = false;
      });
  }, [session]);

  const value = useMemo<DestinationsContextValue>(
    () => ({ destinations, loading, error, fetch }),
    [destinations, loading, error, fetch],
  );

  return (
    <DestinationsContext.Provider value={value}>
      {children}
    </DestinationsContext.Provider>
  );
}

export function useDestinations(): DestinationsContextValue {
  const value = useContext(DestinationsContext);
  if (!value) {
    throw new Error(
      "useDestinations must be used inside <DestinationsProvider>.",
    );
  }
  return value;
}
