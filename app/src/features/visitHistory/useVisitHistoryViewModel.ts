import { useCallback, useEffect, useState } from "react";

import { useActiveGate } from "@/config/activeGate";
import { useServices } from "@/config/container";
import type { Gate, VisitHistoryEntry } from "@/domain/entities";

export type VisitHistoryViewModel = {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  entries: VisitHistoryEntry[];
  gate: Gate | null;
  reload: () => Promise<void>;
};

export function useVisitHistoryViewModel(): VisitHistoryViewModel {
  const { visits } = useServices();
  const { activeGate } = useActiveGate();
  const gateId = activeGate?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<VisitHistoryEntry[]>([]);

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (gateId === null) return;
      if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        setEntries(await visits.getHistory(gateId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memuat riwayat");
      } finally {
        if (mode === "refresh") setRefreshing(false);
        else setLoading(false);
      }
    },
    [gateId, visits],
  );

  useEffect(() => {
    load("initial");
  }, [load]);

  const reload = useCallback(() => load("refresh"), [load]);

  return {
    loading,
    refreshing,
    error,
    entries,
    gate: activeGate,
    reload,
  };
}
