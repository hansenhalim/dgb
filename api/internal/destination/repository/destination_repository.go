package repository

import (
	"context"

	"gorm.io/gorm"

	"github.com/hansenhalim/dgb/api/internal/entity"
)

type DestinationRepository struct {
	db *gorm.DB
}

func NewDestinationRepository(db *gorm.DB) *DestinationRepository {
	return &DestinationRepository{db: db}
}

func (r *DestinationRepository) ListAll(ctx context.Context) ([]entity.Destination, error) {
	var rows []destination
	if err := r.db.WithContext(ctx).
		Select("name", "position").
		Order("name ASC").
		Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]entity.Destination, len(rows))
	for i, row := range rows {
		out[i] = entity.Destination{Name: row.Name, Position: positionFromDB(row.Position)}
	}
	return out, nil
}

func positionFromDB(s string) entity.Position {
	switch s {
	case "VIL_1":
		return entity.PositionVilla1
	case "VIL_2":
		return entity.PositionVilla2
	case "VIL_E":
		return entity.PositionExclusive
	default:
		return entity.PositionUnknown
	}
}
