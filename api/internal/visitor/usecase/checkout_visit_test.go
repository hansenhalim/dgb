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
	eventRepo   *usecase.MockVisitEventRepository
	visitorRepo *usecase.MockVisitorRepository
	gateRepo    *usecase.MockGateRepository
	rfidRepo    *usecase.MockRfidRepository
	clock       *usecase.MockClock
	tx          *usecase.MockTxRunner
	uc          usecase.CheckoutVisitUsecase
}

func newCheckoutVisitSUT(t *testing.T) *checkoutVisitSUT {
	t.Helper()
	visitRepo := usecase.NewMockVisitRepository(t)
	eventRepo := usecase.NewMockVisitEventRepository(t)
	visitorRepo := usecase.NewMockVisitorRepository(t)
	gateRepo := usecase.NewMockGateRepository(t)
	rfidRepo := usecase.NewMockRfidRepository(t)
	clock := usecase.NewMockClock(t)
	tx := usecase.NewMockTxRunner(t)
	return &checkoutVisitSUT{
		visitRepo:   visitRepo,
		eventRepo:   eventRepo,
		visitorRepo: visitorRepo,
		gateRepo:    gateRepo,
		rfidRepo:    rfidRepo,
		clock:       clock,
		tx:          tx,
		uc:          usecase.NewCheckoutVisit(visitRepo, eventRepo, visitorRepo, gateRepo, rfidRepo, clock, tx),
	}
}

func (s *checkoutVisitSUT) expectPassthroughTx() {
	s.tx.EXPECT().Run(mock.Anything, mock.Anything).
		RunAndReturn(func(ctx context.Context, fn func(context.Context) error) error {
			return fn(ctx)
		}).Once()
}

func matchCheckoutEvent(visitID, staffID uuid.UUID, gateID int16, at time.Time) any {
	return mock.MatchedBy(func(e *entity.VisitEvent) bool {
		return e.VisitID == visitID &&
			e.StaffID != nil && *e.StaffID == staffID &&
			e.GateID == gateID &&
			e.Action == entity.VisitActionCheckout &&
			e.CurrentPosition == entity.CurrentPositionOutside &&
			e.CreatedAt.Equal(at)
	})
}

func TestCheckoutVisit_Success(t *testing.T) {
	sut := newCheckoutVisitSUT(t)
	visitID := uuid.New()
	staffID := uuid.New()
	visitorID := uuid.New()
	now := time.Date(2026, 5, 19, 10, 30, 0, 0, time.UTC)
	gateID := int16(2)

	sut.clock.EXPECT().Now().Return(now).Once()
	sut.expectPassthroughTx()
	sut.visitRepo.EXPECT().FindByID(mock.Anything, visitID).
		Return(&entity.Visit{ID: visitID, VisitorID: visitorID}, nil).Once()
	sut.eventRepo.EXPECT().LatestByVisit(mock.Anything, visitID).
		Return(&entity.VisitEvent{Action: entity.VisitActionCheckin, CurrentPosition: entity.CurrentPositionVilla1}, nil).Once()
	sut.eventRepo.EXPECT().Append(mock.Anything, matchCheckoutEvent(visitID, staffID, gateID, now)).Return(nil).Once()
	sut.visitorRepo.EXPECT().ClearBan(mock.Anything, visitorID).Return(nil).Once()
	sut.rfidRepo.EXPECT().ReleaseByVisit(mock.Anything, visitID).Return(nil).Once()
	sut.gateRepo.EXPECT().AdjustQuota(mock.Anything, gateID, int16(1)).Return(nil).Once()

	err := sut.uc.Execute(context.Background(), usecase.CheckoutVisitInput{VisitID: visitID, StaffID: staffID, GateID: gateID})

	require.NoError(t, err)
}

func TestCheckoutVisit_UnknownGate(t *testing.T) {
	sut := newCheckoutVisitSUT(t)

	err := sut.uc.Execute(context.Background(), usecase.CheckoutVisitInput{VisitID: uuid.New(), StaffID: uuid.New(), GateID: 4})

	assert.ErrorIs(t, err, entity.ErrInvalidVisitInput)
}

// A visit missing from the DB (not yet synced) must not block the gate: the
// tap is still logged as an event, the usecase reports success, and none of
// the checkout side effects (ban clear, RFID release, quota bump) run — the
// mocks would fail the test on any unexpected call.
func TestCheckoutVisit_VisitNotFoundLogsEventAndReportsSuccess(t *testing.T) {
	sut := newCheckoutVisitSUT(t)
	visitID := uuid.New()
	staffID := uuid.New()
	now := time.Now().UTC()

	sut.clock.EXPECT().Now().Return(now).Once()
	sut.expectPassthroughTx()
	sut.visitRepo.EXPECT().FindByID(mock.Anything, visitID).
		Return(nil, entity.ErrVisitNotFound).Once()
	sut.eventRepo.EXPECT().Append(mock.Anything, matchCheckoutEvent(visitID, staffID, 1, now)).Return(nil).Once()

	err := sut.uc.Execute(context.Background(), usecase.CheckoutVisitInput{VisitID: visitID, StaffID: staffID, GateID: 1})

	require.NoError(t, err)
}

