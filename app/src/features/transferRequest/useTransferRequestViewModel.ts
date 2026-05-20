import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";

import { useActiveGate } from "@/config/activeGate";
import { useServices } from "@/config/container";
import type { TransferRequest } from "@/domain/entities";

export type TransferDirection = "incoming" | "outgoing";

export type TransferRequestViewModel = {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  pending: TransferRequest | null;
  direction: TransferDirection | null;
  responding: boolean;
  respondError: string | null;
  reload: () => Promise<void>;
  confirm: () => Promise<void>;
  reject: () => Promise<void>;
};

export function useTransferRequestViewModel(): TransferRequestViewModel {
  const { transfers } = useServices();
  const { activeGate } = useActiveGate();
  const activeGateId = activeGate?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<TransferRequest | null>(null);
  const [responding, setResponding] = useState(false);
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
    async (status: "confirm" | "reject") => {
      if (!pending) return;
      setResponding(true);
      setRespondError(null);
      try {
        await transfers.respond(pending.id, status);
        await load("refresh");
      } catch (e) {
        setRespondError(
          e instanceof Error ? e.message : "Gagal memproses permintaan",
        );
      } finally {
        setResponding(false);
      }
    },
    [pending, transfers, load],
  );

  const confirm = useCallback(() => respond("confirm"), [respond]);
  const reject = useCallback(() => respond("reject"), [respond]);

  const direction: TransferDirection | null = pending
    ? pending.toGate.id === activeGateId
      ? "incoming"
      : "outgoing"
    : null;

  return {
    loading,
    refreshing,
    error,
    pending,
    direction,
    responding,
    respondError,
    reload,
    confirm,
    reject,
  };
}
