package repository

import (
	"context"
	"time"

	"gorm.io/gorm"
)

// HomeRepository computes the gate-scoped aggregate counts shown on the guard's
// home screen.
type HomeRepository struct {
	db *gorm.DB
}

func NewHomeRepository(db *gorm.DB) *HomeRepository {
	return &HomeRepository{db: db}
}

// SnapshotCounts is the raw aggregate the home usecase shapes into the
// dashboard response. Every numeric field is scoped to a single gate.
type SnapshotCounts struct {
	GateQuota                  int16 // this gate's gates.current_quota (0 if gate id unknown)
	ActiveVisits               int64 // visits checked in at this gate, still open
	TodayVisits                int64 // visits checked in at this gate today (UTC)
	HasIncomingTransferRequest bool  // a PENDING transfer with to_gate_id = this gate
}

// transferStatusPending mirrors the DB-side encoding owned by the
// transferrequest repository (statusToDB). Duplicated here to keep this
// package free of a cross-package dependency on a sibling repo's private
// helpers. Keep in sync if that encoding ever changes.
const transferStatusPending = "PEND"

func (r *HomeRepository) Snapshot(ctx context.Context, gateID int16, nowUTC time.Time) (*SnapshotCounts, error) {
	var out SnapshotCounts

	if err := r.db.WithContext(ctx).
		Table("gates").
		Select("COALESCE(MAX(current_quota), 0)").
		Where("id = ?", gateID).
		Scan(&out.GateQuota).Error; err != nil {
		return nil, err
	}

	if err := r.db.WithContext(ctx).
		Table("visits").
		Where("checkin_gate_id = ? AND checkout_at IS NULL", gateID).
		Count(&out.ActiveVisits).Error; err != nil {
		return nil, err
	}

	startOfDay := time.Date(nowUTC.Year(), nowUTC.Month(), nowUTC.Day(), 0, 0, 0, 0, time.UTC)
	if err := r.db.WithContext(ctx).
		Table("visits").
		Where("checkin_gate_id = ? AND checkin_at >= ?", gateID, startOfDay).
		Count(&out.TodayVisits).Error; err != nil {
		return nil, err
	}

	var pendingCount int64
	if err := r.db.WithContext(ctx).
		Table("transfer_requests").
		Where("status = ? AND to_gate_id = ?", transferStatusPending, gateID).
		Count(&pendingCount).Error; err != nil {
		return nil, err
	}
	out.HasIncomingTransferRequest = pendingCount > 0

	return &out, nil
}
