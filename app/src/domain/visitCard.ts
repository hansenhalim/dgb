/**
 * Card payload schema v1 — written via RFID `WRITE <KEY> <DATA>` (1024 hex chars / 512 bytes).
 *
 * Full prose / rationale / compatibility rules: see docs/visit-card-schema.md.
 *
 * Layout — fixed header (30 bytes) then sequentially-packed variable strings.
 * Every variable field is `[length:1][bytes:length]`; absent fields contribute nothing.
 *
 *   0    1   version (0x01)
 *   1   16   visit_id (raw UUID bytes)
 *  17    3   identity_number_mask (BCD: first3 + last3 of the 16-digit ID)
 *  20    1   purpose_enum (KEPERLUAN_OPTIONS index)
 *  21    1   current_area (enum byte; see AREA_BY_ENUM)
 *  22    8   updated_at (i64 big-endian unix ms)
 *  30   ..   variable section, in order:
 *              if purpose_enum == 3 (Lainnya): [len:1][purpose_custom:1..30]
 *              [plate_len:1][plate:0..20]
 *              [destination_len:1][destination:1..30]
 *              [fullname_len:1][fullname:1..60]   (fullname pre-masked by encoder)
 *  ..  511   reserved (zero-padded)
 *
 * Parsers MUST check version == 0x01 before reading. New fields go in the tail
 * reserved region; old parsers stop after fullname and ignore extra bytes.
 */

export const CARD_PAYLOAD_BYTES = 512;
export const CARD_PAYLOAD_HEX_CHARS = CARD_PAYLOAD_BYTES * 2;
export const CARD_SCHEMA_VERSION = 0x01;
export const CARD_PAYLOAD_BLANK_HEX = "0".repeat(CARD_PAYLOAD_HEX_CHARS);

export type Keperluan =
  | "Bertamu"
  | "Antar Jemput"
  | "Pengantaran barang"
  | "Lainnya";

/**
 * Order is locked into the v1 card schema (purpose_enum byte at offset 20).
 * DO NOT REORDER — the index is persisted on every card written.
 */
export const KEPERLUAN_OPTIONS: readonly Keperluan[] = [
  "Bertamu",
  "Antar Jemput",
  "Pengantaran barang",
  "Lainnya",
] as const;

export const KEPERLUAN_LAINNYA_INDEX = 3;

export type CardArea = "VIL_1" | "VIL_2" | "VIL_E" | "TRNST";

/**
 * Visit position is the superset that the visit-history endpoint returns. It includes
 * `OUT` for post-checkout visits — cards never hold OUT because checkout wipes the card.
 */
export type VisitPosition = CardArea | "OUT";

/** Human-readable labels for the wire codes. UI must use these instead of the raw code. */
export const POSITION_LABEL: Readonly<Record<VisitPosition, string>> = {
  VIL_1: "Villa 1",
  VIL_2: "Villa 2",
  VIL_E: "Exclusive",
  TRNST: "In transit",
  OUT: "Outside",
};

/**
 * Byte encoding for the `current_area` field at offset 21. 0x00 is reserved for the
 * blank-card all-zeros state; an active card (version == 0x01) with byte 0x00 here is
 * invalid and the decoder throws.
 */
export const AREA_BY_ENUM: Readonly<Record<number, CardArea>> = {
  1: "VIL_1",
  2: "VIL_2",
  3: "VIL_E",
  4: "TRNST",
};

export const ENUM_BY_AREA: Readonly<Record<CardArea, number>> = {
  VIL_1: 1,
  VIL_2: 2,
  VIL_E: 3,
  TRNST: 4,
};

/**
 * Mask a full name for card storage. Each whitespace-separated word longer than
 * 3 characters has its middle replaced with `*`, keeping the first 2 and last 1
 * letters. Shorter words are unchanged. Whitespace is preserved verbatim.
 *
 *   "JOKUL DOE"     → "JO**L DOE"
 *   "ANNA M PUTRI"  → "ANNA M PU**I"
 */
export function maskFullname(name: string): string {
  return name.replace(/\S+/g, (word) => {
    if (word.length < 4) return word;
    return word.slice(0, 2) + "*".repeat(word.length - 3) + word.slice(-1);
  });
}

