-- Rolling back hands gates.current_quota back to the increment/decrement code
-- paths, which treat it as live stock. By now it holds an opening balance, so
-- collapse the derived value into the base column before the view goes away —
-- otherwise the restored writers resume from a number that is stale by every
-- visit and transfer recorded since this migration ran.
UPDATE gates g
SET current_quota = s.current_quota
FROM gate_states s
WHERE s.id = g.id;

DROP INDEX IF EXISTS transfer_requests_to_gate_status_index;
DROP INDEX IF EXISTS transfer_requests_from_gate_status_index;
DROP INDEX IF EXISTS visit_events_visit_id_id_index;
DROP INDEX IF EXISTS visit_events_visit_action_id_index;

DROP VIEW IF EXISTS gate_states;
