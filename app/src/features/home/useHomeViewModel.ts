import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";

import { useActiveGate } from "@/config/activeGate";
import { useServices } from "@/config/container";
import type {
  CardStock,
  Gate,
  VisitSummary,
} from "@/domain/entities";

export type HomeViewModel = {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  gate: Gate | null;
  gates: Gate[] | null;
  cardStock: CardStock | null;
  visits: VisitSummary | null;
  lowStock: boolean;
  hasIncomingTransferRequest: boolean;
  reload: () => Promise<void>;
  selectGate: (gateId: number) => Promise<void>;
};

const LOW_STOCK_THRESHOLD = 0.2;

export function useHomeViewModel(): HomeViewModel {
  const { session } = useServices();
  const { activeGate, gates, selectGate } = useActiveGate();
  const activeGateId = activeGate?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardStock, setCardStock] = useState<CardStock | null>(null);
  const [visits, setVisits] = useState<VisitSummary | null>(null);
  const [hasIncomingTransferRequest, setHasIncomingTransferRequest] =
    useState(false);

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (activeGateId === null) return;
      if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const dashboard = await session.getDashboard(activeGateId);
        setCardStock(dashboard.cardStock);
        setVisits(dashboard.visits);
        setHasIncomingTransferRequest(dashboard.hasIncomingTransferRequest);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memuat data");
      } finally {
        if (mode === "refresh") setRefreshing(false);
        else setLoading(false);
      }
    },
    [activeGateId, session],
  );

  // Full initial load whenever the active gate changes (incl. first mount).
  // Suppress the immediate focus-effect fire so we don't double-load.
  const skipNextFocusRef = useRef(true);
  useEffect(() => {
    skipNextFocusRef.current = true;
    load("initial");
  }, [load]);

  const reload = useCallback(() => load("refresh"), [load]);

  // Refetch on subsequent focus events so post-respond / post-create transitions
  // update both the dashboard counts and the incoming-transfer banner.
  useFocusEffect(
    useCallback(() => {
      if (skipNextFocusRef.current) {
        skipNextFocusRef.current = false;
        return;
      }
      load("refresh");
    }, [load]),
  );

  const lowStock =
    cardStock !== null && cardStock.available / cardStock.total < LOW_STOCK_THRESHOLD;

  return {
    loading,
    refreshing,
    error,
    gate: activeGate,
    gates,
    cardStock,
    visits,
    lowStock,
    hasIncomingTransferRequest,
    reload,
    selectGate,
  };
}
