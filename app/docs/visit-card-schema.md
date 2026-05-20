# Visit Card Schema

The visit card is a MIFARE-style RFID card carrying a **512-byte authenticated payload** (1024 hex chars). The reader exposes it via the `WRITE <KEY> <DATA>` and `READ <KEY>` commands documented in the firmware spec.

This document is the contract for what those 512 bytes mean. Source of truth for encoder/decoder: [`src/domain/visitCard.ts`](../src/domain/visitCard.ts).

## Why the card carries data at all

The card could be a pure key (`visit_id` only, server-fetched everything else). It isn't, because:

- Guards at the gate need to see who the visitor is *immediately* on scan, before any network round-trip.
- A transit timestamp written by guard A must be readable by guard B without a server hit.
- Photo verification is the only thing we *do* punt to the server (deliberately — too big for a card).

So the card is a denormalized snapshot of the visit, plus enough state to support the guard-to-guard transit handoff.

## Lifecycle

```
[blank card] ──(entry)──▶ [active card @ initial area]
                              │
                              ├──(transit / re-entry / area change)──▶ [active card @ new area]
                              │                                              │
                              │                                              └──(again, etc.)
                              │
                              └──(checkout via gate out)──▶ [blank card]
```

- **Blank card** = all 512 bytes are 0x00. Detected by `isEmptySecret(hex)` in `useScanViewModel`. Triggers the new-visitor flow on home scan.
- **Active card** = `version == 0x01`, `current_area ∈ {VIL_1, VIL_2, VIL_E, TRNST}`. Triggers the visit-preview flow.
- **Checkout** wipes the card back to all zeros via `WRITE` of `CARD_PAYLOAD_BLANK_HEX`. Server gets `POST /api/visits/{id}/checkout`. Triggered by the `out` direction at gates 1/2/3.
- **Area change** rewrites the card with new `current_area` and `updated_at`; everything else stays. Server is authoritative — it computes the new state from `(gate_id, direction)` and returns `{ current_area, updated_at }`, which the client writes to the card. Endpoints: `POST /api/visits/{id}/transit` for outward / area-side moves, `POST /api/visits/{id}/transit-enter` for `in` direction re-entries.

The server's response is cached client-side between the API commit and the card write. On card-write failure, retry uses the cached response so the card and server stay in lockstep — same retry guarantee as the prior `pendingTransitAt` pattern. (See `pendingResponse` in [`useVisitPreviewViewModel`](../src/features/visitPreview/useVisitPreviewViewModel.ts).)

The gate × direction → area lookup is encoded client-side in [`src/domain/gateAreaMap.ts`](../src/domain/gateAreaMap.ts) for UI button visibility; the server has its own copy and is the source of truth for the resulting state.

## Layout (v1, version byte = 0x01)

Total: 512 bytes. **Fixed header: 30 bytes. Variable section: 4–144 bytes** (sequentially packed). Tail is zero-padded to 512.

### Fixed header (offsets 0..29)

| Offset | Size | Field | Encoding |
|---|---|---|---|
| 0 | 1 | `version` | `0x01` |
| 1 | 16 | `visit_id` | Raw UUID bytes (hyphens stripped, parsed as 16 bytes) |
| 17 | 3 | `identity_number_mask` | BCD packed: first 3 + last 3 of the 16-digit ID |
| 20 | 1 | `purpose_enum` | Index into `KEPERLUAN_OPTIONS`. Also gates whether `purpose_custom` appears in the variable section. |
| 21 | 1 | `current_area` | Enum byte; see `AREA_BY_ENUM` below |
| 22 | 8 | `updated_at` | i64 big-endian unix ms; server-stamped time of the last state change |

### Variable section (starts at offset 30)

Each field is `[length:1][bytes:length]`, packed back-to-back with no padding between fields.

| Order | Field | Length range | Notes |
|---|---|---|---|
| 1 | `purpose_custom` | 1..30 | **Present iff `purpose_enum == 3` (Lainnya).** Otherwise omitted entirely — no length byte, no bytes. |
| 2 | `plate` | 0..20 | `length = 0` means no plate. The length byte is always present. ASCII, no spaces (formatPlate strips them). |
| 3 | `destination` | 1..30 | Always present. ASCII. |
| 4 | `fullname` | 1..60 | Always present. ASCII, **already masked** (see "PII masking"). |

