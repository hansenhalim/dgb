package repository

import (
	"time"

	"github.com/google/uuid"
)

type rfid struct {
	ID           uint16    `gorm:"column:id;primaryKey"`
	UID          []byte    `gorm:"column:uid"`
	Key          []byte    `gorm:"column:key"`
	PIN          string    `gorm:"column:pin"`
	RfidableType string    `gorm:"column:rfidable_type"`
	RfidableID   uuid.UUID `gorm:"column:rfidable_id;type:uuid"`
	CreatedAt    time.Time `gorm:"column:created_at"`
	UpdatedAt    time.Time `gorm:"column:updated_at"`
}

func (rfid) TableName() string { return "rfids" }

type staff struct {
	ID        uuid.UUID `gorm:"column:id;type:uuid;primaryKey"`
	Role      string    `gorm:"column:role"`
	Name      string    `gorm:"column:name"`
	SecretKey string    `gorm:"column:secret_key"`
	CreatedAt time.Time `gorm:"column:created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

func (staff) TableName() string { return "staff" }
