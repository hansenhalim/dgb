package entity

import (
	"time"

	"github.com/google/uuid"
)

type Role int

const (
	RoleUnknown Role = iota
	RoleGuard
	RoleManager
)

type Staff struct {
	ID        uuid.UUID
	Role      Role
	Name      string
	SecretKey string
	CreatedAt time.Time
	UpdatedAt time.Time
}
