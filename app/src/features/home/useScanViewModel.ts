import { useCallback, useEffect, useRef, useState } from "react";

import { useServices } from "@/config/container";
import type { RfidReaderStatus } from "@/domain/ports";

export type ScanPhase = "idle" | "scanning" | "reading";

export type ScanResult = {
  uid: string;
  rfidKey: string;
  secret: string;
  isEmpty: boolean;
};

export type ScanCtaIntent = "scan" | "openReader";

export type ScanCta = {
  label: string;
  enabled: boolean;
  canCancel: boolean;
  intent: ScanCtaIntent;
};

export type ScanViewModel = {
  readerConnected: boolean;
  phase: ScanPhase;
  error: string | null;
  canCancel: boolean;
  cta: ScanCta;
  cancel: () => void;
  submit: () => Promise<ScanResult | null>;
};

const CANCEL_DELAY_MS = 3000;

/** A card is "empty" when its authenticated-read payload is all zeros. */
function isEmptySecret(hex: string): boolean {
  return /^0+$/.test(hex);
}

export function useScanViewModel(): ScanViewModel {
  const { rfid, session } = useServices();
  const [status, setStatus] = useState<RfidReaderStatus>(rfid.getStatus());
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [canCancel, setCanCancel] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setStatus(rfid.getStatus());
    return rfid.onStatusChange(setStatus);
  }, [rfid]);

  const readerConnected = status.state === "connected";
  const canSubmit = readerConnected && phase === "idle";

  const cta: ScanCta =
    !readerConnected
      ? {
          label: "Pilih Reader",
          enabled: true,
          canCancel: false,
          intent: "openReader",
        }
      : phase === "scanning"
        ? {
            label: "Memindai Kartu…",
            enabled: false,
            canCancel,
            intent: "scan",
          }
        : phase === "reading"
          ? {
              label: "Membaca Kartu…",
              enabled: false,
              canCancel: false,
              intent: "scan",
            }
          : {
              label: "Scan Kartu RFID",
              enabled: true,
              canCancel: false,
              intent: "scan",
            };

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const submit = useCallback(async (): Promise<ScanResult | null> => {
    if (!canSubmit) return null;
    setError(null);
    setPhase("scanning");
    setCanCancel(false);

    const abort = new AbortController();
    abortRef.current = abort;
    cancelTimerRef.current = setTimeout(
      () => setCanCancel(true),
      CANCEL_DELAY_MS,
    );

    try {
      const card = await rfid.scanCard(abort.signal);
      setPhase("reading");
      const rfidKey = await session.getRfidKey(card.uid);
      const secret = await card.readSecret(rfidKey);
      const isEmpty = isEmptySecret(secret);
      return { uid: card.uid, rfidKey, secret, isEmpty };
    } catch (e) {
      if (!abort.signal.aborted) {
        setError(e instanceof Error ? e.message : "Gagal memindai kartu.");
      }
      return null;
    } finally {
      if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
      cancelTimerRef.current = null;
      abortRef.current = null;
      setCanCancel(false);
      setPhase("idle");
    }
  }, [rfid, session, canSubmit]);

  return {
    readerConnected,
    phase,
    error,
    canCancel,
    cta,
    cancel,
    submit,
  };
}
