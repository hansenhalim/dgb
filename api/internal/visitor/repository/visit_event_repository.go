package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/hansenhalim/dgb/api/internal/entity"
	"github.com/hansenhalim/dgb/api/internal/shared/tx"
)

type VisitEventRepository struct {
	db *gorm.DB
}

func NewVisitEventRepository(db *gorm.DB) *VisitEventRepository {
	return &VisitEventRepository{db: db}
}

// Append inserts an immutable gate event and populates e.ID. There is
// deliberately no FK on visit_id, so appending succeeds even when the visit
// row hasn't arrived in this DB yet (the RFID card is the source of truth).
func (r *VisitEventRepository) Append(ctx context.Context, e *entity.VisitEvent) error {
	gateID := e.GateID
	row := visitEvent{
		VisitID:         e.VisitID,
		StaffID:         e.StaffID,
		GateID:          &gateID,
		Action:          actionToDB(e.Action),
		CurrentPosition: positionToDB(e.CurrentPosition),
		CreatedAt:       e.CreatedAt,
	}
	if err := tx.DB(ctx, r.db).Create(&row).Error; err != nil {
		return err
	}
	e.ID = row.ID
	return nil
}

// LatestByVisit returns the visit's newest event by id (uuidv7, time-ordered),
// or nil, nil when the visit has no events.
func (r *VisitEventRepository) LatestByVisit(ctx context.Context, visitID uuid.UUID) (*entity.VisitEvent, error) {
	var row visitEvent
	err := tx.DB(ctx, r.db).
		Where("visit_id = ?", visitID).
		Order("id DESC").
		First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	out := &entity.VisitEvent{
		ID:              row.ID,
		VisitID:         row.VisitID,
		StaffID:         row.StaffID,
		Action:          actionFromDB(row.Action),
		CurrentPosition: positionFromDB(row.CurrentPosition),
		CreatedAt:       row.CreatedAt,
	}
	if row.GateID != nil {
		out.GateID = *row.GateID
	}
	return out, nil
}

func actionToDB(a entity.VisitAction) string {
	switch a {
	case entity.VisitActionCheckin:
		return "CHECKIN"
	case entity.VisitActionCheckout:
		return "CHECKOUT"
	case entity.VisitActionTransit:
		return "TRANSIT"
	case entity.VisitActionTransitEnter:
		return "TRANSIT_ENTER"
	default:
		return ""
	}
}

func actionFromDB(s string) entity.VisitAction {
	switch s {
	case "CHECKIN":
		return entity.VisitActionCheckin
	case "CHECKOUT":
		return entity.VisitActionCheckout
	case "TRANSIT":
		return entity.VisitActionTransit
	case "TRANSIT_ENTER":
		return entity.VisitActionTransitEnter
	default:
		return entity.VisitActionUnknown
	}
}
