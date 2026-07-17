-- Visit state becomes event-sourced: every gate transition appends an immutable
-- visit_events row and the visits table stops carrying state columns. The
-- visit_states view derives per-visit state (latest position, first checkin,
-- first checkout) and is what all readers — Go API and the Filament admin —
-- consume. Ordering rides on the uuidv7 primary key (time-sortable), not on
-- created_at, which only has second precision.
--
-- visit_id deliberately has NO foreign key: the RFID card is the source of
-- truth and events must be recordable even when the visit row hasn't arrived
-- in this DB yet. gate_id is nullable only because backfilled historical
-- transitions have no recorded gate; the application always sets it.
CREATE TABLE IF NOT EXISTS visit_events (
    id               uuid         NOT NULL DEFAULT uuidv7(),
    visit_id         uuid         NOT NULL,
    staff_id         uuid         NULL,
    gate_id          smallint     NULL,
    action           varchar(255) NOT NULL,
    current_position varchar(255) NOT NULL,
    created_at       timestamp(0) WITHOUT TIME ZONE NULL,
    CONSTRAINT visit_events_pkey PRIMARY KEY (id),
    CONSTRAINT visit_events_action_check CHECK (action IN ('CHECKIN', 'CHECKOUT', 'TRANSIT', 'TRANSIT_ENTER')),
    CONSTRAINT visit_events_current_position_check CHECK (current_position IN ('OUT', 'VIL_1', 'VIL_2', 'VIL_E', 'TRNST')),
    CONSTRAINT visit_events_staff_id_foreign FOREIGN KEY (staff_id) REFERENCES staff (id),
    CONSTRAINT visit_events_gate_id_foreign FOREIGN KEY (gate_id) REFERENCES gates (id)
);

CREATE INDEX IF NOT EXISTS visit_events_visit_id_index ON visit_events (visit_id);
CREATE INDEX IF NOT EXISTS visit_events_created_at_index ON visit_events (created_at);

-- Backfill: synthesize events from the state columns visits carried until now.
-- staff_id is NULL for all historical rows (never recorded). The three phases
-- run in chronological order per visit (checkin -> intermediate -> checkout) so
-- the uuidv7 ids generated at insert time sort the same way the view expects.

-- Phase 1: check-ins. Position mirrors entity.CheckinPositionForGate at the
-- time of this migration (gates 1,2 -> VIL_1; gate 3 -> VIL_2).
INSERT INTO visit_events (visit_id, staff_id, gate_id, action, current_position, created_at)
SELECT id, NULL, checkin_gate_id, 'CHECKIN',
       CASE WHEN checkin_gate_id = 3 THEN 'VIL_2' ELSE 'VIL_1' END,
       checkin_at
FROM visits
WHERE checkin_at IS NOT NULL
ORDER BY checkin_at;

-- Phase 2: on-site visits whose position moved past their checkin position get
-- one best-effort event carrying the stored position. The real gate and time
-- of that transition were never recorded; updated_at is the closest stamp.
INSERT INTO visit_events (visit_id, staff_id, gate_id, action, current_position, created_at)
SELECT id, NULL, NULL,
       CASE current_position WHEN 'TRNST' THEN 'TRANSIT' ELSE 'TRANSIT_ENTER' END,
       current_position,
       updated_at
FROM visits
WHERE checkin_at IS NOT NULL
  AND checkout_at IS NULL
  AND current_position <> 'OUT'
  AND current_position <> CASE WHEN checkin_gate_id = 3 THEN 'VIL_2' ELSE 'VIL_1' END
ORDER BY updated_at;

-- Phase 3: check-outs.
INSERT INTO visit_events (visit_id, staff_id, gate_id, action, current_position, created_at)
SELECT id, NULL, checkout_gate_id, 'CHECKOUT', 'OUT', checkout_at
FROM visits
WHERE checkout_at IS NOT NULL
ORDER BY checkout_at;

-- Single-column constraints (the position CHECK and the two gate FKs) drop
-- automatically with their columns.
ALTER TABLE visits
    DROP COLUMN IF EXISTS current_position,
    DROP COLUMN IF EXISTS checkin_at,
    DROP COLUMN IF EXISTS checkin_gate_id,
    DROP COLUMN IF EXISTS checkout_at,
    DROP COLUMN IF EXISTS checkout_gate_id;

-- Derived read model. current_position falls back to OUT for visits with no
-- events (rows created by the legacy Laravel store() before its checkin step,
-- which were stored as OUT). updated_at reflects the last state change.
CREATE VIEW visit_states AS
SELECT
    v.id,
    v.visitor_id,
    v.identity_photo,
    v.vehicle_plate_number,
    v.purpose_of_visit,
    v.destination_name,
    COALESCE(latest.current_position, 'OUT') AS current_position,
    ci.created_at AS checkin_at,
    ci.gate_id    AS checkin_gate_id,
    co.created_at AS checkout_at,
    co.gate_id    AS checkout_gate_id,
    v.created_at,
    COALESCE(latest.created_at, v.updated_at) AS updated_at
FROM visits v
LEFT JOIN LATERAL (
    SELECT e.current_position, e.created_at
    FROM visit_events e
    WHERE e.visit_id = v.id
    ORDER BY e.id DESC
    LIMIT 1
) latest ON true
LEFT JOIN LATERAL (
    SELECT e.gate_id, e.created_at
    FROM visit_events e
    WHERE e.visit_id = v.id AND e.action = 'CHECKIN'
    ORDER BY e.id
    LIMIT 1
) ci ON true
LEFT JOIN LATERAL (
    SELECT e.gate_id, e.created_at
    FROM visit_events e
    WHERE e.visit_id = v.id AND e.action = 'CHECKOUT'
    ORDER BY e.id
    LIMIT 1
) co ON true;
