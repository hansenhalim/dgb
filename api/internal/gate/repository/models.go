package repository

import "time"

// gate is read-only: it is backed by the gate_states view, which takes the
// admin-owned opening balance in gates.current_quota and replays every card
// movement recorded in visit_states and transfer_requests on top of it. The
// CurrentQuota field therefore carries live stock, not the stored column.
type gate struct {
	ID           int16     `gorm:"column:id;primaryKey"`
	Name         string    `gorm:"column:name"`
	CurrentQuota int16     `gorm:"column:current_quota"`
	CreatedAt    time.Time `gorm:"column:created_at"`
	UpdatedAt    time.Time `gorm:"column:updated_at"`
}

func (gate) TableName() string { return "gate_states" }