Tail bytes after `fullname` through offset 511 are reserved — zero on write, ignored on read.

### Why this shape

The previous layout reserved a fixed slot for every variable string (30 / 20 / 30 / 60 bytes plus a length byte each), so a card with a short name and no plate still spent ~144 bytes on `0x00` padding. The packed layout drops absent and short fields to zero overhead, freeing the tail for forward-compatible additions.

- Worst case (all variable fields at max + Lainnya): 30 + (1+30) + (1+20) + (1+30) + (1+60) = **173 bytes**.
- Typical (Bertamu purpose, no plate, dest=15, name=20): 30 + 0 + (1+0) + (1+15) + (1+20) = **68 bytes**.

Approaches considered:
- **Pure sequential packing (chosen).** One byte of overhead per variable field. `purpose_custom` is the only field that can be omitted entirely (and only because `purpose_enum` already signals its presence). The other three either always appear (`destination`, `fullname`) or have a meaningful empty state (`plate`, `length = 0`).
- **TLV per field.** Adds a tag byte on top of length. Wins only when most fields are absent; ours aren't. Net cost on the common path, so skipped.
- **Bitmask byte.** Could save 1 byte by replacing `plate`'s `length = 0` with a "has plate" flag. Costs 1 byte (the flags byte) and adds an extra invariant to keep in sync with the data. Skipped — the simpler form wins on net.

### Conventions

- **Multi-byte numerics** are big-endian. (Only `updated_at` qualifies in v1.)
- **Variable strings** use `length` byte + tightly-packed data bytes; the next field starts immediately at `cursor + 1 + length`.
- **All ASCII fields** must be 7-bit ASCII. Encoder rejects bytes > 0x7F to fail loud rather than silently writing latin-1 / UTF-8.
- **Hex output** is uppercase (matches firmware `OK DATA <DATA>` casing).

### Identity number mask (BCD)

The full 16-digit NIK or SIM is **not** stored on the card. Only the first 3 + last 3 digits, BCD-packed into 3 bytes. The display layer reconstructs `"317**********001"`.

- NIK is 16 digits natively.
- SIM is typically 12 digits — the form left-pads with zeros to 16 before encoding. So a SIM `"123456789012"` stores as `"0000123456789012"` and renders mask `"000***********012"`.
- Encoder enforces `^\d{16}$`. Anything else throws.

### Purpose enum

