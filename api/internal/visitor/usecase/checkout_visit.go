package usecase

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/hansenhalim/dgb/api/internal/entity"
)

type CheckoutVisitInput struct {
	VisitID uuid.UUID
	GateID  int16
}

type CheckoutVisitUsecase interface {
	Execute(ctx context.Context, in CheckoutVisitInput) error
}

type checkoutVisit struct {
	visitRepo   VisitRepository
	visitorRepo VisitorRepository
	gateRepo    GateRepository
	clock       Clock
	tx          TxRunner
}

func NewCheckoutVisit(
	visitRepo VisitRepository,
	visitorRepo VisitorRepository,
	gateRepo GateRepository,
	clock Clock,
	tx TxRunner,
) CheckoutVisitUsecase {
	return &checkoutVisit{
		visitRepo:   visitRepo,
		visitorRepo: visitorRepo,
		gateRepo:    gateRepo,
		clock:       clock,
		tx:          tx,
	}
}

func (u *checkoutVisit) Execute(ctx context.Context, in CheckoutVisitInput) error {
	position := entity.CheckoutPositionForGate(in.GateID)
	if position == entity.CurrentPositionUnknown {
		return entity.ErrInvalidVisitInput
	}

	now := u.clock.Now().UTC()
	gateID := in.GateID

	return u.tx.Run(ctx, func(ctx context.Context) error {
		visit, err := u.visitRepo.UpdateState(ctx, in.VisitID, position, ptrTime(now), &gateID)
		if err != nil {
			return err
		}
		if err := u.visitorRepo.ClearBan(ctx, visit.VisitorID); err != nil {
			return err
		}
		return u.gateRepo.AdjustQuota(ctx, in.GateID, 1)
	})
}

func ptrTime(t time.Time) *time.Time { return &t }
