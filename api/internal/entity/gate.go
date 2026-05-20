package entity

import "time"

type Gate struct {
	ID           int16
	Name         string
	CurrentQuota int16
	CreatedAt    time.Time
	UpdatedAt    time.Time
}
