# API

All responses use `application/json` and a top-level `message` field (`POST /v2/extract-id` is the exception — its body is the upstream OCR service's response forwarded verbatim).

**Path prefix.** All routes are mounted under `/v2/`. Clients call this service directly with the `/v2/` prefix (e.g. `/v2/auth/verify-pin`); no edge proxy rewrite is required.

## `POST /v2/auth/verify-pin`

Verify the 6-digit PIN for an RFID card. On success returns the card's 96-byte key as an uppercase hex string.

### Request

```json
{
  "uid": "DEADBEEF",
  "pin": "123456"
}
```

| field | type   | rules                                |
| ----- | ------ | ------------------------------------ |
| `uid` | string | required, exactly 8 hex chars (case-insensitive) |
| `pin` | string | required, exactly 6 numeric chars    |

### Responses

**`200 OK`** — valid PIN.

```json
{
  "message": "PIN is valid.",
  "rfid_key": "C0FFEE..."
}
```

`rfid_key` is the uppercase hex encoding of the 96-byte key (192 hex chars).

**`401 Unauthorized`** — PIN does not match.

```json
{ "message": "Invalid PIN." }
```

**`404 Not Found`** — RFID UID is not present, or it is present but not bound to a staff member with role `GRD` (guard).

```json
{ "message": "RFID not found or not assigned to guard." }
```

**`422 Unprocessable Entity`** — request body fails validation.

```json
{ "message": "Validation failed." }
```

**`400 Bad Request`** — request body is not valid JSON.

```json
{ "message": "Invalid request body." }
```

---

## `POST /v2/auth/verify-secret`

Verify the guard's secret key (the 512-byte block-encoded RFID secret) and issue an HS256 JWT valid for 12 hours.

### Request

```json
{
  "uid": "DEADBEEF",
  "secret_key": "DEADBEEF...",
  "device_name": "Jokul's iPhone"
}
```

| field         | type   | rules                                                    |
| ------------- | ------ | -------------------------------------------------------- |
| `uid`         | string | required, exactly 8 hex chars (case-insensitive)         |
| `secret_key`  | string | required, exactly 1024 hex chars (encodes 512 raw bytes) |
| `device_name` | string | required, max 255 chars                                  |

The server hex-decodes `secret_key` to 512 raw bytes, takes the SHA-256, and compares the hex digest against `staff.secret_key`. `device_name` is currently echoed back into JWT issuance only; future iterations may persist it for audit.

### Responses

**`200 OK`** — secret matches.

```json
{
  "message": "You have logged in successfully.",
  "token": "<HS256 JWT>",
  "valid_until": "2026-05-17T00:00:00Z",
  "guard_name": "Jokul Doe"
}
```

`token` is a signed JWT with `sub` set to the staff UUID and `exp` 12 hours after issuance. Pass it as `Authorization: Bearer <token>` to authenticated endpoints. `valid_until` is the `exp` claim formatted as RFC 3339 UTC. `guard_name` is the authenticated staff's `name` and is the only place the client receives it — there is no separate lookup endpoint.

**`401 Unauthorized`** — secret does not match.

```json
{ "message": "Invalid key." }
```

**`404 Not Found`** — same conditions as `verify-pin`.

**`422 Unprocessable Entity`** / **`400 Bad Request`** — same shapes as `verify-pin`.

---

## Logout

There is no logout endpoint. JWTs are stateless and the server keeps no per-token state — the client simply discards the token. The token remains technically valid until its `exp`.

---

## `GET /v2/home?gate_id=<id>`

Aggregate counts scoped to a single gate for the guard's home screen, plus a hint about whether the gate has an incoming transfer request awaiting response. Requires bearer token.

### Request

```
Authorization: Bearer <token>
```

| query     | type  | rules         |
| --------- | ----- | ------------- |
| `gate_id` | int16 | required, > 0 |

### Responses

**`200 OK`**

```json
{
  "message": "Home dashboard retrieved successfully.",
  "data": {
    "cardStock": { "available": 300, "total": 305 },
    "visits": { "active": 5, "total": 14 },
    "has_incoming_transfer_request": false
  }
}
```

| field                           | source |
| ------------------------------- | ------ |
| `cardStock.available`           | this gate's `gates.current_quota` |
| `cardStock.total`               | `cardStock.available + visits.active` — i.e. this gate's free cards plus cards currently issued to active visits checked in at this gate |
| `visits.active`                 | `COUNT(visits WHERE checkin_gate_id=<id> AND checkout_at IS NULL)` |
| `visits.total`                  | `COUNT(visits WHERE checkin_gate_id=<id> AND checkin_at >= today UTC)` — today's check-ins at this gate |
| `has_incoming_transfer_request` | `true` iff a pending transfer exists with `to_gate_id=<id>`. Outgoing pending requests do not light this flag — they're surfaced via `GET /v2/gates/{id}/transfer-requests` instead |

If `gate_id` refers to a gate id that doesn't exist, the response is still `200` with all numeric fields zero and the flag `false` — matches the lenient behavior of `/v2/visits/history`.

**`422 Unprocessable Entity`** — `gate_id` missing, non-numeric, or non-positive.

**`401 Unauthorized`** — token missing/malformed/expired.

---

## `GET /v2/gates`

List all gates with an availability flag. Requires a valid bearer token issued by `verify-secret`.

### Request

```
Authorization: Bearer <token>
```

No body.

### Responses

**`200 OK`**

```json
{
  "message": "Successfully retrieved available gates.",
  "data": [
    { "id": 1, "name": "Gerbang 1", "is_available": true },
    { "id": 2, "name": "Gerbang 2", "is_available": true },
    { "id": 3, "name": "Gerbang 3", "is_available": true },
    { "id": 4, "name": "Gerbang 4", "is_available": true }
  ]
}
```

Rows come from the `gates` table sorted by `id` ascending. `is_available` is sourced from the env var `GATE_<id>_IS_AVAILABLE` (default `true` when unset or unparseable), mirroring the Laravel `config("app.gate_{$id}_is_available", true)` lookup. Per-gate quota is no longer returned here — call `GET /v2/home?gate_id=<id>` to read the active gate's quota.

**`401 Unauthorized`** — missing, malformed, or expired token.

```json
{ "message": "Invalid token." }
```

---

## `POST /v2/gates/{id}/pulse`

Fire the boom gate connected to the given gate, in the given direction. Requires bearer token.

The server is fire-and-forget: it validates the request and immediately returns `204 No Content`, then asynchronously issues a `GET` to the configured webhook URL with a 1s timeout. Webhook errors (network failure, non-2xx, timeout) are warn-logged and swallowed — the client never sees them. Mirrors the Laravel `callWebhook(gateId, direction)` reference: missing/empty URL is a silent no-op.

The URL is resolved per-(gate, direction) from env: `GATE_<id>_<IN|OUT>_WEBHOOK_URL`. Typical target is a Tasmota / KMtronic / ESPHome relay.

### Request

```
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "visit_id": "f3d5c6a8-1eab-4b1a-a8d4-092cf15b65e9",
  "direction": "in"
}
```

| field       | type   | rules                                |
| ----------- | ------ | ------------------------------------ |
| `visit_id`  | string | required, UUID format (validated for shape but currently unused server-side — accepted for forward compatibility) |
| `direction` | string | required, exactly `"in"` or `"out"`  |

### Responses

**`204 No Content`** — request accepted; webhook dispatched asynchronously. Empty body. Returned regardless of whether the webhook URL is configured or whether the downstream call ultimately succeeds.

**`400 Bad Request`** — `id` not a positive int16, or body fails validation (missing field, malformed UUID, direction not in `{"in","out"}`, malformed JSON).

```json
{ "message": "Invalid request data." }
```

**`401 Unauthorized`** — token missing/malformed/expired.

---

## `GET /v2/gates/{id}/transfer-requests`

Check whether a pending transfer request exists for the given gate (as either source or destination). Requires bearer token.

### Request

```
Authorization: Bearer <token>
```

### Responses

**`204 No Content`** — no pending transfer involves this gate. Empty body.

**`200 OK`**

```json
{
  "message": "Transfer request found.",
  "data": {
    "id": 1,
    "from_gate": { "id": 2, "name": "Gerbang 2" },
    "to_gate":   { "id": 1, "name": "Gerbang 1" },
    "amount": 25
  }
}
```

**`401 Unauthorized`** — same as other authenticated endpoints.

---

## `POST /v2/transfer-requests`

Open a new transfer request from one gate to another. Requires bearer token; the authenticated guard becomes `sender_staff_id`.

### Request

```json
{
  "from_gate": 2,
  "to_gate": 1,
  "amount": 25
}
```

| field       | type    | rules                              |
| ----------- | ------- | ---------------------------------- |
| `from_gate` | int16   | required, > 0, must differ from `to_gate` |
| `to_gate`   | int16   | required, > 0                      |
| `amount`    | int16   | required, > 0                      |

### Responses

**`200 OK`**

```json
{ "message": "Transfer request created successfully." }
```

**`400 Bad Request`** — quota too small for the requested amount.

```json
{ "message": "Amount must be smaller or equal to source gate card amount." }
```

**`400 Bad Request`** — gate IDs unknown, or a pending transfer already exists involving either gate.

```json
{ "message": "Invalid request data or transfer already pending." }
```

**`422 Unprocessable Entity`** — request body fails structural validation (missing field, same source/destination, non-positive numbers).

**`401 Unauthorized`** — token missing/malformed/expired.

---

## `PATCH /v2/transfer-requests/{id}`

Respond to a pending transfer request. The authenticated guard becomes `recipient_staff_id`. On `confirm`, source gate's `current_quota` is decremented and destination's is incremented in the same transaction.

### Request

```json
{ "status": "confirm" }
```

`status` must be exactly `"confirm"` or `"reject"`.

### Responses

**`200 OK`**

```json
{ "message": "Transfer request confirmed successfully." }
```

or

```json
{ "message": "Transfer request rejected successfully." }
```

**`400 Bad Request`** — invalid status string, transfer id not found, or already responded.

```json
{ "message": "Invalid status or request already processed." }
```

**`401 Unauthorized`** — token missing/malformed/expired.

---

## `GET /v2/rfid-key?uid=<hex>`

Return the 96-byte key stored on a non-staff RFID (e.g. a visitor card). Requires bearer token. Mirrors `verify-pin`'s key handling, but the card must NOT be assigned to a staff member.

### Request

```
Authorization: Bearer <token>
```

| query | type   | rules                                            |
| ----- | ------ | ------------------------------------------------ |
| `uid` | string | required, exactly 8 hex chars (case-insensitive) |

### Responses

**`200 OK`**

```json
{
  "message": "Successfully retrieving key.",
  "rfid_key": "C0FFEE..."
}
```

`rfid_key` is the uppercase hex encoding of the 96-byte key (192 hex chars).

**`404 Not Found`** — UID not present, or it is present but assigned to a staff member.

```json
{ "message": "RFID not found or assigned to staff." }
```

**`422 Unprocessable Entity`** — `uid` missing or not 8 hex chars.

**`401 Unauthorized`** — token missing/malformed/expired.

---

## `GET /v2/visitors?identity_number=<plain>`

Look up a visitor by their plaintext identity number. The server SHA-256s the identity number and queries `visitors.identity_number` (which stores the hash, not the plaintext) — mirrors Laravel's `Str::of($identityNumber)->hash('sha256')`. Response also embeds the visitor's single most recent visit so the caller doesn't need a second roundtrip. Requires bearer token.

### Request

```
Authorization: Bearer <token>
```

| query             | type   | rules    |
| ----------------- | ------ | -------- |
| `identity_number` | string | required |

### Responses

**`204 No Content`** — no visitor matches the SHA-256 of the supplied identity number. Empty body.

**`200 OK`**

```json
{
  "message": "Visitor status retrieved successfully.",
  "data": {
    "id": "7f425f50-1d17-43d4-9d16-e4b3125c0136",
    "fullname": "JOKUL DOE",
    "banned_at": "2024-10-01T14:00:00Z",
    "banned_reason": "Violation of guest rules",
    "latest_visit": {
      "id": "7f425f50-1d17-43d4-9d16-e4b3125c0136",
      "vehicle_plate_number": "BE 1199 AA",
      "purpose_of_visit": "Service AC Rumah",
      "destination_name": "AA-1",
      "created_at": "2024-10-01T14:00:00Z"
    }
  }
}
```

| field           | type   | notes |
| --------------- | ------ | ----- |
| `banned_at`     | string or null | RFC 3339 UTC when banned, `null` otherwise |
| `banned_reason` | string or null | non-null only when `banned_at` is set      |
| `latest_visit`  | object or null | `null` when the visitor has no visits      |

**`422 Unprocessable Entity`** — `identity_number` missing.

**`401 Unauthorized`** — token missing/malformed/expired.

---

## `POST /v2/visits`

Create a new visit record AND auto-checkin in a single call. Requires bearer token. Body must be `multipart/form-data` because of the `identity_photo` upload.

If the visitor doesn't exist (looked up by SHA-256 of `identity_number`) one is created; otherwise the existing visitor's `fullname` is updated. After the visit row is inserted, the RFID is re-pointed to it (`rfidable_type='App\Models\Visit'`, `rfidable_id=visit.id`) and the visitor is marked banned with reason `"Checked in at gate <gate_id>"` — same pattern as the Laravel checkin flow.

### Request

```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

| field                  | type   | rules                                                                 |
| ---------------------- | ------ | --------------------------------------------------------------------- |
| `uid`                  | string | required, exactly 8 hex chars (case-insensitive)                     |
| `identity_photo`       | file   | required, ≤ 512 KB, encrypted with Laravel `Crypt::encryptString` envelope before storage |
| `identity_number`      | string | required                                                              |
| `fullname`             | string | required                                                              |
| `vehicle_plate_number` | string | optional                                                              |
| `purpose_of_visit`     | string | required                                                              |
| `destination_name`     | string | required (must match an existing `destinations.name`)                |
| `gate_id`              | int    | required, must be a checkin-capable gate (1, 2, or 3)                 |

Server-side processing:
- Looks up the RFID by `uid` and rejects if it's assigned to a staff member (404).
- Maps `gate_id` to `current_position` via the hardcoded rule (gate 1 or 2 → VIL_1, gate 3 → VIL_2). Other gates are rejected as invalid input (400).
- Hashes `identity_number` with SHA-256 and upserts the visitor; updates `fullname` if it changed.
- Encrypts `identity_photo` using the shared `APP_KEY` (AES-256-CBC + HMAC-SHA256) into the Laravel envelope format and stores the ASCII bytes of that envelope into the `identity_photo` BYTEA.
- Inserts the visit with `checkin_at=now`, `checkin_gate_id=gate_id`, and the derived `current_position`.
- Re-points the RFID to the new visit.
- Marks the visitor banned with `banned_at=now` and `banned_reason="Checked in at gate <gate_id>"`.

### Responses

**`201 Created`**

```json
{
  "message": "Visit created successfully",
  "data": {
    "id": "f3d5c6a8-1eab-4b1a-a8d4-092cf15b65e9",
    "current_area": "VIL_1",
    "updated_at": "2026-05-18T10:30:00Z"
  }
}
```

`current_area` is the raw `visit.current_position` enum (`VIL_1`, `VIL_2`, or `VIL_E`) derived from `gate_id`. `updated_at` is the visit row's `updated_at` as RFC 3339 UTC.

**`400 Bad Request`** — photo too big, file missing, malformed multipart, missing/invalid fields, unparseable gate, or a gate that has no checkin position mapping.

```json
{ "message": "Photo exceeds 512KB limit or invalid input" }
```

**`404 Not Found`** — RFID UID not present, or it is present but assigned to a staff member.

```json
{ "message": "RFID not found or assigned to staff." }
```

**`401 Unauthorized`** — token missing/malformed/expired.

---

## `GET /v2/destinations`

List every row in the `destinations` table, sorted by `name` ascending. Requires bearer token.

### Request

```
Authorization: Bearer <token>
```

### Responses

**`200 OK`**

```json
{
  "message": "Destinations retrieved successfully.",
  "data": [
    { "name": "AA-1", "position": "VIL_1" },
    { "name": "AA-2", "position": "VIL_2" },
    { "name": "AA-3", "position": "VIL_E" }
  ]
}
```

`position` is the raw `destinations.position` enum (`VIL_1` / `VIL_2` / `VIL_E`) — the same CardArea encoding used by the visit endpoints. Client decodes it via its `ENUM_BY_AREA` map.

**`401 Unauthorized`** — token missing/malformed/expired.

---

## `POST /v2/visits/{id}/checkout`

Close an active visit. Requires bearer token. Sets `visit.checkout_at=now`, `visit.checkout_gate_id=gate_id`, and `visit.current_position=OUT`. Also clears the visitor's active-visit ban by setting `visitors.banned_at=NULL` and `visitors.banned_reason=NULL` — checkout is the only endpoint that clears the ban.

### Request

```
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "gate_id": 2
}
```

| field     | type  | rules                                                 |
| --------- | ----- | ----------------------------------------------------- |
| `gate_id` | int16 | required, must be 1, 2, or 3 (checkout-capable gates) |

Gate→position rule for checkout: `1, 2, 3 → OUT`. Other gates are rejected as invalid input (400).

### Responses

**`200 OK`** — visit closed. The response body intentionally has no `data` field; the client wipes the RFID immediately after checkout and has no further use for the visit's post-state.

```json
{ "message": "Visit area updated successfully." }
```

**`400 Bad Request`** — `gate_id` missing, malformed, or not in {1, 2, 3}.

```json
{ "message": "Invalid request data." }
```

**`401 Unauthorized`** — token missing/malformed/expired.

**`404 Not Found`** — `visit.id` does not exist.

```json
{ "message": "Visit not found." }
```

---

## `POST /v2/visits/{id}/transit`

Move an active visit into the transit area (or directly to `VIL_2` from `VIL_E` via the inner gate 4 — see geography note). Requires bearer token. Sets `visit.current_position` per the gate→position rule below. No state-machine guard: the server does not verify the visit's current position before transitioning. The visitor's ban state is untouched.

### Request

```
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "gate_id": 2
}
```

| field     | type  | rules                        |
| --------- | ----- | ---------------------------- |
| `gate_id` | int16 | required, must be 2, 3, or 4 |

Gate→position rule for transit:

| `gate_id` | resulting `current_area` |
| --------- | ------------------------ |
| 2         | `TRNST`                  |
| 3         | `TRNST`                  |
| 4         | `VIL_2`                  |

Geography note: Gate 4 sits geographically *inside* `VIL_2` — it is the perimeter gate of the exclusive area `VIL_E`. A transit through gate 4 is therefore "leaving `VIL_E` and re-entering `VIL_2`," not entering the buffer transit zone — hence the direct `VIL_2` mapping rather than `TRNST`.

Other gates are rejected as invalid input (400).

### Responses

**`200 OK`**

```json
{
  "message": "Visit area updated successfully.",
  "data": {
    "current_area": "TRNST",
    "updated_at": "2026-05-19T10:30:00Z"
  }
}
```

`current_area` is the raw `visit.current_position` enum after the transition. `updated_at` is the visit row's `updated_at` as RFC 3339 UTC.

**`400 Bad Request`** — `gate_id` missing, malformed, or not in {2, 3, 4}.

```json
{ "message": "Invalid request data." }
```

**`401 Unauthorized`** — token missing/malformed/expired.

**`404 Not Found`** — `visit.id` does not exist.

```json
{ "message": "Visit not found." }
```

---

## `POST /v2/visits/{id}/transit-enter`

Move an active visit out of transit into a destination area (or from `VIL_2` into the exclusive area `VIL_E` via the inner gate 4). Requires bearer token. Sets `visit.current_position` per the gate→position rule below. No state-machine guard: the server does not verify the visit's current position before transitioning. The visitor's ban state is untouched.

### Request

```
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "gate_id": 3
}
```

| field     | type  | rules                        |
| --------- | ----- | ---------------------------- |
| `gate_id` | int16 | required, must be 2, 3, or 4 |

Gate→position rule for transit-enter:

| `gate_id` | resulting `current_area` |
| --------- | ------------------------ |
| 2         | `VIL_1`                  |
| 3         | `VIL_2`                  |
| 4         | `VIL_E`                  |

Other gates are rejected as invalid input (400).

### Responses

**`200 OK`**

```json
{
  "message": "Visit area updated successfully.",
  "data": {
    "current_area": "VIL_2",
    "updated_at": "2026-05-19T10:30:00Z"
  }
}
```

`current_area` is the raw `visit.current_position` enum after the transition. `updated_at` is the visit row's `updated_at` as RFC 3339 UTC.

**`400 Bad Request`** — `gate_id` missing, malformed, or not in {2, 3, 4}.

```json
{ "message": "Invalid request data." }
```

**`401 Unauthorized`** — token missing/malformed/expired.

**`404 Not Found`** — `visit.id` does not exist.

```json
{ "message": "Visit not found." }
```

---

## `GET /v2/visits/history?gate_id=<id>`

List recent visits associated with the given gate. Requires bearer token.

### Request

```
Authorization: Bearer <token>
```

| query     | type  | rules         |
| --------- | ----- | ------------- |
| `gate_id` | int16 | required, > 0 |

### Responses

**`200 OK`**

```json
{
  "message": "Successfully get visit history",
  "data": [
    {
      "id": "7f425f50-1d17-43d4-9d16-e4b3125c0136",
      "vehicle_plate_number": "B 1234 XY",
      "current_position": "VIL_1",
      "destination_name": "A-47",
      "created_at": "2025-06-26T14:03:52Z"
    },
    {
      "id": "7f425f50-1d17-43d4-9d16-e4b3125c0136",
      "vehicle_plate_number": "BE 1199 AA",
      "current_position": "VIL_1",
      "destination_name": "AA-1",
      "created_at": "2025-06-26T14:03:52Z"
    },
    {
      "id": "7f425f50-1d17-43d4-9d16-e4b3125c0136",
      "vehicle_plate_number": "F 9988 JK",
      "current_position": "VIL_2",
      "destination_name": "C-32",
      "created_at": "2025-06-26T14:03:52Z"
    }
  ]
}
```

`current_position` is the same CardArea wire code used elsewhere (`VIL_1`, `VIL_2`, `VIL_E`, `TRNST`) plus `OUT` for post-checkout visits.

**`422 Unprocessable Entity`** — `gate_id` missing or invalid.

**`401 Unauthorized`** — token missing/malformed/expired.

---

## `POST /v2/extract-id`

Proxy a multipart image upload to the external OCR service for Indonesian-ID extraction (KTP / SIM). The handler validates JWT + input shape, forwards the multipart body to `${OCR_URL}/extract-id`, and returns the upstream response verbatim (body bytes + status + `Content-Type`). Mirrors the Laravel `ExtractIdController`.

### Request

```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

| field    | type   | rules                                                |
| -------- | ------ | ---------------------------------------------------- |
| `image`  | file   | required, ≤ 512 KB                                   |
| `fields` | string | optional; comma-separated field names (e.g. `nik,nomor_sim,nama`). Forwarded as-is. |

### Responses

The body and status are whatever the OCR service returns. On success the OCR service typically returns:

```json
{
  "message": "OK",
  "data": {
    "type": "ktp",
    "data": {
      "nik": "1234567890123456",
      "nama": "JOKUL DOE"
    }
  }
}
```

**`400 Bad Request`** — image missing, > 512 KB, or malformed multipart.

```json
{ "message": "Image exceeds 512KB limit or invalid input" }
```

**`401 Unauthorized`** — token missing/malformed/expired.

**`502 Bad Gateway`** — OCR service unreachable or its response could not be read.

```json
{ "message": "OCR service unreachable." }
```

**`503 Service Unavailable`** — `OCR_URL` is not configured on the server.

```json
{ "message": "OCR service not configured." }
```
