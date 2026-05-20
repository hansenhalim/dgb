import { useCallback, useState } from "react";

import { useActiveGate } from "@/config/activeGate";
import { useServices } from "@/config/container";
import type { GatePulseDirection } from "@/domain/ports";

export type VisitSuccessViewModel = {
  visitId: string;
  cardWritten: boolean;
  cardRetrying: boolean;
  cardRetryError: string | null;
  canRetryCard: boolean;
  retryCardWrite: () => Promise<void>;
  pulseGate: () => void;
};

export type UseVisitSuccessOptions = {
  visitId: string;
  rfidKey: string;
  initialCardWritten: boolean;
  cardPayloadHex: string;
  direction: GatePulseDirection;
};

export function useVisitSuccessViewModel({
  visitId,
  rfidKey,
  initialCardWritten,
  cardPayloadHex,
  direction,
}: UseVisitSuccessOptions): VisitSuccessViewModel {
  const { rfid, visits } = useServices();
  const { activeGate } = useActiveGate();

  const [cardWritten, setCardWritten] = useState(initialCardWritten);
  const [cardRetrying, setCardRetrying] = useState(false);
  const [cardRetryError, setCardRetryError] = useState<string | null>(null);

  const retryCardWrite = useCallback(async () => {
    if (cardRetrying || cardWritten) return;
    if (!rfidKey || !cardPayloadHex) {
      setCardRetryError("Data kartu tidak tersedia.");
      return;
    }
    setCardRetrying(true);
    setCardRetryError(null);
    try {
      await rfid.writeCard(rfidKey, cardPayloadHex);
      setCardWritten(true);
    } catch (e) {
      setCardRetryError(
        e instanceof Error ? e.message : "Gagal menulis ke kartu.",
      );
    } finally {
      setCardRetrying(false);
    }
  }, [cardPayloadHex, cardRetrying, cardWritten, rfid, rfidKey]);

  const pulseGate = useCallback(() => {
    if (!activeGate) return;
    visits
      .pulseGate({
        visitId,
        gateId: activeGate.id,
        direction,
      })
      .catch(() => {});
  }, [activeGate, direction, visitId, visits]);

  return {
    visitId,
    cardWritten,
    cardRetrying,
    cardRetryError,
    canRetryCard: !cardWritten && !cardRetrying,
    retryCardWrite,
    pulseGate,
  };
}
