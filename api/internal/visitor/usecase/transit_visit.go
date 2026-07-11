package usecase

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/hansenhalim/dgb/api/internal/entity"
)

type TransitVisitInput struct {
	VisitID uuid.UUID
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
	visitRepo VisitRepository
	clock     Clock
}

func NewTransitVisit(visitRepo VisitRepository, clock Clock) TransitVisitUsecase {
	return &transitVisit{visitRepo: visitRepo, clock: clock}
}

func (u *transitVisit) Execute(ctx context.Context, in TransitVisitInput) (*TransitVisitOutput, error) {
	position := entity.TransitPositionForGate(in.GateID)
	if position == entity.CurrentPositionUnknown {
		return nil, entity.ErrInvalidVisitInput
	}

	visit, err := u.visitRepo.UpdateState(ctx, in.VisitID, position, nil, nil)
	if errors.Is(err, entity.ErrVisitNotFound) {
		// Visit rows arrive eventually (state also rides on the RFID card), so a
		// missing row must not block the gate: report success with the position
		// this update would have written. The transition itself is dropped.
		return &TransitVisitOutput{
			CurrentArea: position,
			UpdatedAt:   u.clock.Now().UTC(),
		}, nil
	}
	if err != nil {
		return nil, err
	}
	return &TransitVisitOutput{
		CurrentArea: visit.CurrentPosition,
		UpdatedAt:   visit.UpdatedAt,
	}, nil
}
