package repository

import (
	"context"
	"time"

	"gorm.io/gorm"
)

// HomeRepository computes the aggregate counts shown on the guard's home screen.
type HomeRepository struct {
	db *gorm.DB
}

func NewHomeRepository(db *gorm.DB) *HomeRepository {
	return &HomeRepository{db: db}
}

// SnapshotCounts is the raw aggregate the home usecase shapes into the
// dashboard response.
type SnapshotCounts struct {
	GateQuotaSum int64 // free cards across all gates right now
	ActiveVisits int64 // visits with checkout_at IS NULL
	TodayVisits  int64 // visits with checkin_at >= today UTC
}

func (r *HomeRepository) Snapshot(ctx context.Context, nowUTC time.Time) (*SnapshotCounts, error) {
	var out SnapshotCounts

	if err := r.db.WithContext(ctx).
		Table("gates").
		Select("COALESCE(SUM(current_quota), 0)").
		Scan(&out.GateQuotaSum).Error; err != nil {
		return nil, err
	}

	if err := r.db.WithContext(ctx).
		Table("visits").
		Where("checkout_at IS NULL").
		Count(&out.ActiveVisits).Error; err != nil {
		return nil, err
	}

	startOfDay := time.Date(nowUTC.Year(), nowUTC.Month(), nowUTC.Day(), 0, 0, 0, 0, time.UTC)
	if err := r.db.WithContext(ctx).
		Table("visits").
		Where("checkin_at >= ?", startOfDay).
		Count(&out.TodayVisits).Error; err != nil {
		return nil, err
	}

	return &out, nil
}
