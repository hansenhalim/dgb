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

type visit struct {
	ID                 uuid.UUID  `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()"`
	VisitorID          uuid.UUID  `gorm:"column:visitor_id;type:uuid"`
	IdentityPhoto      []byte     `gorm:"column:identity_photo"`
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

func (visit) TableName() string { return "visits" }
