-- Gate card stock becomes derived rather than mutated. gates.current_quota is
-- now an opening balance owned solely by the Filament admin; every other
-- movement of a physical RFID card is replayed from the logs that already
-- record it. Nothing but the admin writes the base column.
--
-- Counting rides on visit_states, not raw visit_events, and that is load
-- bearing: a duplicate checkout tap (retry, double scan) appends a second
-- CHECKOUT event by design, and a checkout whose visit row has not replicated
-- yet appends one with no dedupe guard at all. Counting events directly would
-- mint a phantom card for each. visit_states collapses to the first CHECKIN and
-- first CHECKOUT per visit, so one visit can move stock at most once each way.
--
-- Cross-gate exits are meant to move stock permanently: a card handed out at
-- gate 1 and returned at gate 2 is physically in gate 2's drawer afterwards,
-- and the arithmetic says so. Drift from never-returned cards is corrected by
-- an admin recounting the drawer and editing the base.
--
-- gate_states depends on visit_states; drop it first if that view is ever
-- rebuilt.

-- Convert the stored column from live stock into an opening balance before the
-- view starts replaying history on top of it. Until now the increment/decrement
-- code kept gates.current_quota as the live count, so every check-in, check-out
-- and confirmed transfer is ALREADY baked into it. Creating the view without
-- this step would subtract that same history a second time. Adding it back here
-- makes the derived value equal the live value at cutover, so no gate's card
-- count moves the moment this migration runs. It is also the exact inverse of
-- the reconciliation in the down migration, which keeps up/down a round trip.
UPDATE gates g
SET current_quota = (
    g.current_quota
    + (SELECT COUNT(*) FROM visit_states s WHERE s.checkin_gate_id = g.id)
    - (SELECT COUNT(*) FROM visit_states s WHERE s.checkout_gate_id = g.id)
    + (SELECT COALESCE(SUM(t.amount), 0) FROM transfer_requests t
        WHERE t.status = 'CFRM' AND t.from_gate_id = g.id)
    - (SELECT COALESCE(SUM(t.amount), 0) FROM transfer_requests t
        WHERE t.status = 'CFRM' AND t.to_gate_id = g.id)
)::smallint;

CREATE VIEW gate_states AS
SELECT
    g.id,
    g.name,
    g.current_quota AS base_quota,
    -- Intermediates are bigint (COUNT/SUM); only the net lands in smallint,
    -- which is the width the base column and entity.Gate already use.
    (
        g.current_quota
        - COALESCE(ci.n, 0)
        + COALESCE(co.n, 0)
        - COALESCE(xo.n, 0)
        + COALESCE(xi.n, 0)
    )::smallint AS current_quota,
    g.created_at,
    g.updated_at
FROM gates g
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS n
    FROM visit_states s
    WHERE s.checkin_gate_id = g.id
) ci ON true
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS n
    FROM visit_states s
    WHERE s.checkout_gate_id = g.id
) co ON true
LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(t.amount), 0) AS n
    FROM transfer_requests t
    WHERE t.status = 'CFRM' AND t.from_gate_id = g.id
) xo ON true
LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(t.amount), 0) AS n
    FROM transfer_requests t
    WHERE t.status = 'CFRM' AND t.to_gate_id = g.id
) xi ON true;

-- Serves the first-CHECKIN / first-CHECKOUT laterals inside visit_states.
CREATE INDEX IF NOT EXISTS visit_events_visit_action_id_index
    ON visit_events (visit_id, action, id);

-- Serves visit_states' latest-event lateral (ORDER BY id DESC LIMIT 1), which
-- is still evaluated even though gate_states ignores current_position.
CREATE INDEX IF NOT EXISTS visit_events_visit_id_id_index
    ON visit_events (visit_id, id);

-- Serve the confirmed-transfer sums.
CREATE INDEX IF NOT EXISTS transfer_requests_from_gate_status_index
    ON transfer_requests (from_gate_id, status);

CREATE INDEX IF NOT EXISTS transfer_requests_to_gate_status_index
    ON transfer_requests (to_gate_id, status);
