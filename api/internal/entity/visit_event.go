package entity

import (
	"time"

	"github.com/google/uuid"
)

type VisitAction int

const (
	VisitActionUnknown VisitAction = iota
	VisitActionCheckin
	VisitActionCheckout
	VisitActionTransit
	VisitActionTransitEnter
)

// VisitEvent is one immutable gate transition. Visit state is derived from
// these rows (the visit_states view picks the latest per visit); nothing
// updates them after insert. StaffID is nil only on rows backfilled from the
// pre-event-log schema, where the operator was never recorded.
type VisitEvent struct {
	ID              uuid.UUID
	VisitID         uuid.UUID
	StaffID         *uuid.UUID
	GateID          int16
	Action          VisitAction
	CurrentPosition CurrentPosition
	CreatedAt       time.Time
}
