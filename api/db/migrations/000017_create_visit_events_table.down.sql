DROP VIEW IF EXISTS visit_states;

ALTER TABLE visits
    ADD COLUMN IF NOT EXISTS current_position varchar(255),
    ADD COLUMN IF NOT EXISTS checkin_at       timestamp(0) WITHOUT TIME ZONE NULL,
    ADD COLUMN IF NOT EXISTS checkin_gate_id  smallint NULL,
    ADD COLUMN IF NOT EXISTS checkout_at      timestamp(0) WITHOUT TIME ZONE NULL,
    ADD COLUMN IF NOT EXISTS checkout_gate_id smallint NULL;

-- Repopulate the state columns from the event log before dropping it.
UPDATE visits v SET
    current_position = COALESCE((
        SELECT e.current_position FROM visit_events e
        WHERE e.visit_id = v.id ORDER BY e.id DESC LIMIT 1
    ), 'OUT'),
    checkin_at = (
        SELECT e.created_at FROM visit_events e
        WHERE e.visit_id = v.id AND e.action = 'CHECKIN' ORDER BY e.id LIMIT 1
    ),
    checkin_gate_id = (
        SELECT e.gate_id FROM visit_events e
        WHERE e.visit_id = v.id AND e.action = 'CHECKIN' ORDER BY e.id LIMIT 1
    ),
    checkout_at = (
        SELECT e.created_at FROM visit_events e
        WHERE e.visit_id = v.id AND e.action = 'CHECKOUT' ORDER BY e.id LIMIT 1
    ),
    checkout_gate_id = (
        SELECT e.gate_id FROM visit_events e
        WHERE e.visit_id = v.id AND e.action = 'CHECKOUT' ORDER BY e.id LIMIT 1
    );

ALTER TABLE visits
    ALTER COLUMN current_position SET NOT NULL,
    ADD CONSTRAINT visits_current_position_check CHECK (current_position IN ('OUT', 'VIL_1', 'VIL_2', 'VIL_E', 'TRNST')),
    ADD CONSTRAINT visits_checkin_gate_id_foreign FOREIGN KEY (checkin_gate_id) REFERENCES gates (id),
    ADD CONSTRAINT visits_checkout_gate_id_foreign FOREIGN KEY (checkout_gate_id) REFERENCES gates (id);

DROP TABLE IF EXISTS visit_events;
