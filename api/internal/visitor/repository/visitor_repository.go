package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/hansenhalim/dgb/api/internal/entity"
	"github.com/hansenhalim/dgb/api/internal/shared/tx"
)

type VisitorRepository struct {
	db *gorm.DB
}

func NewVisitorRepository(db *gorm.DB) *VisitorRepository {
	return &VisitorRepository{db: db}
}

func (r *VisitorRepository) FindByIdentityHash(ctx context.Context, identityHashHex string) (*entity.Visitor, error) {
	var row visitor
	err := tx.DB(ctx, r.db).
		Select("id", "fullname", "banned_at", "banned_reason").
		Where("identity_number = ?", identityHashHex).
		First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &entity.Visitor{
		ID:           row.ID,
		Fullname:     row.Fullname,
		BannedAt:     row.BannedAt,
		BannedReason: row.BannedReason,
	}, nil
}

func (r *VisitorRepository) UpsertByIdentityHash(ctx context.Context, identityHashHex, fullname string) (*entity.Visitor, error) {
	var row visitor
	err := tx.DB(ctx, r.db).
		Where("identity_number = ?", identityHashHex).
		First(&row).Error

	switch {
	case errors.Is(err, gorm.ErrRecordNotFound):
		row = visitor{IdentityNumber: identityHashHex, Fullname: fullname}
		if err := tx.DB(ctx, r.db).Create(&row).Error; err != nil {
			return nil, err
		}
	case err != nil:
		return nil, err
	default:
		if row.Fullname != fullname {
			if err := tx.DB(ctx, r.db).
				Model(&row).
				Update("fullname", fullname).Error; err != nil {
				return nil, err
			}
			row.Fullname = fullname
		}
	}

	return &entity.Visitor{
		ID:           row.ID,
		Fullname:     row.Fullname,
		BannedAt:     row.BannedAt,
		BannedReason: row.BannedReason,
	}, nil
}

func (r *VisitorRepository) MarkBanned(ctx context.Context, visitorID uuid.UUID, reason string, bannedAt time.Time) error {
	return tx.DB(ctx, r.db).
		Model(&visitor{}).
		Where("id = ?", visitorID).
		Updates(map[string]any{
			"banned_at":     &bannedAt,
			"banned_reason": reason,
		}).Error
}

func (r *VisitorRepository) ClearBan(ctx context.Context, visitorID uuid.UUID) error {
	return tx.DB(ctx, r.db).
		Model(&visitor{}).
		Where("id = ?", visitorID).
		Updates(map[string]any{
			"banned_at":     gorm.Expr("NULL"),
			"banned_reason": gorm.Expr("NULL"),
		}).Error
}
