package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/hansenhalim/dgb/api/internal/entity"
	"github.com/hansenhalim/dgb/api/internal/shared/tx"
)

type VisitRepository struct {
	db *gorm.DB
}

func NewVisitRepository(db *gorm.DB) *VisitRepository {
	return &VisitRepository{db: db}
}

func (r *VisitRepository) FindLatestByVisitor(ctx context.Context, visitorID uuid.UUID) (*entity.Visit, error) {
	var row visit
	err := tx.DB(ctx, r.db).
		Select("id", "vehicle_plate_number", "purpose_of_visit", "destination_name", "created_at").
		Where("visitor_id = ?", visitorID).
		Order("created_at DESC").
		First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &entity.Visit{
		ID:                 row.ID,
		VehiclePlateNumber: row.VehiclePlateNumber,
		PurposeOfVisit:     row.PurposeOfVisit,
		DestinationName:    row.DestinationName,
		CreatedAt:          row.CreatedAt,
	}, nil
}

// ListByGate returns up to 50 visits (from the visit_states view) where either
// checkin_gate_id or checkout_gate_id matches gateID. On-site visits
// (current_position != OUT) are ordered ahead of checked-out (OUT) ones, then
// by created_at DESC, so the LIMIT only ever trims the OUT tail — every
// on-site visit survives regardless of age. Only the columns used by the
// history endpoint are projected. The usecase applies the final fine-grained
// position ordering.
func (r *VisitRepository) ListByGate(ctx context.Context, gateID int16) ([]entity.Visit, error) {
	var rows []visitState
	err := tx.DB(ctx, r.db).
		Select("id", "vehicle_plate_number", "current_position", "destination_name", "created_at").
		Where("checkin_gate_id = ? OR checkout_gate_id = ?", gateID, gateID).
		Order("current_position = 'OUT'").
		Order("created_at DESC").
		Limit(50).
		Find(&rows).Error
	if err != nil {
		return nil, err
	}

	out := make([]entity.Visit, len(rows))
	for i := range rows {
		out[i] = entity.Visit{
			ID:                 rows[i].ID,
			VehiclePlateNumber: rows[i].VehiclePlateNumber,
			DestinationName:    rows[i].DestinationName,
			CurrentPosition:    positionFromDB(rows[i].CurrentPosition),
			CreatedAt:          rows[i].CreatedAt,
		}
	}
	return out, nil
}

// FindByID reads the visits base table (no derived state). Returns
// entity.ErrVisitNotFound when no row matches id.
func (r *VisitRepository) FindByID(ctx context.Context, id uuid.UUID) (*entity.Visit, error) {
	var row visit
	err := tx.DB(ctx, r.db).Where("id = ?", id).First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, entity.ErrVisitNotFound
	}
	if err != nil {
		return nil, err
	}
	return &entity.Visit{
		ID:                 row.ID,
		VisitorID:          row.VisitorID,
		IdentityPhoto:      row.IdentityPhoto,
		VehiclePlateNumber: row.VehiclePlateNumber,
		PurposeOfVisit:     row.PurposeOfVisit,
		DestinationName:    row.DestinationName,
		CreatedAt:          row.CreatedAt,
		UpdatedAt:          row.UpdatedAt,
	}, nil
}

func (r *VisitRepository) Create(ctx context.Context, v *entity.Visit) error {
	row := visit{
		VisitorID:          v.VisitorID,
		IdentityPhoto:      v.IdentityPhoto,
		VehiclePlateNumber: v.VehiclePlateNumber,
		PurposeOfVisit:     v.PurposeOfVisit,
		DestinationName:    v.DestinationName,
	}
	if err := tx.DB(ctx, r.db).Create(&row).Error; err != nil {
		return err
	}
	v.ID = row.ID
	v.CreatedAt = row.CreatedAt
	v.UpdatedAt = row.UpdatedAt
	return nil
}

func positionToDB(p entity.CurrentPosition) string {
	switch p {
	case entity.CurrentPositionOutside:
		return "OUT"
	case entity.CurrentPositionVilla1:
		return "VIL_1"
	case entity.CurrentPositionVilla2:
		return "VIL_2"
	case entity.CurrentPositionExclusive:
		return "VIL_E"
	case entity.CurrentPositionInTransit:
		return "TRNST"
	default:
		return ""
	}
}

func positionFromDB(s string) entity.CurrentPosition {
	switch s {
	case "OUT":
		return entity.CurrentPositionOutside
	case "VIL_1":
		return entity.CurrentPositionVilla1
	case "VIL_2":
		return entity.CurrentPositionVilla2
	case "VIL_E":
		return entity.CurrentPositionExclusive
	case "TRNST":
		return entity.CurrentPositionInTransit
	default:
		return entity.CurrentPositionUnknown
	}
}
