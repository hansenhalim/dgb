# RFID Reader API

Line-oriented command API for the **HANN-RFID-01** firmware. The same command set is reachable over UART or BLE; each response is returned on whichever transport delivered the request.

## Transports

### UART

- `115200` 8N1, no flow control
- Line terminator: `\n` (CRLF tolerated — `\r` is stripped by input trim)

### BLE — Nordic UART Service (NUS)

No pairing, no bonding.

| Field | Value |
|---|---|
| Advertised name | `HANN-RFID-01` |
| Service UUID | `6E400001-B5A3-F393-E0A9-E50E24DCCA9E` |
| RX (write, client → device) | `6E400002-B5A3-F393-E0A9-E50E24DCCA9E` |
| TX (notify, device → client) | `6E400003-B5A3-F393-E0A9-E50E24DCCA9E` |

- Line terminator: `\n` in both directions.
- Responses larger than the negotiated MTU are split into MTU‑sized notifications. Reassemble until `\n`.
- Long requests (`READ`, `WRITE`, `ENROLL`) must be split into multiple GATT writes of `≤ MTU − 3` bytes. The firmware accumulates bytes across writes and dispatches when it sees `\n`. The BLE Long Write procedure is **not** supported — chunk manually, terminating the final chunk with `\n`.
- The reader advertises continuously (no duration cap) at a 100 ms interval, so a 2–3 s app scan reliably catches it.

## Framing

- One command per line; exactly one response line per command.
- Every line from the device begins with `OK `, `ERR `, or `EVT `. `EVT ` lines are unsolicited push events (see [Events](#events)) and are not responses to commands — clients should route them past the command/response state machine.
- Input is trimmed and uppercased before parsing — commands and hex arguments are case-insensitive.
- Hex in responses is uppercase.

Argument placeholders used below:

- `<KEY>` — 192 hex characters (96 bytes), packed as 16 × 6‑byte per‑sector keys, sector 0 first.
- `<DATA>` — 1024 hex characters (512 bytes), the full tag payload.

## Commands

### `SCAN_UID`

Detect a tag and return its UID.

- **Request:** `SCAN_UID`
- **Success:** `OK UID <hex>` — UID is 4 or 7 bytes (ISO/IEC 14443A).
- **Errors:** `NO_TAG`

### `READ <KEY>`

Read the full 512‑byte payload using the supplied per‑sector key set.

- **Request:** `READ <KEY>`
- **Success:** `OK DATA <DATA>` — always exactly 1024 hex characters.
- **Errors:** `AUTH_FAILED`, `NO_TAG_DURING_READ`

### `WRITE <KEY> <DATA>`

Write the full 512‑byte payload using the supplied per‑sector key set.

- **Request:** `WRITE <KEY> <DATA>`
- **Success:** `OK WRITE_DONE`
- **Errors:** `WRITE_FAIL` (covers no‑tag, auth failure, and partial‑write conditions)

A subsequent `READ` is guaranteed to return the same 1024‑hex payload that was written.

### `ENROLL <KEY>`

Provision a factory‑default card by rotating its sector trailers to the supplied per‑sector keys. After a successful `ENROLL`, subsequent `READ`/`WRITE` calls must use this `<KEY>`.

- **Request:** `ENROLL <KEY>`
- **Success:** `OK ENROLL_DONE`
- **Errors:** `ENROLL_FAIL`

`ENROLL` requires a card that still authenticates with the MIFARE factory default key. Re-enrolling an already‑enrolled card returns `ENROLL_FAIL`.

### `VERSION`

Return the firmware version string.

- **Request:** `VERSION`
- **Success:** `OK VERSION <semver>`

### `HELP [<command>]`

Return human‑readable usage for one or all commands. Always succeeds.

- **Request:** `HELP` or `HELP <command>`
- **Success:** `OK HELP <text>`

## Error format

All errors are a single line:

```
ERR <CODE> - <description> (<context>)
```

| Code | Meaning |
|---|---|
| `UNKNOWN_CMD` | Command keyword not recognized |
| `MISSING_ARGS` | Required arguments not provided |
| `INVALID_ARGS` | Wrong number of arguments |
| `INVALID_LENGTH` | Hex argument has wrong length |
| `INVALID_HEX` | Hex argument contains non‑hex characters |
| `NO_TAG` | No tag in the field (`SCAN_UID` only) |
| `AUTH_FAILED` | Sector authentication failed — wrong key (`READ`) |
| `NO_TAG_DURING_READ` | Antenna lost the card between `SCAN_UID` and `READ` |
| `WRITE_FAIL` | `WRITE` failed (no tag, auth failure, or partial write) |
| `ENROLL_FAIL` | `ENROLL` failed (often: card not factory‑default) |
| `PARSE_ERROR` | Fallback for unhandled parse failures |

## Events

Unsolicited push lines emitted by the device. Each starts with `EVT ` and is independent of any in-flight command.

### `EVT BATT <0-100>`

Battery level percentage. Emitted on connect, on every level change, and at least every 30 s while connected.

```
< EVT BATT 87
```

## Example session

```
> SCAN_UID
< OK UID A1B2C3D4

> READ <KEY>
< OK DATA <DATA>

> WRITE <KEY> <DATA>
< OK WRITE_DONE

> READ ABC123
< ERR INVALID_LENGTH - READ key must be exactly 192 hex characters. Provided: 6 characters (Command: 'READ ABC123')

> VERSION
< OK VERSION 2.0.0
```
