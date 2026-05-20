import { useCallback, useEffect, useMemo, useState } from "react";

import { useActiveGate } from "@/config/activeGate";
import { useServices } from "@/config/container";
import type { CardStock, Gate } from "@/domain/entities";

export type StockImpact = {
  sourceBefore: number;
  sourceAfter: number;
  destBefore: number;
  destAfter: number;
  sourceLow: boolean;
};

export type NewTransferRequestViewModel = {
  loading: boolean;
  loadError: string | null;
  sourceGate: Gate | null;
  cardStock: CardStock | null;
  receivers: Gate[];
  selectedReceiverId: number | null;
  amountText: string;
  maxAmount: number;
  amount: number | null;
  exceedsMax: boolean;
  valid: boolean;
  impact: StockImpact | null;
  submitting: boolean;
  submitError: string | null;
  setReceiver: (gateId: number) => void;
  setAmount: (text: string) => void;
  reload: () => Promise<void>;
  submit: () => Promise<boolean>;
};

const LOW_STOCK_THRESHOLD = 0.2;

export function useNewTransferRequestViewModel(): NewTransferRequestViewModel {
  const { transfers, session } = useServices();
  const { activeGate } = useActiveGate();
  const sourceGateId = activeGate?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cardStock, setCardStock] = useState<CardStock | null>(null);
  const [gates, setGates] = useState<Gate[]>([]);
  const [selectedReceiverId, setSelectedReceiverId] = useState<number | null>(
    null,
  );
  const [amountText, setAmountText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [dashboard, list] = await Promise.all([
        session.getDashboard(),
        session.listGates(),
      ]);
      setCardStock(dashboard.cardStock);
      setGates(list);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  const receivers = useMemo(
    () => gates.filter((g) => g.id !== sourceGateId),
    [gates, sourceGateId],
  );

  const maxAmount = cardStock?.available ?? 0;
  const parsedAmount = amountText.length > 0 ? parseInt(amountText, 10) : NaN;
  const amount = Number.isFinite(parsedAmount) ? parsedAmount : null;
  const exceedsMax = amount !== null && amount > maxAmount;
  const valid =
    selectedReceiverId !== null &&
    amount !== null &&
    amount >= 1 &&
    amount <= maxAmount &&
    cardStock !== null;

  const impact = useMemo<StockImpact | null>(() => {
    if (!valid || amount === null || cardStock === null) return null;
    const dest = gates.find((g) => g.id === selectedReceiverId);
    if (!dest) return null;
    const sourceAfter = cardStock.available - amount;
    const destAfter = dest.currentQuota + amount;
    return {
      sourceBefore: cardStock.available,
      sourceAfter,
      destBefore: dest.currentQuota,
      destAfter,
      sourceLow: sourceAfter / cardStock.total < LOW_STOCK_THRESHOLD,
    };
  }, [valid, amount, cardStock, gates, selectedReceiverId]);

  const setReceiver = useCallback((gateId: number) => {
    setSelectedReceiverId(gateId);
  }, []);

  const setAmount = useCallback((text: string) => {
    // Strip non-digits — number-pad keyboard may still emit punctuation on some platforms.
    setAmountText(text.replace(/\D/g, ""));
  }, []);

  const submit = useCallback(async () => {
    if (!valid || sourceGateId === null || selectedReceiverId === null || amount === null) {
      return false;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await transfers.create({
        fromGateId: sourceGateId,
        toGateId: selectedReceiverId,
        amount,
      });
      return true;
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : "Gagal membuat permintaan",
      );
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [valid, sourceGateId, selectedReceiverId, amount, transfers]);

  return {
    loading,
    loadError,
    sourceGate: activeGate,
    cardStock,
    receivers,
    selectedReceiverId,
    amountText,
    maxAmount,
    amount,
    exceedsMax,
    valid,
    impact,
    submitting,
    submitError,
    setReceiver,
    setAmount,
    reload: load,
    submit,
  };
}
