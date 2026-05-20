import { useCallback, useMemo, useState } from "react";

import { useActiveGate } from "@/config/activeGate";
import { useServices } from "@/config/container";
import type { CardStateResponse } from "@/domain/ports";
import {
  CARD_PAYLOAD_BLANK_HEX,
  decodeVisitCardV1,
  withCardState,
  type DecodedVisitCard,
} from "@/domain/visitCard";

export type VisitPreviewError = {
  decode: string | null;
};

export type ActionPhase =
  | "idle"
  | "checkingOut"
  | "transiting"
  | "transitEntering";

export type ActionFailure =
  | { kind: "checkoutApi"; message: string }
  | { kind: "checkoutCard"; message: string }
  | { kind: "transitApi"; message: string }
  | { kind: "transitCard"; message: string }
  | { kind: "transitEnterApi"; message: string }
  | { kind: "transitEnterCard"; message: string };

export type SuccessOutcome = {
  visitId: string;
  flavor: "checkout" | "transit" | "transitEnter";
};

export type VisitPreviewViewModel = {
  decoded: DecodedVisitCard | null;
  decodeError: string | null;
  phase: ActionPhase;
  failure: ActionFailure | null;
  /** True after the API succeeded; only the failing card-write step needs retrying. */
  apiCommitted: boolean;
  checkout: () => Promise<void>;
  transit: () => Promise<void>;
  transitEnter: () => Promise<void>;
  /** Set once the full action (API + card) has completed; screen consumes and navigates. */
  success: SuccessOutcome | null;
};

export type UseVisitPreviewOptions = {
  uid: string;
  rfidKey: string;
  secretHex: string;
};

export function useVisitPreviewViewModel({
  rfidKey,
  secretHex,
}: UseVisitPreviewOptions): VisitPreviewViewModel {
  const { rfid, visits } = useServices();
  const { activeGate } = useActiveGate();

  const decodedOrError = useMemo(() => {
    try {
      return { decoded: decodeVisitCardV1(secretHex), error: null as null };
    } catch (e) {
      return {
        decoded: null,
        error: e instanceof Error ? e.message : "Gagal membaca kartu.",
      };
    }
  }, [secretHex]);

  const [phase, setPhase] = useState<ActionPhase>("idle");
  const [failure, setFailure] = useState<ActionFailure | null>(null);
  const [apiCommitted, setApiCommitted] = useState(false);
  /**
   * Cached server response between API commit and successful card write. On card-write
   * failure, retry uses this snapshot so the card and server stay in lockstep — same
   * retry guarantee as the prior `pendingTransitAt` pattern.
   */
  const [pendingResponse, setPendingResponse] =
    useState<CardStateResponse | null>(null);
  const [success, setSuccess] = useState<SuccessOutcome | null>(null);

  const checkout = useCallback(async () => {
    if (!decodedOrError.decoded) return;
    if (phase !== "idle") return;
    const visitId = decodedOrError.decoded.visitId;
    setPhase("checkingOut");
    setFailure(null);
    try {
      if (!apiCommitted) {
        try {
          await visits.checkout(visitId);
          setApiCommitted(true);
        } catch (e) {
          setFailure({
            kind: "checkoutApi",
            message:
              e instanceof Error ? e.message : "Gagal checkout di server.",
          });
          return;
        }
      }
      try {
        await rfid.writeCard(rfidKey, CARD_PAYLOAD_BLANK_HEX);
      } catch (e) {
        setFailure({
          kind: "checkoutCard",
          message: e instanceof Error ? e.message : "Gagal menghapus kartu.",
        });
        return;
      }
      setSuccess({ visitId, flavor: "checkout" });
    } finally {
      setPhase("idle");
    }
  }, [apiCommitted, decodedOrError.decoded, phase, rfid, rfidKey, visits]);

  const transitEnter = useCallback(async () => {
    if (!decodedOrError.decoded) return;
    if (phase !== "idle") return;
    if (!activeGate) {
      setFailure({
        kind: "transitEnterApi",
        message: "Gate aktif belum dipilih.",
      });
      return;
    }
    const decoded = decodedOrError.decoded;
    const visitId = decoded.visitId;
    const gateId = activeGate.id;
    setPhase("transitEntering");
    setFailure(null);
    try {
      let response = pendingResponse;
      if (!apiCommitted) {
        try {
          response = await visits.transitEnter(visitId, gateId);
          setPendingResponse(response);
          setApiCommitted(true);
        } catch (e) {
          setFailure({
            kind: "transitEnterApi",
            message:
              e instanceof Error ? e.message : "Gagal mencatat masuk.",
          });
          return;
        }
      }
      if (!response) return;
      try {
        const updatedHex = withCardState(decoded, response);
        await rfid.writeCard(rfidKey, updatedHex);
      } catch (e) {
        setFailure({
          kind: "transitEnterCard",
          message:
            e instanceof Error ? e.message : "Gagal menulis ulang kartu.",
        });
        return;
      }
      setSuccess({ visitId, flavor: "transitEnter" });
    } finally {
      setPhase("idle");
    }
  }, [
    activeGate,
    apiCommitted,
    decodedOrError.decoded,
    pendingResponse,
    phase,
    rfid,
    rfidKey,
    visits,
  ]);

  const transit = useCallback(async () => {
    if (!decodedOrError.decoded) return;
    if (phase !== "idle") return;
    if (!activeGate) {
      setFailure({
        kind: "transitApi",
        message: "Gate aktif belum dipilih.",
      });
      return;
    }
    const decoded = decodedOrError.decoded;
    const visitId = decoded.visitId;
    const gateId = activeGate.id;
    setPhase("transiting");
    setFailure(null);
    try {
      let response = pendingResponse;
      if (!apiCommitted) {
        try {
          response = await visits.transit(visitId, gateId);
          setPendingResponse(response);
          setApiCommitted(true);
        } catch (e) {
          setFailure({
            kind: "transitApi",
            message:
              e instanceof Error ? e.message : "Gagal mencatat transit.",
          });
          return;
        }
      }
      if (!response) return;
      try {
        const updatedHex = withCardState(decoded, response);
        await rfid.writeCard(rfidKey, updatedHex);
      } catch (e) {
        setFailure({
          kind: "transitCard",
          message:
            e instanceof Error ? e.message : "Gagal menulis transit ke kartu.",
        });
        return;
      }
      setSuccess({ visitId, flavor: "transit" });
    } finally {
      setPhase("idle");
    }
  }, [
    activeGate,
    apiCommitted,
    decodedOrError.decoded,
    pendingResponse,
    phase,
    rfid,
    rfidKey,
    visits,
  ]);

  return {
    decoded: decodedOrError.decoded,
    decodeError: decodedOrError.error,
    phase,
    failure,
    apiCommitted,
    checkout,
    transit,
    transitEnter,
    success,
  };
}
