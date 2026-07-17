package repository

import (
	"time"

	"github.com/google/uuid"
)

type visitor struct {
	ID             uuid.UUID  `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()"`
	IdentityNumber string     `gorm:"column:identity_number"`
	Fullname       string     `gorm:"column:fullname"`
	BannedAt       *time.Time `gorm:"column:banned_at"`
	BannedReason   *string    `gorm:"column:banned_reason"`
	CreatedAt      time.Time  `gorm:"column:created_at"`
	UpdatedAt      time.Time  `gorm:"column:updated_at"`
}

func (visitor) TableName() string { return "visitors" }

// visit maps the visits base table, which carries only the immutable facts of
// a visit. Positional state lives in visit_events; read it via visitState.
type visit struct {
	ID                 uuid.UUID `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()"`
	VisitorID          uuid.UUID `gorm:"column:visitor_id;type:uuid"`
	IdentityPhoto      []byte    `gorm:"column:identity_photo"`
	VehiclePlateNumber string    `gorm:"column:vehicle_plate_number"`
	PurposeOfVisit     string    `gorm:"column:purpose_of_visit"`
	DestinationName    string    `gorm:"column:destination_name"`
	CreatedAt          time.Time `gorm:"column:created_at"`
	UpdatedAt          time.Time `gorm:"column:updated_at"`
}

func (visit) TableName() string { return "visits" }

// visitState maps the visit_states view: visits joined with per-visit derived
// state (latest position, first checkin, first checkout). Read-only.
type visitState struct {
	ID                 uuid.UUID  `gorm:"column:id;type:uuid;primaryKey"`
	VisitorID          uuid.UUID  `gorm:"column:visitor_id;type:uuid"`
	VehiclePlateNumber string     `gorm:"column:vehicle_plate_number"`
	PurposeOfVisit     string     `gorm:"column:purpose_of_visit"`
	DestinationName    string     `gorm:"column:destination_name"`
	CurrentPosition    string     `gorm:"column:current_position"`
	CheckinAt          *time.Time `gorm:"column:checkin_at"`
	CheckinGateID      *int16     `gorm:"column:checkin_gate_id"`
	CheckoutAt         *time.Time `gorm:"column:checkout_at"`
	CheckoutGateID     *int16     `gorm:"column:checkout_gate_id"`
	CreatedAt          time.Time  `gorm:"column:created_at"`
	UpdatedAt          time.Time  `gorm:"column:updated_at"`
}

func (visitState) TableName() string { return "visit_states" }

// visitEvent maps the append-only visit_events table. gate_id and staff_id are
// pointers because backfilled historical rows lack them; the application
// always writes both (staff from the JWT, gate from the request).
type visitEvent struct {
	ID              uuid.UUID  `gorm:"column:id;type:uuid;primaryKey;default:uuidv7()"`
	VisitID         uuid.UUID  `gorm:"column:visit_id;type:uuid"`
	StaffID         *uuid.UUID `gorm:"column:staff_id;type:uuid"`
	GateID          *int16     `gorm:"column:gate_id"`
	Action          string     `gorm:"column:action"`
	CurrentPosition string     `gorm:"column:current_position"`
	CreatedAt       time.Time  `gorm:"column:created_at"`
}

func (visitEvent) TableName() string { return "visit_events" }
