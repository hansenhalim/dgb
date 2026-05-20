package usecase

import (
	"context"
	"sort"

	"github.com/hansenhalim/dgb/api/internal/entity"
)

type GetVisitHistoryUsecase interface {
	Execute(ctx context.Context, gateID int16) ([]entity.Visit, error)
}

type getVisitHistory struct {
	visitRepo VisitRepository
}

func NewGetVisitHistory(visitRepo VisitRepository) GetVisitHistoryUsecase {
	return &getVisitHistory{visitRepo: visitRepo}
}

func (u *getVisitHistory) Execute(ctx context.Context, gateID int16) ([]entity.Visit, error) {
	visits, err := u.visitRepo.ListByGate(ctx, gateID)
	if err != nil {
		return nil, err
	}

	sort.SliceStable(visits, func(i, j int) bool {
		return positionPriority(visits[i].CurrentPosition) < positionPriority(visits[j].CurrentPosition)
	})

	return visits, nil
}

// positionPriority mirrors the Laravel history endpoint's ordering: visits
// inside the villas come first, then the exclusive area, then OUTSIDE / TRANSIT.
func positionPriority(p entity.CurrentPosition) int {
	switch p {
	case entity.CurrentPositionVilla1:
		return 1
	case entity.CurrentPositionVilla2:
		return 2
	case entity.CurrentPositionExclusive:
		return 3
	case entity.CurrentPositionOutside:
		return 4
	case entity.CurrentPositionInTransit:
		return 5
	default:
		return 999
	}
}
