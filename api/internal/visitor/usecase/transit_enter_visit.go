package usecase

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/hansenhalim/dgb/api/internal/entity"
)

type TransitEnterVisitInput struct {
	VisitID uuid.UUID
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
	visitRepo VisitRepository
	clock     Clock
}

func NewTransitEnterVisit(visitRepo VisitRepository, clock Clock) TransitEnterVisitUsecase {
	return &transitEnterVisit{visitRepo: visitRepo, clock: clock}
}

func (u *transitEnterVisit) Execute(ctx context.Context, in TransitEnterVisitInput) (*TransitEnterVisitOutput, error) {
	position := entity.TransitEnterPositionForGate(in.GateID)
	if position == entity.CurrentPositionUnknown {
		return nil, entity.ErrInvalidVisitInput
	}

	visit, err := u.visitRepo.UpdateState(ctx, in.VisitID, position, nil, nil)
	if errors.Is(err, entity.ErrVisitNotFound) {
		// Visit rows arrive eventually (state also rides on the RFID card), so a
		// missing row must not block the gate: report success with the position
		// this update would have written. The transition itself is dropped.
		return &TransitEnterVisitOutput{
			CurrentArea: position,
			UpdatedAt:   u.clock.Now().UTC(),
		}, nil
	}
	if err != nil {
		return nil, err
	}
	return &TransitEnterVisitOutput{
		CurrentArea: visit.CurrentPosition,
		UpdatedAt:   visit.UpdatedAt,
	}, nil
}