// A duplicate checkout tap (visit already checked out) appends the event so
// the log stays truthful, but must not re-run the side effects — re-running
// would double-increment the gate quota.
func TestCheckoutVisit_DuplicateTapLogsEventSkipsSideEffects(t *testing.T) {
	sut := newCheckoutVisitSUT(t)
	visitID := uuid.New()
	staffID := uuid.New()
	visitorID := uuid.New()
	now := time.Now().UTC()

	sut.clock.EXPECT().Now().Return(now).Once()
	sut.expectPassthroughTx()
	sut.visitRepo.EXPECT().FindByID(mock.Anything, visitID).
		Return(&entity.Visit{ID: visitID, VisitorID: visitorID}, nil).Once()
	sut.eventRepo.EXPECT().LatestByVisit(mock.Anything, visitID).
		Return(&entity.VisitEvent{Action: entity.VisitActionCheckout, CurrentPosition: entity.CurrentPositionOutside}, nil).Once()
	sut.eventRepo.EXPECT().Append(mock.Anything, matchCheckoutEvent(visitID, staffID, 3, now)).Return(nil).Once()

	err := sut.uc.Execute(context.Background(), usecase.CheckoutVisitInput{VisitID: visitID, StaffID: staffID, GateID: 3})

	require.NoError(t, err)
}

// A visit with no events at all (legacy row) is not "already out": side
// effects run.
func TestCheckoutVisit_NoPriorEventsRunsSideEffects(t *testing.T) {
	sut := newCheckoutVisitSUT(t)
	visitID := uuid.New()
	staffID := uuid.New()
	visitorID := uuid.New()
	now := time.Now().UTC()

	sut.clock.EXPECT().Now().Return(now).Once()
	sut.expectPassthroughTx()
	sut.visitRepo.EXPECT().FindByID(mock.Anything, visitID).
		Return(&entity.Visit{ID: visitID, VisitorID: visitorID}, nil).Once()
	sut.eventRepo.EXPECT().LatestByVisit(mock.Anything, visitID).Return(nil, nil).Once()
	sut.eventRepo.EXPECT().Append(mock.Anything, mock.Anything).Return(nil).Once()
	sut.visitorRepo.EXPECT().ClearBan(mock.Anything, visitorID).Return(nil).Once()
	sut.rfidRepo.EXPECT().ReleaseByVisit(mock.Anything, visitID).Return(nil).Once()
	sut.gateRepo.EXPECT().AdjustQuota(mock.Anything, int16(1), int16(1)).Return(nil).Once()

	err := sut.uc.Execute(context.Background(), usecase.CheckoutVisitInput{VisitID: visitID, StaffID: staffID, GateID: 1})

	require.NoError(t, err)
}

func TestCheckoutVisit_ClearBanError(t *testing.T) {
	sut := newCheckoutVisitSUT(t)
	visitID := uuid.New()
	staffID := uuid.New()
	visitorID := uuid.New()
	now := time.Now().UTC()
	dbErr := errors.New("clear ban failed")

	sut.clock.EXPECT().Now().Return(now).Once()
	sut.expectPassthroughTx()
	sut.visitRepo.EXPECT().FindByID(mock.Anything, visitID).
		Return(&entity.Visit{ID: visitID, VisitorID: visitorID}, nil).Once()
	sut.eventRepo.EXPECT().LatestByVisit(mock.Anything, visitID).Return(nil, nil).Once()
	sut.eventRepo.EXPECT().Append(mock.Anything, mock.Anything).Return(nil).Once()
	sut.visitorRepo.EXPECT().ClearBan(mock.Anything, visitorID).Return(dbErr).Once()

	err := sut.uc.Execute(context.Background(), usecase.CheckoutVisitInput{VisitID: visitID, StaffID: staffID, GateID: 3})

	assert.ErrorIs(t, err, dbErr)
}

func TestCheckoutVisit_AppendEventError(t *testing.T) {
	sut := newCheckoutVisitSUT(t)
	visitID := uuid.New()
	staffID := uuid.New()
	visitorID := uuid.New()
	now := time.Now().UTC()
	dbErr := errors.New("append failed")

	sut.clock.EXPECT().Now().Return(now).Once()
	sut.expectPassthroughTx()
	sut.visitRepo.EXPECT().FindByID(mock.Anything, visitID).
		Return(&entity.Visit{ID: visitID, VisitorID: visitorID}, nil).Once()
	sut.eventRepo.EXPECT().LatestByVisit(mock.Anything, visitID).Return(nil, nil).Once()
	sut.eventRepo.EXPECT().Append(mock.Anything, mock.Anything).Return(dbErr).Once()

	err := sut.uc.Execute(context.Background(), usecase.CheckoutVisitInput{VisitID: visitID, StaffID: staffID, GateID: 3})

	assert.ErrorIs(t, err, dbErr)
}
