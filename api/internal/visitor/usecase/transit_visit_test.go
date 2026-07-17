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

type transitVisitSUT struct {
	eventRepo *usecase.MockVisitEventRepository
	clock     *usecase.MockClock
	uc        usecase.TransitVisitUsecase
}

func newTransitVisitSUT(t *testing.T) *transitVisitSUT {
	t.Helper()
	eventRepo := usecase.NewMockVisitEventRepository(t)
	clock := usecase.NewMockClock(t)
	return &transitVisitSUT{
		eventRepo: eventRepo,
		clock:     clock,
		uc:        usecase.NewTransitVisit(eventRepo, clock),
	}
}

func matchTransitEvent(visitID, staffID uuid.UUID, gateID int16, pos entity.CurrentPosition, at time.Time) any {
	return mock.MatchedBy(func(e *entity.VisitEvent) bool {
		return e.VisitID == visitID &&
			e.StaffID != nil && *e.StaffID == staffID &&
			e.GateID == gateID &&
			e.Action == entity.VisitActionTransit &&
			e.CurrentPosition == pos &&
			e.CreatedAt.Equal(at)
	})
}

func TestTransitVisit_PerimeterGateGoesToTransit(t *testing.T) {
	sut := newTransitVisitSUT(t)
	visitID := uuid.New()
	staffID := uuid.New()
	now := time.Date(2026, 5, 19, 10, 30, 0, 0, time.UTC)

	sut.clock.EXPECT().Now().Return(now).Once()
	sut.eventRepo.EXPECT().Append(mock.Anything, matchTransitEvent(visitID, staffID, 2, entity.CurrentPositionInTransit, now)).
		Return(nil).Once()

	out, err := sut.uc.Execute(context.Background(), usecase.TransitVisitInput{VisitID: visitID, StaffID: staffID, GateID: 2})

	require.NoError(t, err)
	require.NotNil(t, out)
	assert.Equal(t, entity.CurrentPositionInTransit, out.CurrentArea)
	assert.Equal(t, now, out.UpdatedAt)
}

func TestTransitVisit_InnerGateGoesToVilla2(t *testing.T) {
	sut := newTransitVisitSUT(t)
	visitID := uuid.New()
	staffID := uuid.New()
	now := time.Now().UTC()

	sut.clock.EXPECT().Now().Return(now).Once()
	sut.eventRepo.EXPECT().Append(mock.Anything, matchTransitEvent(visitID, staffID, 4, entity.CurrentPositionVilla2, now)).
		Return(nil).Once()

	out, err := sut.uc.Execute(context.Background(), usecase.TransitVisitInput{VisitID: visitID, StaffID: staffID, GateID: 4})

	require.NoError(t, err)
	assert.Equal(t, entity.CurrentPositionVilla2, out.CurrentArea)
}

func TestTransitVisit_UnknownGate(t *testing.T) {
	sut := newTransitVisitSUT(t)

	out, err := sut.uc.Execute(context.Background(), usecase.TransitVisitInput{VisitID: uuid.New(), StaffID: uuid.New(), GateID: 1})

	assert.ErrorIs(t, err, entity.ErrInvalidVisitInput)
	assert.Nil(t, out)
}

func TestTransitVisit_AppendError(t *testing.T) {
	sut := newTransitVisitSUT(t)
	now := time.Now().UTC()
	dbErr := errors.New("append failed")

	sut.clock.EXPECT().Now().Return(now).Once()
	sut.eventRepo.EXPECT().Append(mock.Anything, mock.Anything).Return(dbErr).Once()

	out, err := sut.uc.Execute(context.Background(), usecase.TransitVisitInput{VisitID: uuid.New(), StaffID: uuid.New(), GateID: 3})

	assert.ErrorIs(t, err, dbErr)
	assert.Nil(t, out)
}
