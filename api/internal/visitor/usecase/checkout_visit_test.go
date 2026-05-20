package usecase_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/hansenhalim/dgb/api/internal/entity"
	"github.com/hansenhalim/dgb/api/internal/visitor/usecase"
)

type checkoutVisitSUT struct {
	visitRepo   *usecase.MockVisitRepository
	visitorRepo *usecase.MockVisitorRepository
	clock       *usecase.MockClock
	tx          *usecase.MockTxRunner
	uc          usecase.CheckoutVisitUsecase
}

func newCheckoutVisitSUT(t *testing.T) *checkoutVisitSUT {
	t.Helper()
	visitRepo := usecase.NewMockVisitRepository(t)
	visitorRepo := usecase.NewMockVisitorRepository(t)
	clock := usecase.NewMockClock(t)
	tx := usecase.NewMockTxRunner(t)
	return &checkoutVisitSUT{
		visitRepo:   visitRepo,
		visitorRepo: visitorRepo,
		clock:       clock,
		tx:          tx,
		uc:          usecase.NewCheckoutVisit(visitRepo, visitorRepo, clock, tx),
	}
}

func (s *checkoutVisitSUT) expectPassthroughTx() {
	s.tx.EXPECT().Run(mock.Anything, mock.Anything).
		RunAndReturn(func(ctx context.Context, fn func(context.Context) error) error {
			return fn(ctx)
		}).Once()
}

func TestCheckoutVisit_Success(t *testing.T) {
	sut := newCheckoutVisitSUT(t)
	visitID := uuid.New()
	visitorID := uuid.New()
	now := time.Date(2026, 5, 19, 10, 30, 0, 0, time.UTC)
	gateID := int16(2)

	sut.clock.EXPECT().Now().Return(now).Once()
	sut.expectPassthroughTx()
	sut.visitRepo.EXPECT().UpdateState(
		mock.Anything,
		visitID,
		entity.CurrentPositionOutside,
		mock.MatchedBy(func(t *time.Time) bool { return t != nil && t.Equal(now) }),
		mock.MatchedBy(func(g *int16) bool { return g != nil && *g == gateID }),
	).Return(&entity.Visit{ID: visitID, VisitorID: visitorID, CurrentPosition: entity.CurrentPositionOutside, UpdatedAt: now}, nil).Once()
	sut.visitorRepo.EXPECT().ClearBan(mock.Anything, visitorID).Return(nil).Once()

	err := sut.uc.Execute(context.Background(), usecase.CheckoutVisitInput{VisitID: visitID, GateID: gateID})

	require.NoError(t, err)
}

func TestCheckoutVisit_UnknownGate(t *testing.T) {
	sut := newCheckoutVisitSUT(t)

	err := sut.uc.Execute(context.Background(), usecase.CheckoutVisitInput{VisitID: uuid.New(), GateID: 4})

	assert.ErrorIs(t, err, entity.ErrInvalidVisitInput)
}

func TestCheckoutVisit_VisitNotFound(t *testing.T) {
	sut := newCheckoutVisitSUT(t)
	visitID := uuid.New()
	now := time.Now().UTC()

	sut.clock.EXPECT().Now().Return(now).Once()
	sut.expectPassthroughTx()
	sut.visitRepo.EXPECT().UpdateState(mock.Anything, visitID, entity.CurrentPositionOutside, mock.Anything, mock.Anything).
		Return(nil, entity.ErrVisitNotFound).Once()

	err := sut.uc.Execute(context.Background(), usecase.CheckoutVisitInput{VisitID: visitID, GateID: 1})

	assert.ErrorIs(t, err, entity.ErrVisitNotFound)
}

func TestCheckoutVisit_ClearBanError(t *testing.T) {
	sut := newCheckoutVisitSUT(t)
	visitID := uuid.New()
	visitorID := uuid.New()
	now := time.Now().UTC()
	dbErr := errors.New("clear ban failed")

	sut.clock.EXPECT().Now().Return(now).Once()
	sut.expectPassthroughTx()
	sut.visitRepo.EXPECT().UpdateState(mock.Anything, visitID, entity.CurrentPositionOutside, mock.Anything, mock.Anything).
		Return(&entity.Visit{ID: visitID, VisitorID: visitorID}, nil).Once()
	sut.visitorRepo.EXPECT().ClearBan(mock.Anything, visitorID).Return(dbErr).Once()

	err := sut.uc.Execute(context.Background(), usecase.CheckoutVisitInput{VisitID: visitID, GateID: 3})

	assert.ErrorIs(t, err, dbErr)
}