const FIELD_CAPS = {
  purposeCustom: 30,
  plate: 20,
  destination: 30,
  fullname: 60,
} as const;

const HEADER = {
  version: 0,
  visitId: 1,
  identityMask: 17,
  purposeEnum: 20,
  currentArea: 21,
  updatedAt: 22,
  varSection: 30,
} as const;

export type EncodeVisitCardInput = {
  visitId: string;
  /** 16-digit identity number (NIK or SIM left-padded with zeros). */
  identityNumber: string;
  purposeEnum: number;
  /** Required when purposeEnum === KEPERLUAN_LAINNYA_INDEX, must be empty otherwise. */
  purposeCustom: string;
  /** Empty string when no plate. */
  plate: string;
  destination: string;
  fullname: string;
  /** Current area as resolved by the server's gate × direction mapping. */
  currentArea: CardArea;
  /** Unix milliseconds; server-stamped time of last state change. */
  updatedAt: number;
};

export type DecodedVisitCard = {
  visitId: string;
  /** Reconstructed mask, e.g. "317**********001". */
  identityMask: string;
  purposeEnum: number;
  /** Resolved enum label. */
  purposeLabel: Keperluan;
  /** Custom text when purposeEnum === KEPERLUAN_LAINNYA_INDEX, else empty. */
  purposeCustom: string;
  /** ASCII, no spaces; empty when card has no plate. */
  plate: string;
  destination: string;
  fullname: string;
  /** Where the visitor currently is, per the last server-acknowledged state change. */
  currentArea: CardArea;
  /** Unix milliseconds; server-stamped time of the last state change. */
  updatedAt: number;
};

/** Returns 1024 uppercase hex chars suitable for `WRITE <KEY> <hex>`. */
export function encodeVisitCardV1(input: EncodeVisitCardInput): string {
  const buf = new Uint8Array(CARD_PAYLOAD_BYTES);

  buf[HEADER.version] = CARD_SCHEMA_VERSION;
  writeUuidBytes(input.visitId, buf, HEADER.visitId);
  writeIdentityMask(input.identityNumber, buf, HEADER.identityMask);

  if (
    input.purposeEnum < 0 ||
    input.purposeEnum >= KEPERLUAN_OPTIONS.length ||
    !Number.isInteger(input.purposeEnum)
  ) {
    throw new Error(`Invalid purpose enum: ${input.purposeEnum}`);
  }
  buf[HEADER.purposeEnum] = input.purposeEnum;

  const areaByte = ENUM_BY_AREA[input.currentArea];
  if (areaByte === undefined) {
    throw new Error(`Invalid currentArea: ${input.currentArea}`);
  }
  buf[HEADER.currentArea] = areaByte;

  writeU64BE(input.updatedAt, buf, HEADER.updatedAt);

  if (input.purposeEnum === KEPERLUAN_LAINNYA_INDEX) {
    if (input.purposeCustom.length === 0) {
      throw new Error("purposeCustom required for 'Lainnya'");
    }
  } else if (input.purposeCustom.length !== 0) {
    throw new Error("purposeCustom must be empty unless 'Lainnya'");
  }
  if (input.destination.length === 0) {
    throw new Error("destination required");
  }
  if (input.fullname.length === 0) {
    throw new Error("fullname required");
  }

  // Variable section. purpose_custom is omitted entirely (no length byte)
  // when purpose_enum != Lainnya — its presence is implied by the enum.
  let cursor: number = HEADER.varSection;
  if (input.purposeEnum === KEPERLUAN_LAINNYA_INDEX) {
    cursor = writeVarAscii(
      buf,
      cursor,
      input.purposeCustom,
      FIELD_CAPS.purposeCustom,
      "purposeCustom",
    );
  }
  cursor = writeVarAscii(buf, cursor, input.plate, FIELD_CAPS.plate, "plate");
  cursor = writeVarAscii(
    buf,
    cursor,
    input.destination,
    FIELD_CAPS.destination,
    "destination",
  );
  // PII: store only the masked form. maskFullname is idempotent, so re-encoding
  // a decoded (already-masked) value via withCardState() is safe.
  cursor = writeVarAscii(
    buf,
    cursor,
    maskFullname(input.fullname),
    FIELD_CAPS.fullname,
    "fullname",
  );

  return bytesToHex(buf);
}

