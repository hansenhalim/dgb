package entity

import (
	"time"

	"github.com/google/uuid"
)

type Visitor struct {
	ID           uuid.UUID
	Fullname     string
	BannedAt     *time.Time
	BannedReason *string
}
