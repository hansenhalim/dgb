package entity

import (
	"time"

	"github.com/google/uuid"
)

type RfidableType int

const (
	RfidableUnknown RfidableType = iota
	RfidableStaff
	RfidableVisit
)

type Rfid struct {
	ID           uint16
	UID          []byte
	Key          []byte
	PIN          string
	RfidableType RfidableType
	RfidableID   uuid.UUID
	Staff        *Staff
	CreatedAt    time.Time
	UpdatedAt    time.Time
}
