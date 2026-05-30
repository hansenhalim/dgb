/**
 * Backward-compatible decoder for the legacy "compressed" RFID card format.
 *
 * Full format spec: see the old-format section in the project docs.
 * This file is intentionally isolated so it can be deleted as one unit when
 * legacy card support is retired.
 */

import {
  KEPERLUAN_LAINNYA_INDEX,
  KEPERLUAN_OPTIONS,
  maskFullname,
  type CardArea,
  type DecodedVisitCard,
} from "./visitCard";

const MIN_VALID_TIMESTAMP_MS = 946684800000; // Jan 1 2000

/**
 * Map a legacy purpose string to a v1 purpose enum.
 *
 * Real cards have been observed storing the purpose three different ways:
 *  - the v1 label directly ("Bertamu")          ← seen on production cards
 *  - the old verbose label ("Bertamu aja")      ← per the legacy schema doc
 *  - the "POV n" code ("POV 1")                  ← per the legacy schema doc
 * All three normalize to the same enum so the upgrade-write produces a clean v1
 * purpose instead of dumping the text into the Lainnya custom slot.
 */
const PURPOSE_TO_ENUM: Record<string, number> = {
  // enum 0 — Bertamu
  bertamu: 0,
  "bertamu aja": 0,
  "pov 1": 0,
  // enum 1 — Antar Jemput
  "antar jemput": 1,
  "antar jemput warga": 1,
  "pov 2": 1,
  // enum 2 — Pengantaran barang
  "pengantaran barang": 2,
  "pov 3": 2,
};

function mapPurpose(raw: string): { purposeEnum: number; purposeCustom: string } {
  const known = PURPOSE_TO_ENUM[raw.trim().toLowerCase()];
  if (known !== undefined) {
    return { purposeEnum: known, purposeCustom: "" };
  }
  // Unknown purpose → Lainnya, preserving the raw text. Fall back to a
  // non-empty placeholder so the v1 encoder (which requires a custom value
  // for Lainnya) never throws on the upgrade-write.
  return {
    purposeEnum: KEPERLUAN_LAINNYA_INDEX,
    purposeCustom: raw.trim() || "Lainnya",
  };
}

function hexToString(hex: string): string {
  let result = "";
  for (let i = 0; i + 1 < hex.length; i += 2) {
    const charCode = parseInt(hex.slice(i, i + 2), 16);
    if (charCode === 0) break;
    result += String.fromCharCode(charCode);
  }
  return result;
}

function formatUUID(raw: string): string {
  // Card hex is uppercase; the v1 decoder always emits lowercase UUIDs, and
  // visit_id is the key for every API call — match that casing exactly.
  return raw
    .toLowerCase()
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
}

interface LegacyParsed {
  identityMask: string;
  fullname: string;
  plate: string;
  purposeCode: string;
  destination: string;
  visitId: string;
  transitAt: number | null;
  visitedGate4: boolean;
}

function parseLegacyFields(hex: string): LegacyParsed {
  if (!hex.toUpperCase().includes("1C")) {
    throw new Error("Bukan format lama: separator tidak ditemukan");
  }

  let parts = hex.split(/1[cC]/);

  // UUID-collision repair: the UUID field (#7) can itself contain the "1c"
  // separator bytes, splitting it into multiple parts. Rejoin from index 7
  // until we have 32 chars, then carry on with the remaining parts.
  if (parts.length > 11) {
    const fixed = parts.slice(0, 7);
    const uuidParts: string[] = [];
    for (let i = 7; i < parts.length; i++) {
      uuidParts.push(parts[i]);
      const joined = uuidParts.join("1c").toLowerCase();
      if (joined.length >= 32) {
        fixed.push(joined.slice(0, 32));
        const rem = joined.slice(32);
        if (rem.length > 0) fixed.push(rem);
        fixed.push(...parts.slice(i + 1));
        break;
      }
    }
    parts = fixed.slice(0, 11);
  }

  if (parts.length < 11) {
    throw new Error(
      `Format lama tidak valid: butuh 11 field, dapat ${parts.length}`,
    );
  }

  // Positions 5 and 6 are the allowed-enter / allowed-exit gate bitmasks. The
  // v1 card carries no per-card gate permissions (gate access is governed by
  // gateAreaMap + the server), so those two fields are intentionally skipped.
  const [
    identityHex,
    fullnameHex,
    plateHex,
    purposeHex,
    destinationHex,
    ,
    ,
    visitId,
    transitAtHex,
    gate4Hex,
  ] = parts;

  // Identity — lossy: only 6 digits (first 3 + last 3) survived. Reconstruct
  // the 16-char mask expected by DecodedVisitCard ("AAA**********BBB").
  const identityDigits = parseInt(identityHex, 16)
    .toString()
    .padStart(6, "0");
  const identityMask =
    identityDigits.slice(0, 3) + "**********" + identityDigits.slice(3, 6);

  const transitAtValue = parseInt(transitAtHex, 16);

  return {
    identityMask,
    fullname: hexToString(fullnameHex),
    plate: hexToString(plateHex).replace(/\s+/g, ""),
    purposeCode: hexToString(purposeHex),
    destination: hexToString(destinationHex),
    visitId: formatUUID(visitId),
    transitAt:
      transitAtValue < MIN_VALID_TIMESTAMP_MS ? null : transitAtValue,
    visitedGate4: gate4Hex === "01",
  };
}

/**
 * Decode a legacy compressed RFID payload (1024 hex chars) and map it to a
 * DecodedVisitCard so the rest of the app can treat it identically to a v1 card.
 *
 * Throws if the payload is not a valid legacy card.
 */
export function decodeLegacyCardAsV1(hex: string): DecodedVisitCard {
  const legacy = parseLegacyFields(hex);

  const inTransit = legacy.transitAt !== null;
  const currentArea: CardArea = inTransit
    ? "TRNST"
    : legacy.visitedGate4
      ? "VIL_E"
      : "VIL_1";

  const { purposeEnum, purposeCustom } = mapPurpose(legacy.purposeCode);
  const purposeLabel = KEPERLUAN_OPTIONS[purposeEnum];

  return {
    visitId: legacy.visitId,
    identityMask: legacy.identityMask,
    purposeEnum,
    purposeLabel,
    purposeCustom,
    plate: legacy.plate,
    destination: legacy.destination,
    // Legacy cards may store an unmasked name; maskFullname is idempotent.
    fullname: maskFullname(legacy.fullname),
    currentArea,
    // transit_at is meaningful only for TRNST cards (shown as "Waktu di Luar").
    // For VIL_1/VIL_E the value is never displayed, so 0 is fine.
    updatedAt: legacy.transitAt ?? 0,
  };
}
