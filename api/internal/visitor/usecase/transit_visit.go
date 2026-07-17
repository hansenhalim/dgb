package usecase

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/hansenhalim/dgb/api/internal/entity"
)

type TransitVisitInput struct {
	VisitID uuid.UUID
	StaffID uuid.UUID
	GateID  int16
}

type TransitVisitOutput struct {
	CurrentArea entity.CurrentPosition
	UpdatedAt   time.Time
}

type TransitVisitUsecase interface {
	Execute(ctx context.Context, in TransitVisitInput) (*TransitVisitOutput, error)
}

type transitVisit struct {
	eventRepo VisitEventRepository
	clock     Clock
}

func NewTransitVisit(eventRepo VisitEventRepository, clock Clock) TransitVisitUsecase {
	return &transitVisit{eventRepo: eventRepo, clock: clock}
}

func (u *transitVisit) Execute(ctx context.Context, in TransitVisitInput) (*TransitVisitOutput, error) {
	position := entity.TransitPositionForGate(in.GateID)
	if position == entity.CurrentPositionUnknown {
		return nil, entity.ErrInvalidVisitInput
	}

	staffID := in.StaffID
	event := &entity.VisitEvent{
		VisitID:         in.VisitID,
		StaffID:         &staffID,
		GateID:          in.GateID,
		Action:          entity.VisitActionTransit,
		CurrentPosition: position,
		CreatedAt:       u.clock.Now().UTC(),
	}
	// Append never requires the visits row to exist (no FK on visit_id), so a
	// DB that lags the RFID card can't block the gate: the event is recorded
	// and the derived state materializes once the visit row arrives.
	if err := u.eventRepo.Append(ctx, event); err != nil {
		return nil, err
	}

	return &TransitVisitOutput{
		CurrentArea: position,
		UpdatedAt:   event.CreatedAt,
	}, nil
}