Order in [`KEPERLUAN_OPTIONS`](../src/domain/visitCard.ts#L36) is **frozen** as part of the schema:

| Index | Label |
|---|---|
| 0 | Bertamu |
| 1 | Antar Jemput |
| 2 | Pengantaran barang |
| 3 | Lainnya |

**DO NOT REORDER.** The index byte is persisted on every card. Adding a new fixed option is a v2 change.

When `purpose_enum == 3` (Lainnya), `purpose_custom` carries the typed text (e.g. `"Service AC Rumah"`). For 0–2, `purpose_custom_length` must be 0.

### PII masking on `fullname`

The encoder calls `maskFullname` automatically before writing. Per word: keep first 2 + last 1, replace middle with `*`. Words ≤3 chars are unchanged.

```
"JOKUL DOE"     → "JO**L DOE"
"ANNA M PUTRI"  → "ANNA M PU**I"
```

The function is **idempotent**: masking an already-masked string is a no-op. This is load-bearing — `withCardState` re-encodes a `decoded.fullname` that was already masked, and we rely on the second mask leaving it alone.

The unmasked name *is* sent to the API (the server stores full PII). The card alone never carries it.

### `updated_at`

8 bytes at offset 22. Unix milliseconds. Server-stamped time of the last state change. Always > 0 on an active card — the create endpoint stamps it on entry.

JS-side encoding splits into two 32-bit halves because bitwise ops in JS are signed 32-bit. See `writeU64BE` / `readU64BE` for the trick. Safe up to `Number.MAX_SAFE_INTEGER` (year ~287396) — well past the 2106 wall a u32 unix-seconds field would hit.

On the wire the timestamp is ISO8601; the client parses to unix ms via `Date.parse` before writing to the card.

### `current_area`

1 byte at offset 21. Enum:

| Byte | Code | Display | Note |
|---|---|---|---|
| `0x00` | unset | — | Only valid on blank cards. Decoder throws on `version == 0x01` cards with byte 0x00. |
| `0x01` | `VIL_1` | Villa 1 | |
| `0x02` | `VIL_2` | Villa 2 | |
| `0x03` | `VIL_E` | Exclusive | |
| `0x04` | `TRNST` | In transit | Visitor stepped outside the perimeter via gate 2/3 transit (card still active — distinct from checkout, which wipes the card). |

On the wire `current_area` is the string code (`"VIL_1"`, `"TRNST"`, etc.), not the byte — the byte encoding is a private concern of the card schema. The display labels live in `POSITION_LABEL` in [`src/domain/visitCard.ts`](../src/domain/visitCard.ts) and must be used for any UI text.

The visit-history endpoint returns one additional code, `OUT` (Outside), for visits whose card has been wiped by checkout. `OUT` is never written to a card — see `VisitPosition` for the superset type.

The gate × direction → area mapping (e.g. gate 1 in → villa1, gate 4 out → villa2) lives in [`src/domain/gateAreaMap.ts`](../src/domain/gateAreaMap.ts). The server holds the canonical copy; the client's copy is for UI button visibility only.

## Compatibility rules

The version byte makes this future-proof:

- **Reading.** Parsers MUST check `version == 0x01` before reading any other field. Unknown versions get a clean rejection (the visit-preview screen shows "Format kartu tidak dikenal").
- **Writing.** Always write the version byte. Always.

### What's a v1-compatible change?

- Appending a new variable-section field **after `fullname`**. Old parsers stop walking after `fullname` and ignore the tail, so new fields must be additive at the end. Use the same `[length:1][bytes]` framing.
- Adding a fixed-size field in the tail reserved region, provided you also append a sentinel/length so the variable walker still terminates correctly. Easier: just stick to the append-after-fullname rule.
- Tightening a validation that's already documented (e.g. requiring `plate_length <= 11` instead of 20). Old writers stay within the new bound by accident.

### What requires bumping to v2?

- Renaming, resizing, or removing any header field (offsets 0–29).
- Reordering or removing any variable-section field.
- Changing the `purpose_enum`-implies-`purpose_custom-presence` rule.
- Changing an enum's encoding (e.g. flipping endianness, switching BCD to binary).

When v2 happens, increment `CARD_SCHEMA_VERSION` and add a parallel `decodeVisitCardV2` / `encodeVisitCardV2`. Don't try to make a single function handle both — version-specific decoders keep the contracts clean.

## Failure modes worth knowing

- **`AUTH_FAILED` on read/write** = the per-sector key set doesn't match the card. Cards are provisioned via the `ENROLL` firmware command (one-shot, factory-default → app key).
- **`WRITE_FAIL`** is the firmware's catch-all for "card slipped, RF noise, or partial write." There's no retry inside the gateway — the user-facing screens (visit-success, visit-preview) handle retry UX.
- **BLE Long Write is not supported.** [`BleRfidReader.writeChunked`](../src/data/rfid/BleRfidReader.ts) splits long lines into MTU-3 byte chunks; the firmware reassembles on `\n`. Without chunking, GATT writes >MTU fail instantly with "Operation was rejected." Don't undo this.
- **Card decode mismatch (e.g. `purpose_enum > 3`)** indicates either a bit-flip or a forward-compatibility scenario. v1 throws — we'd rather fail loudly than misdisplay.

## Where things live

| Concern | File |
|---|---|
| Schema constants, layout, encoder, decoder, masking | [`src/domain/visitCard.ts`](../src/domain/visitCard.ts) |
| BLE write path (chunking, error mapping) | [`src/data/rfid/BleRfidReader.ts`](../src/data/rfid/BleRfidReader.ts) |
| Server endpoints (create, pulse, checkout, transit) | [`src/data/api/ApiVisitsGateway.ts`](../src/data/api/ApiVisitsGateway.ts) |
| Entry flow encoder caller | [`src/features/guestForm/useGuestFormViewModel.ts`](../src/features/guestForm/useGuestFormViewModel.ts) |
| Preview / transit / checkout flow | [`src/features/visitPreview/useVisitPreviewViewModel.ts`](../src/features/visitPreview/useVisitPreviewViewModel.ts) |
| Post-action gate-pulse screen | [`src/features/visitSuccess/`](../src/features/visitSuccess/) |
