package repository

import (
	"time"

	"github.com/google/uuid"
)

type transferRequest struct {
	ID               int64      `gorm:"column:id;primaryKey"`
	Status           string     `gorm:"column:status"`
	FromGateID       int16      `gorm:"column:from_gate_id"`
	ToGateID         int16      `gorm:"column:to_gate_id"`
	SenderStaffID    uuid.UUID  `gorm:"column:sender_staff_id;type:uuid"`
	RecipientStaffID *uuid.UUID `gorm:"column:recipient_staff_id;type:uuid"`
	Amount           int16      `gorm:"column:amount"`
	RespondedAt      *time.Time `gorm:"column:responded_at"`
	CreatedAt        time.Time  `gorm:"column:created_at"`
	UpdatedAt        time.Time  `gorm:"column:updated_at"`
}

func (transferRequest) TableName() string { return "transfer_requests" }

type gate struct {
	ID           int16  `gorm:"column:id;primaryKey"`
	Name         string `gorm:"column:name"`
	CurrentQuota int16  `gorm:"column:current_quota"`
}

func (gate) TableName() string { return "gates" }
