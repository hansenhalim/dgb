import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";

import { useActiveGate } from "@/config/activeGate";
import { useServices } from "@/config/container";
import type {
  CardStock,
  Gate,
  TransferRequest,
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
  pendingIncoming: TransferRequest | null;
  reload: () => Promise<void>;
  selectGate: (gateId: number) => Promise<void>;
};

const LOW_STOCK_THRESHOLD = 0.2;

export function useHomeViewModel(): HomeViewModel {
  const { session, transfers } = useServices();
  const { activeGate, gates, selectGate } = useActiveGate();
  const activeGateId = activeGate?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardStock, setCardStock] = useState<CardStock | null>(null);
  const [visits, setVisits] = useState<VisitSummary | null>(null);
  const [pendingIncoming, setPendingIncoming] = useState<TransferRequest | null>(
    null,
  );

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const dashboard = await session.getDashboard();
        setCardStock(dashboard.cardStock);
        setVisits(dashboard.visits);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memuat data");
      } finally {
        if (mode === "refresh") setRefreshing(false);
        else setLoading(false);
      }
    },
    [session],
  );

  useEffect(() => {
    load("initial");
  }, [load]);

  const reload = useCallback(() => load("refresh"), [load]);

  // Re-check the inbox each time home regains focus (post-respond, post-create, etc.).
  useFocusEffect(
    useCallback(() => {
      if (activeGateId === null) return;
      let cancelled = false;
      transfers
        .getPending(activeGateId)
        .then((req) => {
          if (cancelled) return;
          // Only surface a banner when this gate is the receiver — outgoing isn't actionable here.
          setPendingIncoming(req && req.toGate.id === activeGateId ? req : null);
        })
        .catch(() => {
          if (cancelled) return;
          setPendingIncoming(null);
        });
      return () => {
        cancelled = true;
      };
    }, [activeGateId, transfers]),
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
    pendingIncoming,
    reload,
    selectGate,
  };
}
