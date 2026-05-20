package usecase

import (
	"context"
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
}

func NewTransitEnterVisit(visitRepo VisitRepository) TransitEnterVisitUsecase {
	return &transitEnterVisit{visitRepo: visitRepo}
}

func (u *transitEnterVisit) Execute(ctx context.Context, in TransitEnterVisitInput) (*TransitEnterVisitOutput, error) {
	position := entity.TransitEnterPositionForGate(in.GateID)
	if position == entity.CurrentPositionUnknown {
		return nil, entity.ErrInvalidVisitInput
	}

	visit, err := u.visitRepo.UpdateState(ctx, in.VisitID, position, nil, nil)
	if err != nil {
		return nil, err
	}
	return &TransitEnterVisitOutput{
		CurrentArea: visit.CurrentPosition,
		UpdatedAt:   visit.UpdatedAt,
	}, nil
}
