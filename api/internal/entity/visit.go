package entity

import (
	"time"

	"github.com/google/uuid"
)

type Visit struct {
	ID                 uuid.UUID
	VisitorID          uuid.UUID
	IdentityPhoto      []byte
	VehiclePlateNumber string
	PurposeOfVisit     string
	DestinationName    string
	CurrentPosition    CurrentPosition
	CheckinAt          *time.Time
	CheckinGateID      *int16
	CheckoutAt         *time.Time
	CheckoutGateID     *int16
	CreatedAt          time.Time
	UpdatedAt          time.Time
}
