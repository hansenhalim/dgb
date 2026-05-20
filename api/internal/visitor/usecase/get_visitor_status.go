package usecase

import (
	"context"

	"github.com/hansenhalim/dgb/api/internal/entity"
)

type GetVisitorStatusOutput struct {
	Visitor     entity.Visitor
	LatestVisit *entity.Visit
}

type GetVisitorStatusUsecase interface {
	// Execute returns nil, nil when there's no visitor matching the identity number.
	Execute(ctx context.Context, identityNumber string) (*GetVisitorStatusOutput, error)
}

type getVisitorStatus struct {
	visitorRepo VisitorRepository
	visitRepo   VisitRepository
	digester    Digester
}

func NewGetVisitorStatus(
	visitorRepo VisitorRepository,
	visitRepo VisitRepository,
	digester Digester,
) GetVisitorStatusUsecase {
	return &getVisitorStatus{visitorRepo: visitorRepo, visitRepo: visitRepo, digester: digester}
}

func (u *getVisitorStatus) Execute(ctx context.Context, identityNumber string) (*GetVisitorStatusOutput, error) {
	hash := u.digester.SHA256Hex([]byte(identityNumber))
	visitor, err := u.visitorRepo.FindByIdentityHash(ctx, hash)
	if err != nil {
		return nil, err
	}
	if visitor == nil {
		return nil, nil
	}

	latest, err := u.visitRepo.FindLatestByVisitor(ctx, visitor.ID)
	if err != nil {
		return nil, err
	}

	return &GetVisitorStatusOutput{Visitor: *visitor, LatestVisit: latest}, nil
}
