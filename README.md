# Digital Guest Book (dgb)

A guard-facing visitor-logging system for gated properties. Visitors are enrolled onto RFID cards at the gate; every entry is recorded against the card so each visit is auditable end-to-end.

## Architecture

```
                                  ┌────────────────────┐
   Guard's phone (app/)           │  ESP32 reader      │
   ─────────────────────  BLE ───►│  HANN-RFID-01      │
        │                         │  (rfid/)           │
        │                         └────────────────────┘
        │ HTTPS (REST + JWT)
        ▼
   ┌────────────────────┐                    ┌──────────────────┐
   │  Go API (api/)     │── HTTP -──────────►│  OCR (ocr/)      │
   │                    │                    │  FastAPI         │
   └──────────┬─────────┘                    └──────────────────┘
              │
              ▼
   ┌────────────────────┐                     ┌──────────────────┐
   │  Postgres          │◄───── reads/writes ─│  Filament admin  │
   │                    │                     │  (admin/)        │
   └────────────────────┘                     └──────────────────┘
                                                      ▲
                                                      │ HTTPS
                                                Staff browser
```

A guard uses the mobile app to scan or enroll an RFID card over BLE to a nearby ESP32 reader. The app talks to the Go API over HTTPS; the API persists to Postgres and forwards ID-document photos to the OCR microservice for parsing. Office staff use the Filament admin in a browser, which reads and writes the same Postgres directly.

## Packages

| Dir              | What it is                                          | Stack                                         |
| ---------------- | --------------------------------------------------- | --------------------------------------------- |
| [api/](api/)     | System of record. REST API, JWT auth.               | Go 1.26, Echo v5, GORM, Postgres              |
| [admin/](admin/) | Staff back-office. Reads/writes the API's database. | Laravel 13, Filament 4, PHP 8.2+, Tailwind v4 |
| [app/](app/)     | Guard's mobile app. BLE to reader, HTTPS to API.    | Expo 55, React Native, TypeScript             |
| [ocr/](ocr/)     | ID-document OCR microservice. Called by `api/`.     | FastAPI, RapidOCR (PP-OCRv5), ONNX Runtime    |
| [rfid/](rfid/)   | RFID reader firmware. BLE + UART command API.       | ESP32-C3, PlatformIO, Arduino, PN532          |

Setup and run instructions live in each package's own README.

## Domain glossary

- **Visitor** — a person being logged at a gate.
- **Gate** — a physical entry point; also holds an inventory of blank RFID cards.
- **Destination** — the unit/house number the visitor is going to.
- **Transfer request** — inter-gate transfer of blank RFID card stock, used when one gate is overstocked and another is running low.

## Repo conventions

- Each package is independent — no shared build tooling at the root.
- Each package owns its own `.env`. There is no root-level config.
- Postgres is shared between `api/` and `admin/`. **`admin/` owns the schema** (Laravel migrations are the source of truth); `api/` uses GORM at the query layer only.
