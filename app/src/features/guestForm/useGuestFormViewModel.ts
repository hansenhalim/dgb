import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useCallback, useEffect, useRef, useState } from "react";

import { useActiveGate } from "@/config/activeGate";
import { useServices } from "@/config/container";
import { useDestinations } from "@/config/destinations";
import type { VisitorPreflight } from "@/domain/ports";
import {
  KEPERLUAN_LAINNYA_INDEX,
  KEPERLUAN_OPTIONS,
  encodeVisitCardV1,
  type Keperluan,
} from "@/domain/visitCard";

export { KEPERLUAN_OPTIONS } from "@/domain/visitCard";
export type { Keperluan } from "@/domain/visitCard";

export type PreflightStatus =
  | "idle"
  | "loading"
  | "banned"
  | "clear"
  | "error";

/** Debounce window for SIM-length (12-digit) inputs before firing preflight. */
const PREFLIGHT_DEBOUNCE_MS = 500;

const PHOTO_BYTE_LIMIT = 512 * 1024;
const PHOTO_FALLBACK_COMPRESS = 0.6;

export type SaveResult = {
  visitId: string;
  cardWritten: boolean;
  cardPayloadHex: string;
};

export type GuestFormViewModel = {
  photoUri: string | undefined;
  isProcessing: boolean;
  saving: boolean;
  error: string | null;
  nik: string;
  nama: string;
  plat: string;
  tujuan: string;
  keperluan: Keperluan | null;
  keperluanOther: string;
  setNik: (v: string) => void;
  normalizeNik: () => void;
  setNama: (v: string) => void;
  setPlat: (v: string) => void;
  setTujuan: (v: string) => void;
  setKeperluan: (v: Keperluan) => void;
  setKeperluanOther: (v: string) => void;
  preflightStatus: PreflightStatus;
  preflightVisitor: VisitorPreflight | null;
  canSave: boolean;
  save: () => Promise<SaveResult | null>;
};

const formatPlate = (raw: string) =>
  raw
    .replace(/\s+/g, "")
    .toUpperCase()
    .replace(/([A-Z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Z])/g, "$1 $2");

const sanitizeNik = (raw: string) => raw.replace(/\D/g, "").slice(0, 16);

/**
 * Finalize an OCR'd identity number for storage, or null to reject the read.
 * A NIK (KTP) arrives as 16 digits and is stored as-is. A SIM number arrives
 * 12 (old) or 14 (new) digits and is left-padded with zeros to 16 — every
 * identity is normalized to 16 digits, which the card schema requires. Any
 * other length is treated as a misread and rejected, leaving the field blank
 * for manual entry. A short value tagged as NIK is NOT padded: a 13-digit NIK
 * is a misread, not a SIM, so it must fail loudly rather than become a wrong
 * zero-padded value.
 */
const finalizeOcrId = (digits: string, fromSim: boolean): string | null => {
  if (digits.length === 16) return digits;
  if (fromSim && (digits.length === 12 || digits.length === 14)) {
    return digits.padStart(16, "0");
  }
  return null;
};

async function getFileSize(uri: string): Promise<number> {
  const res = await fetch(uri);
  const blob = await res.blob();
  return blob.size;
}

async function ensurePhotoUnderLimit(uri: string): Promise<string> {
  const size = await getFileSize(uri);
  if (size <= PHOTO_BYTE_LIMIT) return uri;
  const rendered = await ImageManipulator.manipulate(uri).renderAsync();
  let saved;
  try {
    saved = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: PHOTO_FALLBACK_COMPRESS,
    });
  } finally {
    // Release the native bitmap immediately — Hermes GC can't see its size and
    // under-collects, leaking native memory across repeated visits.
    rendered.release();
  }
  const recompressedSize = await getFileSize(saved.uri);
  if (recompressedSize > PHOTO_BYTE_LIMIT) {
    throw new Error("Foto identitas terlalu besar (>512KB).");
  }
  return saved.uri;
}

