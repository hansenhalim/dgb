import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";

import { useActiveGate } from "@/config/activeGate";
import { useServices } from "@/config/container";
import type { TransferRequest } from "@/domain/entities";

export type TransferDirection = "incoming" | "outgoing";

export type TransferRequestItem = TransferRequest & {
  direction: TransferDirection;
};

export type TransferRequestViewModel = {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  items: TransferRequestItem[];
  respondingId: number | null;
  respondError: string | null;
  reload: () => Promise<void>;
  confirm: (id: number) => Promise<void>;
  reject: (id: number) => Promise<void>;
};

export function useTransferRequestViewModel(): TransferRequestViewModel {
  const { transfers } = useServices();
  const { activeGate } = useActiveGate();
  const activeGateId = activeGate?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<TransferRequest[]>([]);
  const [respondingId, setRespondingId] = useState<number | null>(null);
  const [respondError, setRespondError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (activeGateId === null) return;
      if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        setPending(await transfers.getPending(activeGateId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memuat permintaan");
      } finally {
        if (mode === "refresh") setRefreshing(false);
        else setLoading(false);
      }
    },
    [activeGateId, transfers],
  );

  useFocusEffect(
    useCallback(() => {
      load("initial");
    }, [load]),
  );

  const reload = useCallback(() => load("refresh"), [load]);

  const respond = useCallback(
    async (id: number, status: "confirm" | "reject") => {
      setRespondingId(id);
      setRespondError(null);
      try {
        await transfers.respond(id, status);
        await load("refresh");
      } catch (e) {
        setRespondError(
          e instanceof Error ? e.message : "Gagal memproses permintaan",
        );
      } finally {
        setRespondingId(null);
      }
    },
    [transfers, load],
  );

  const confirm = useCallback((id: number) => respond(id, "confirm"), [respond]);
  const reject = useCallback((id: number) => respond(id, "reject"), [respond]);

  const items = useMemo<TransferRequestItem[]>(
    () =>
      pending.map((r) => ({
        ...r,
        direction: r.toGate.id === activeGateId ? "incoming" : "outgoing",
      })),
    [pending, activeGateId],
  );

  return {
    loading,
    refreshing,
    error,
    items,
    respondingId,
    respondError,
    reload,
    confirm,
    reject,
  };
}
