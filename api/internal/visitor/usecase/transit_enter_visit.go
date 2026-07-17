package usecase

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/hansenhalim/dgb/api/internal/entity"
)

type TransitEnterVisitInput struct {
	VisitID uuid.UUID
	StaffID uuid.UUID
	GateID  int16
}

type TransitEnterVisitOutput struct {
	CurrentArea entity.CurrentPosition
	UpdatedAt   time.Time
}

type TransitEnterVisitUsecase interface {
	Execute(ctx context.Context, in TransitEnterVisitInput) (*TransitEnterVisitOutput, error)
}

type transitEnterVisit struct {
	eventRepo VisitEventRepository
	clock     Clock
}

func NewTransitEnterVisit(eventRepo VisitEventRepository, clock Clock) TransitEnterVisitUsecase {
	return &transitEnterVisit{eventRepo: eventRepo, clock: clock}
}

func (u *transitEnterVisit) Execute(ctx context.Context, in TransitEnterVisitInput) (*TransitEnterVisitOutput, error) {
	position := entity.TransitEnterPositionForGate(in.GateID)
	if position == entity.CurrentPositionUnknown {
		return nil, entity.ErrInvalidVisitInput
	}

	staffID := in.StaffID
	event := &entity.VisitEvent{
		VisitID:         in.VisitID,
		StaffID:         &staffID,
		GateID:          in.GateID,
		Action:          entity.VisitActionTransitEnter,
		CurrentPosition: position,
		CreatedAt:       u.clock.Now().UTC(),
	}
	// Append never requires the visits row to exist (no FK on visit_id), so a
	// DB that lags the RFID card can't block the gate: the event is recorded
	// and the derived state materializes once the visit row arrives.
	if err := u.eventRepo.Append(ctx, event); err != nil {
		return nil, err
	}

	return &TransitEnterVisitOutput{
		CurrentArea: position,
		UpdatedAt:   event.CreatedAt,
	}, nil
}
