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

func (r *TransferRequestRepository) FindAllPendingByGateID(ctx context.Context, gateID int16) ([]*entity.TransferRequest, error) {
	var rows []transferRequest
	if err := r.db.WithContext(ctx).
		Where("status = ?", statusToDB(entity.TransferStatusPending)).
		Where("from_gate_id = ? OR to_gate_id = ?", gateID, gateID).
		Order("id ASC").
		Find(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}

	gateIDs := make(map[int16]struct{}, len(rows)*2)
	for i := range rows {
		gateIDs[rows[i].FromGateID] = struct{}{}
		gateIDs[rows[i].ToGateID] = struct{}{}
	}
	gateByID := make(map[int16]*entity.Gate, len(gateIDs))
	for id := range gateIDs {
		g, err := r.findGate(ctx, id)
		if err != nil {
			return nil, err
		}
		gateByID[id] = g
	}

	out := make([]*entity.TransferRequest, len(rows))
	for i := range rows {
		t := toEntity(&rows[i])
		t.FromGate = gateByID[rows[i].FromGateID]
		t.ToGate = gateByID[rows[i].ToGateID]
		out[i] = t
	}
	return out, nil
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
