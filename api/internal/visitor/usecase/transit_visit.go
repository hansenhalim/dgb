package usecase

import (
	"context"
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
}

func NewTransitVisit(visitRepo VisitRepository) TransitVisitUsecase {
	return &transitVisit{visitRepo: visitRepo}
}

func (u *transitVisit) Execute(ctx context.Context, in TransitVisitInput) (*TransitVisitOutput, error) {
	position := entity.TransitPositionForGate(in.GateID)
	if position == entity.CurrentPositionUnknown {
		return nil, entity.ErrInvalidVisitInput
	}

	visit, err := u.visitRepo.UpdateState(ctx, in.VisitID, position, nil, nil)
	if err != nil {
		return nil, err
	}
	return &TransitVisitOutput{
		CurrentArea: visit.CurrentPosition,
		UpdatedAt:   visit.UpdatedAt,
	}, nil
}