export function useGuestFormViewModel(
  rawPhotoUri: string | undefined,
  uid: string | undefined,
  rfidKey: string | undefined,
): GuestFormViewModel {
  const { idExtractor, visits, visitors, rfid } = useServices();
  const { activeGate } = useActiveGate();
  const {
    destinations,
    loading: destinationsLoading,
    fetch: fetchDestinations,
  } = useDestinations();

  const [photoUri, setPhotoUri] = useState<string | undefined>(rawPhotoUri);
  const [isProcessing, setIsProcessing] = useState<boolean>(!!rawPhotoUri);
  const [nik, setNikRaw] = useState("");
  const [nama, setNama] = useState("");
  const [plat, setPlatRaw] = useState("");
  const [tujuan, setTujuan] = useState("");
  const [keperluan, setKeperluan] = useState<Keperluan | null>(null);
  const [keperluanOther, setKeperluanOther] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preflightStatus, setPreflightStatus] =
    useState<PreflightStatus>("idle");
  const [preflightVisitor, setPreflightVisitor] =
    useState<VisitorPreflight | null>(null);

  const setNik = useCallback((v: string) => {
    setError(null);
    setNikRaw(sanitizeNik(v));
  }, []);
  // A manually-typed SIM (12 or 14 digits) is left-padded to 16 when the field
  // loses focus, mirroring the OCR path. OCR-filled and 16-digit NIK values are
  // already 16 and pass through untouched.
  const normalizeNik = useCallback(() => {
    setNikRaw((curr) =>
      curr.length === 12 || curr.length === 14 ? curr.padStart(16, "0") : curr,
    );
  }, []);
  const setPlat = useCallback((v: string) => {
    setError(null);
    setPlatRaw(formatPlate(v));
  }, []);

  const triedLazyFetchRef = useRef(false);
  useEffect(() => {
    if (triedLazyFetchRef.current) return;
    if (destinations || destinationsLoading) return;
    triedLazyFetchRef.current = true;
    fetchDestinations();
  }, [destinations, destinationsLoading, fetchDestinations]);

  const preflightAbortRef = useRef<AbortController | null>(null);
  const preflightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preflightRequestIdRef = useRef(0);
  const preflightCompletedNikRef = useRef<string | null>(null);

  useEffect(() => {
    // Any change in NIK invalidates the in-flight or scheduled fire.
    preflightAbortRef.current?.abort();
    preflightAbortRef.current = null;
    if (preflightTimerRef.current) {
      clearTimeout(preflightTimerRef.current);
      preflightTimerRef.current = null;
    }

    const len = nik.length;
    if (len !== 12 && len !== 16) {
      preflightCompletedNikRef.current = null;
      setPreflightStatus("idle");
      setPreflightVisitor(null);
      return;
    }

    const padded = nik.padStart(16, "0");
    if (preflightCompletedNikRef.current === padded) return;

    const fire = () => {
      const requestId = ++preflightRequestIdRef.current;
      const abort = new AbortController();
      preflightAbortRef.current = abort;
      setPreflightStatus("loading");

      visitors
        .lookup(padded, abort.signal)
        .then((result) => {
          if (preflightRequestIdRef.current !== requestId) return;
          preflightCompletedNikRef.current = padded;
          if (!result) {
            setPreflightVisitor(null);
            setPreflightStatus("clear");
            return;
          }
          setPreflightVisitor(result);
          setPreflightStatus(result.bannedAt !== null ? "banned" : "clear");

          // Nama is server-authoritative: override OCR/manual entry. OCR can
          // mis-read characters (0/O, 1/I) and the server record is canonical.
          setNama(result.fullname);
          const last = result.latestVisit;
          if (!last) return;
          // Remaining fields stay fill-if-empty: this visit's plate/destination/
          // purpose may differ from history, so don't clobber what's there.
          if (last.vehiclePlateNumber) {
            setPlatRaw((curr) =>
              curr === "" ? formatPlate(last.vehiclePlateNumber) : curr,
            );
          }
          if (last.destinationName) {
            setTujuan((curr) =>
              curr === "" ? last.destinationName : curr,
            );
          }
          if (last.purposeOfVisit) {
            const purpose = last.purposeOfVisit;
            const isFixed =
              purpose !== "Lainnya" &&
              (KEPERLUAN_OPTIONS as readonly string[]).includes(purpose);
            setKeperluan((curr) => {
              if (curr !== null) return curr;
              return isFixed ? (purpose as Keperluan) : "Lainnya";
            });
            if (!isFixed) {
              setKeperluanOther((curr) => (curr === "" ? purpose : curr));
            }
          }
        })
        .catch(() => {
          if (abort.signal.aborted) return;
          if (preflightRequestIdRef.current !== requestId) return;
          // Silent fail per design — no banner, no save block.
          setPreflightVisitor(null);
          setPreflightStatus("error");
        });
    };

    if (len === 16) {
      fire();
    } else {
      preflightTimerRef.current = setTimeout(fire, PREFLIGHT_DEBOUNCE_MS);
    }
  }, [nik, visitors]);

  useEffect(() => {
    if (!rawPhotoUri) return;
    let cancelled = false;
    setIsProcessing(true);
    (async () => {
      try {
        const rendered = await ImageManipulator.manipulate(rawPhotoUri)
          .rotate(90)
          .renderAsync();
        let saved;
        try {
          saved = await rendered.saveAsync({
            format: SaveFormat.JPEG,
            compress: 0.9,
          });
        } finally {
          // Release the native bitmap immediately — Hermes GC can't see its
          // size and under-collects, leaking native memory across visits.
          rendered.release();
        }
        if (cancelled) return;
        setPhotoUri(saved.uri);

        const extracted = await idExtractor.extract(saved.uri);
        if (cancelled) return;
        const idNumber = extracted.nik || extracted.nomorSim;
        const fromSim = !extracted.nik && !!extracted.nomorSim;
        if (idNumber) {
          const finalized = finalizeOcrId(sanitizeNik(idNumber), fromSim);
          if (finalized) setNikRaw(finalized);
        }
        if (extracted.nama) setNama(extracted.nama);
      } catch {
        // Allow manual entry on OCR failure.
      } finally {
        if (!cancelled) setIsProcessing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rawPhotoUri, idExtractor]);

  const keperluanComplete =
    keperluan !== null &&
    (keperluan !== "Lainnya" || keperluanOther.trim().length > 0);

  const tujuanValid =
    !!destinations && destinations.some((d) => d.name === tujuan);

  const canSave =
    !saving &&
    !isProcessing &&
    !!photoUri &&
    !!uid &&
    !!rfidKey &&
    !!activeGate &&
    activeGate.id !== 4 &&
    nik.length === 16 &&
    nama.trim().length > 0 &&
    tujuanValid &&
    keperluanComplete;

  const save = useCallback(async (): Promise<SaveResult | null> => {
    if (!canSave || !keperluan || !photoUri || !uid || !rfidKey || !activeGate)
      return null;
    setSaving(true);
    setError(null);
    try {
      const paddedNik = nik.padStart(16, "0");
      const purposeOfVisit =
        keperluan === "Lainnya" ? keperluanOther.trim() : keperluan;
      const plateNoSpaces = plat.replace(/\s+/g, "");

      let uploadUri: string;
      try {
        uploadUri = await ensurePhotoUnderLimit(photoUri);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Foto tidak dapat diproses.");
        return null;
      }

      let visitId: string;
      let currentArea;
      let updatedAt: number;
      try {
        const result = await visits.create({
          uid,
          photoUri: uploadUri,
          identityNumber: paddedNik,
          fullname: nama.trim(),
          vehiclePlateNumber: plat.trim(),
          purposeOfVisit,
          destinationName: tujuan,
          gateId: activeGate.id,
        });
        visitId = result.visitId;
        currentArea = result.currentArea;
        updatedAt = result.updatedAt;
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Gagal mengirim data kunjungan.",
        );
        return null;
      }

      const purposeEnum = KEPERLUAN_OPTIONS.indexOf(keperluan);
      const cardPayloadHex = encodeVisitCardV1({
        visitId,
        identityNumber: paddedNik,
        purposeEnum,
        purposeCustom:
          purposeEnum === KEPERLUAN_LAINNYA_INDEX ? keperluanOther.trim() : "",
        plate: plateNoSpaces,
        destination: tujuan,
        fullname: nama.trim(),
        currentArea,
        updatedAt,
      });

      let cardWritten = false;
      try {
        await rfid.writeCard(rfidKey, cardPayloadHex);
        cardWritten = true;
      } catch {
        // Surface via the visit-success recovery banner; do not block the flow.
      }

      return { visitId, cardWritten, cardPayloadHex };
    } finally {
      setSaving(false);
    }
  }, [
    activeGate,
    canSave,
    keperluan,
    keperluanOther,
    nama,
    nik,
    photoUri,
    plat,
    rfid,
    rfidKey,
    tujuan,
    uid,
    visits,
  ]);

  return {
    photoUri,
    isProcessing,
    saving,
    error,
    nik,
    nama,
    plat,
    tujuan,
    keperluan,
    keperluanOther,
    setNik,
    normalizeNik,
    setNama,
    setPlat,
    setTujuan,
    setKeperluan,
    setKeperluanOther,
    preflightStatus,
    preflightVisitor,
    canSave,
    save,
  };
}
