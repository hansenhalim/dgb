package repository

import "time"

type gate struct {
	ID           int16     `gorm:"column:id;primaryKey"`
	Name         string    `gorm:"column:name"`
	CurrentQuota int16     `gorm:"column:current_quota"`
	CreatedAt    time.Time `gorm:"column:created_at"`
	UpdatedAt    time.Time `gorm:"column:updated_at"`
}

func (gate) TableName() string { return "gates" }
