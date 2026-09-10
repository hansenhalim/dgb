package usecase

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"github.com/hansenhalim/dgb/api/internal/entity"
)

type CheckoutVisitInput struct {
	VisitID uuid.UUID
	StaffID uuid.UUID
	GateID  int16
}

type CheckoutVisitUsecase interface {
	Execute(ctx context.Context, in CheckoutVisitInput) error
}

type checkoutVisit struct {
	visitRepo   VisitRepository
	eventRepo   VisitEventRepository
	visitorRepo VisitorRepository
	rfidRepo    RfidRepository
	clock       Clock
	tx          TxRunner
}

func NewCheckoutVisit(
	visitRepo VisitRepository,
	eventRepo VisitEventRepository,
	visitorRepo VisitorRepository,
	rfidRepo RfidRepository,
	clock Clock,
	tx TxRunner,
) CheckoutVisitUsecase {
	return &checkoutVisit{
		visitRepo:   visitRepo,
		eventRepo:   eventRepo,
		visitorRepo: visitorRepo,
		rfidRepo:    rfidRepo,
		clock:       clock,
		tx:          tx,
	}
}

func (u *checkoutVisit) Execute(ctx context.Context, in CheckoutVisitInput) error {
	position := entity.CheckoutPositionForGate(in.GateID)
	if position == entity.CurrentPositionUnknown {
		return entity.ErrInvalidVisitInput
	}

	staffID := in.StaffID
	event := &entity.VisitEvent{
		VisitID:         in.VisitID,
		StaffID:         &staffID,
		GateID:          in.GateID,
		Action:          entity.VisitActionCheckout,
		CurrentPosition: position,
		CreatedAt:       u.clock.Now().UTC(),
	}

	return u.tx.Run(ctx, func(ctx context.Context) error {
		visit, err := u.visitRepo.FindByID(ctx, in.VisitID)
		if errors.Is(err, entity.ErrVisitNotFound) {
			// Visit rows arrive eventually (state also rides on the RFID card),
			// so a missing row must not block the gate. The tap is still logged;
			// the side effects are skipped because they are all keyed to state
			// this DB doesn't have yet (visitor ban, RFID binding). Gate stock
			// needs no action here: it is derived from the event log, and
			// gate_states counts only the first CHECKOUT per visit, so the
			// repeated events this path can append still move stock once.
			return u.eventRepo.Append(ctx, event)
		}
		if err != nil {
			return err
		}

		latest, err := u.eventRepo.LatestByVisit(ctx, in.VisitID)
		if err != nil {
			return err
		}
		alreadyOut := latest != nil && latest.Action == entity.VisitActionCheckout

		if err := u.eventRepo.Append(ctx, event); err != nil {
			return err
		}
		if alreadyOut {
			// Duplicate tap (retry, double scan): the event is recorded but the
			// side effects already ran once, and neither clearing a ban nor
			// releasing an RFID is safe to repeat. Gate stock is unaffected
			// either way — gate_states counts first CHECKOUT per visit.
			return nil
		}

		if err := u.visitorRepo.ClearBan(ctx, visit.VisitorID); err != nil {
			return err
		}
		return u.rfidRepo.ReleaseByVisit(ctx, in.VisitID)
	})
}
