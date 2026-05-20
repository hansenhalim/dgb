import { useCallback, useEffect, useRef, useState } from "react";

import { useServices } from "@/config/container";
import type { Session } from "@/domain/entities";
import { LoginError, type RfidReaderStatus } from "@/domain/ports";

export type LoginPhase = "idle" | "scanning" | "verifying";

export type LoginCtaIntent = "submit" | "openReader";

export type LoginCta = {
  label: string;
  enabled: boolean;
  canCancel: boolean;
  intent: LoginCtaIntent;
};

export type LoginViewModel = {
  pin: string;
  setPin: (next: string) => void;
  busy: boolean;
  readerConnected: boolean;
  phase: LoginPhase;
  error: string | null;
  canCancel: boolean;
  cta: LoginCta;
  cancel: () => void;
  submit: () => Promise<Session | null>;
};

const PIN_LENGTH = 6;
const CANCEL_DELAY_MS = 3000;

export function useLoginViewModel(): LoginViewModel {
  const { auth, rfid } = useServices();
  const [pin, setPinState] = useState("");
  const [status, setStatus] = useState<RfidReaderStatus>(rfid.getStatus());
  const [phase, setPhase] = useState<LoginPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [canCancel, setCanCancel] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setStatus(rfid.getStatus());
    return rfid.onStatusChange(setStatus);
  }, [rfid]);

  const setPin = useCallback((next: string) => {
    const digits = next.replace(/\D/g, "").slice(0, PIN_LENGTH);
    setPinState(digits);
    setError(null);
  }, []);

  const readerConnected = status.state === "connected";
  const pinReady = pin.length === PIN_LENGTH;
  const busy = phase !== "idle";
  const canSubmit = readerConnected && pinReady && phase === "idle";

  const cta: LoginCta =
    phase === "scanning"
      ? {
          label: "Memindai Kartu…",
          enabled: false,
          canCancel,
          intent: "submit",
        }
      : phase === "verifying"
        ? {
            label: "Memverifikasi…",
            enabled: false,
            canCancel: false,
            intent: "submit",
          }
        : !pinReady
          ? {
              label: "Masukkan PIN 6 Digit",
              enabled: false,
              canCancel: false,
              intent: "submit",
            }
          : !readerConnected
            ? {
                label: "Pilih Reader",
                enabled: true,
                canCancel: false,
                intent: "openReader",
              }
            : {
                label: "Scan Kartu RFID",
                enabled: true,
                canCancel: false,
                intent: "submit",
              };

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const submit = useCallback(async (): Promise<Session | null> => {
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
      setPhase("verifying");
      const session = await auth.login(pin, card);
      return session;
    } catch (e) {
      if (abort.signal.aborted) return null;
      if (e instanceof LoginError) {
        setError(e.message);
        if (e.code === "invalid_pin") setPinState("");
      } else {
        setError(e instanceof Error ? e.message : "Gagal masuk.");
      }
      return null;
    } finally {
      if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
      cancelTimerRef.current = null;
      abortRef.current = null;
      setCanCancel(false);
      setPhase("idle");
    }
  }, [auth, rfid, pin, canSubmit]);

  return {
    pin,
    setPin,
    busy,
    readerConnected,
    phase,
    error,
    canCancel,
    cta,
    cancel,
    submit,
  };
}
