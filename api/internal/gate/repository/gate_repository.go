package repository

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"github.com/hansenhalim/dgb/api/internal/entity"
)

type GateRepository struct {
	db *gorm.DB
}

func NewGateRepository(db *gorm.DB) *GateRepository {
	return &GateRepository{db: db}
}

func (r *GateRepository) ListAll(ctx context.Context) ([]entity.Gate, error) {
	var rows []gate
	if err := r.db.WithContext(ctx).Order("id ASC").Find(&rows).Error; err != nil {
		return nil, err
	}

	out := make([]entity.Gate, len(rows))
	for i, row := range rows {
		out[i] = toEntityGate(&row)
	}
	return out, nil
}

func (r *GateRepository) FindByID(ctx context.Context, id int16) (*entity.Gate, error) {
	var row gate
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, entity.ErrGateNotFound
	}
	if err != nil {
		return nil, err
	}
	g := toEntityGate(&row)
	return &g, nil
}

func (r *GateRepository) AdjustQuota(ctx context.Context, gateID int16, delta int16) error {
	return r.db.WithContext(ctx).Model(&gate{}).Where("id = ?", gateID).
		UpdateColumn("current_quota", gorm.Expr("current_quota + ?", delta)).Error
}

func toEntityGate(r *gate) entity.Gate {
	return entity.Gate{
		ID:           r.ID,
		Name:         r.Name,
		CurrentQuota: r.CurrentQuota,
		CreatedAt:    r.CreatedAt,
		UpdatedAt:    r.UpdatedAt,
	}
}
