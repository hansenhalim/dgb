package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/hansenhalim/dgb/api/internal/entity"
)

type TransferRequestRepository struct {
	db *gorm.DB
}

func NewTransferRequestRepository(db *gorm.DB) *TransferRequestRepository {
	return &TransferRequestRepository{db: db}
}

func (r *TransferRequestRepository) FindPendingByGateID(ctx context.Context, gateID int16) (*entity.TransferRequest, error) {
	var row transferRequest
	err := r.db.WithContext(ctx).
		Where("status = ?", statusToDB(entity.TransferStatusPending)).
		Where("from_gate_id = ? OR to_gate_id = ?", gateID, gateID).
		First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	from, err := r.findGate(ctx, row.FromGateID)
	if err != nil {
		return nil, err
	}
	to, err := r.findGate(ctx, row.ToGateID)
	if err != nil {
		return nil, err
	}

	t := toEntity(&row)
	t.FromGate = from
	t.ToGate = to
	return t, nil
}

func (r *TransferRequestRepository) ExistsPendingForGates(ctx context.Context, fromGateID, toGateID int16) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&transferRequest{}).
		Where("status = ?", statusToDB(entity.TransferStatusPending)).
		Where("from_gate_id = ? OR to_gate_id = ?", fromGateID, toGateID).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *TransferRequestRepository) Create(ctx context.Context, t *entity.TransferRequest) error {
	row := transferRequest{
		Status:           statusToDB(t.Status),
		FromGateID:       t.FromGateID,
		ToGateID:         t.ToGateID,
		SenderStaffID:    t.SenderStaffID,
		RecipientStaffID: t.RecipientStaffID,
		Amount:           t.Amount,
		RespondedAt:      t.RespondedAt,
	}
	if err := r.db.WithContext(ctx).Create(&row).Error; err != nil {
		return err
	}
	t.ID = row.ID
	t.CreatedAt = row.CreatedAt
	t.UpdatedAt = row.UpdatedAt
	return nil
}

func (r *TransferRequestRepository) FindByID(ctx context.Context, id int64) (*entity.TransferRequest, error) {
	var row transferRequest
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, entity.ErrTransferNotFound
	}
	if err != nil {
		return nil, err
	}
	return toEntity(&row), nil
}

func (r *TransferRequestRepository) Confirm(ctx context.Context, id int64, recipientStaffID uuid.UUID, respondedAt time.Time) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var row transferRequest
		if err := tx.Where("id = ?", id).First(&row).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return entity.ErrTransferNotFound
			}
			return err
		}
		if row.Status != statusToDB(entity.TransferStatusPending) {
			return entity.ErrTransferAlreadyResponded
		}

		if err := tx.Model(&gate{}).
			Where("id = ?", row.FromGateID).
			UpdateColumn("current_quota", gorm.Expr("current_quota - ?", row.Amount)).Error; err != nil {
			return err
		}
		if err := tx.Model(&gate{}).
			Where("id = ?", row.ToGateID).
			UpdateColumn("current_quota", gorm.Expr("current_quota + ?", row.Amount)).Error; err != nil {
			return err
		}

		return tx.Model(&row).Updates(map[string]any{
			"status":             statusToDB(entity.TransferStatusConfirmed),
			"recipient_staff_id": recipientStaffID,
			"responded_at":       respondedAt,
		}).Error
	})
}

func (r *TransferRequestRepository) Reject(ctx context.Context, id int64, recipientStaffID uuid.UUID, respondedAt time.Time) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var row transferRequest
		if err := tx.Where("id = ?", id).First(&row).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return entity.ErrTransferNotFound
			}
			return err
		}
		if row.Status != statusToDB(entity.TransferStatusPending) {
			return entity.ErrTransferAlreadyResponded
		}
		return tx.Model(&row).Updates(map[string]any{
			"status":             statusToDB(entity.TransferStatusRejected),
			"recipient_staff_id": recipientStaffID,
			"responded_at":       respondedAt,
		}).Error
	})
}

func (r *TransferRequestRepository) findGate(ctx context.Context, id int16) (*entity.Gate, error) {
	var g gate
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&g).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, entity.ErrGateNotFound
		}
		return nil, err
	}
	return &entity.Gate{
		ID:           g.ID,
		Name:         g.Name,
		CurrentQuota: g.CurrentQuota,
	}, nil
}

func statusToDB(s entity.TransferStatus) string {
	switch s {
	case entity.TransferStatusPending:
		return "PEND"
	case entity.TransferStatusConfirmed:
		return "CFRM"
	case entity.TransferStatusRejected:
		return "RJCT"
	default:
		return ""
	}
}

func statusFromDB(s string) entity.TransferStatus {
	switch s {
	case "PEND":
		return entity.TransferStatusPending
	case "CFRM":
		return entity.TransferStatusConfirmed
	case "RJCT":
		return entity.TransferStatusRejected
	default:
		return entity.TransferStatusUnknown
	}
}

func toEntity(r *transferRequest) *entity.TransferRequest {
	return &entity.TransferRequest{
		ID:               r.ID,
		Status:           statusFromDB(r.Status),
		FromGateID:       r.FromGateID,
		ToGateID:         r.ToGateID,
		SenderStaffID:    r.SenderStaffID,
		RecipientStaffID: r.RecipientStaffID,
		Amount:           r.Amount,
		RespondedAt:      r.RespondedAt,
		CreatedAt:        r.CreatedAt,
		UpdatedAt:        r.UpdatedAt,
	}
}