export function decodeVisitCardV1(hex: string): DecodedVisitCard {
  if (hex.length !== CARD_PAYLOAD_HEX_CHARS || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error("Invalid card payload (expected 1024 hex chars)");
  }
  const buf = hexToBytes(hex);

  const version = buf[HEADER.version];
  if (version !== CARD_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported card schema version: 0x${version.toString(16).padStart(2, "0")}`,
    );
  }

  const visitId = readUuid(buf, HEADER.visitId);
  const identityMask = readIdentityMask(buf, HEADER.identityMask);

  const purposeEnum = buf[HEADER.purposeEnum];
  if (purposeEnum < 0 || purposeEnum >= KEPERLUAN_OPTIONS.length) {
    throw new Error(`Invalid purpose enum byte: ${purposeEnum}`);
  }
  const purposeLabel = KEPERLUAN_OPTIONS[purposeEnum];

  const areaByte = buf[HEADER.currentArea];
  const currentArea = AREA_BY_ENUM[areaByte];
  if (currentArea === undefined) {
    throw new Error(
      `Invalid current_area byte: 0x${areaByte.toString(16).padStart(2, "0")}`,
    );
  }

  const updatedAt = readU64BE(buf, HEADER.updatedAt);

  let cursor: number = HEADER.varSection;
  let purposeCustom = "";
  if (purposeEnum === KEPERLUAN_LAINNYA_INDEX) {
    const r = readVarAscii(
      buf,
      cursor,
      FIELD_CAPS.purposeCustom,
      "purposeCustom",
    );
    purposeCustom = r.value;
    cursor = r.next;
  }
  const plateR = readVarAscii(buf, cursor, FIELD_CAPS.plate, "plate");
  cursor = plateR.next;
  const destR = readVarAscii(
    buf,
    cursor,
    FIELD_CAPS.destination,
    "destination",
  );
  cursor = destR.next;
  const nameR = readVarAscii(buf, cursor, FIELD_CAPS.fullname, "fullname");

  if (destR.value.length === 0) {
    throw new Error("destination missing on active card");
  }
  if (nameR.value.length === 0) {
    throw new Error("fullname missing on active card");
  }

  return {
    visitId,
    identityMask,
    purposeEnum,
    purposeLabel,
    purposeCustom,
    plate: plateR.value,
    destination: destR.value,
    fullname: nameR.value,
    currentArea,
    updatedAt,
  };
}

/** Re-encode an existing decoded card with new state (currentArea + updatedAt), producing a 1024-hex payload. */
export function withCardState(
  decoded: DecodedVisitCard,
  state: { currentArea: CardArea; updatedAt: number },
): string {
  return encodeVisitCardV1({
    visitId: decoded.visitId,
    identityNumber: identityNumberFromMask(decoded.identityMask),
    purposeEnum: decoded.purposeEnum,
    purposeCustom: decoded.purposeCustom,
    plate: decoded.plate,
    destination: decoded.destination,
    fullname: decoded.fullname,
    currentArea: state.currentArea,
    updatedAt: state.updatedAt,
  });
}

/**
 * The card only stores the BCD mask (first3 + last3). For re-encoding we reconstruct
 * a 16-digit string with zero-padded middle so the encoder's identity-mask write
 * produces an identical 3-byte BCD region.
 */
function identityNumberFromMask(mask: string): string {
  // Mask format: "317**********001" → first 3, then 10 stars, then last 3
  const first = mask.slice(0, 3);
  const last = mask.slice(-3);
  if (!/^\d{3}$/.test(first) || !/^\d{3}$/.test(last)) {
    throw new Error(`Invalid identity mask: ${mask}`);
  }
  return first + "0".repeat(10) + last;
}

function writeUuidBytes(uuid: string, buf: Uint8Array, offset: number): void {
  const hex = uuid.replace(/-/g, "");
  if (hex.length !== 32 || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error(`Invalid UUID: ${uuid}`);
  }
  for (let i = 0; i < 16; i++) {
    buf[offset + i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
}

function readUuid(buf: Uint8Array, offset: number): string {
  let hex = "";
  for (let i = 0; i < 16; i++) {
    hex += buf[offset + i].toString(16).padStart(2, "0");
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function writeIdentityMask(
  identityNumber: string,
  buf: Uint8Array,
  offset: number,
): void {
  if (!/^\d{16}$/.test(identityNumber)) {
    throw new Error(
      `identityNumber must be 16 digits (got ${identityNumber.length})`,
    );
  }
  const mask = identityNumber.slice(0, 3) + identityNumber.slice(13, 16);
  for (let i = 0; i < 3; i++) {
    const hi = mask.charCodeAt(i * 2) - 0x30;
    const lo = mask.charCodeAt(i * 2 + 1) - 0x30;
    buf[offset + i] = (hi << 4) | lo;
  }
}

function readIdentityMask(buf: Uint8Array, offset: number): string {
  let digits = "";
  for (let i = 0; i < 3; i++) {
    const byte = buf[offset + i];
    const hi = (byte >> 4) & 0x0f;
    const lo = byte & 0x0f;
    if (hi > 9 || lo > 9) {
      throw new Error("Invalid BCD digit in identity mask");
    }
    digits += hi.toString() + lo.toString();
  }
  return digits.slice(0, 3) + "**********" + digits.slice(3, 6);
}

function writeVarAscii(
  buf: Uint8Array,
  cursor: number,
  value: string,
  cap: number,
  fieldName: string,
): number {
  if (value.length > cap) {
    throw new Error(`${fieldName} exceeds ${cap} chars (got ${value.length})`);
  }
  buf[cursor] = value.length;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code > 0x7f) {
      throw new Error(`${fieldName} must be ASCII`);
    }
    buf[cursor + 1 + i] = code;
  }
  return cursor + 1 + value.length;
}

function readVarAscii(
  buf: Uint8Array,
  cursor: number,
  cap: number,
  fieldName: string,
): { value: string; next: number } {
  const len = buf[cursor];
  if (len > cap) {
    throw new Error(`${fieldName} length ${len} exceeds cap ${cap}`);
  }
  let out = "";
  for (let i = 0; i < len; i++) {
    const code = buf[cursor + 1 + i];
    if (code > 0x7f) {
      throw new Error(`${fieldName} contains non-ASCII byte`);
    }
    out += String.fromCharCode(code);
  }
  return { value: out, next: cursor + 1 + len };
}

function writeU64BE(value: number, buf: Uint8Array, offset: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid u64 value: ${value}`);
  }
  const high = Math.floor(value / 0x100000000);
  const low = value >>> 0;
  buf[offset] = (high >>> 24) & 0xff;
  buf[offset + 1] = (high >>> 16) & 0xff;
  buf[offset + 2] = (high >>> 8) & 0xff;
  buf[offset + 3] = high & 0xff;
  buf[offset + 4] = (low >>> 24) & 0xff;
  buf[offset + 5] = (low >>> 16) & 0xff;
  buf[offset + 6] = (low >>> 8) & 0xff;
  buf[offset + 7] = low & 0xff;
}

function readU64BE(buf: Uint8Array, offset: number): number {
  const high =
    buf[offset] * 0x1000000 +
    (buf[offset + 1] << 16) +
    (buf[offset + 2] << 8) +
    buf[offset + 3];
  const low =
    buf[offset + 4] * 0x1000000 +
    (buf[offset + 5] << 16) +
    (buf[offset + 6] << 8) +
    buf[offset + 7];
  return high * 0x100000000 + low;
}

function bytesToHex(buf: Uint8Array): string {
  let out = "";
  for (let i = 0; i < buf.length; i++) {
    out += buf[i].toString(16).padStart(2, "0").toUpperCase();
  }
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const buf = new Uint8Array(hex.length / 2);
  for (let i = 0; i < buf.length; i++) {
    buf[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return buf;
}
