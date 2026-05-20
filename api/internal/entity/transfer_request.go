package entity

import (
	"time"

	"github.com/google/uuid"
)

type TransferStatus int

const (
	TransferStatusUnknown TransferStatus = iota
	TransferStatusPending
	TransferStatusConfirmed
	TransferStatusRejected
)

type TransferRequest struct {
	ID               int64
	Status           TransferStatus
	FromGateID       int16
	ToGateID         int16
	FromGate         *Gate
	ToGate           *Gate
	SenderStaffID    uuid.UUID
	RecipientStaffID *uuid.UUID
	Amount           int16
	RespondedAt      *time.Time
	CreatedAt        time.Time
	UpdatedAt        time.Time
}
