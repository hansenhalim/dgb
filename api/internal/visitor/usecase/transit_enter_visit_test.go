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

type transitEnterVisitSUT struct {
	eventRepo *usecase.MockVisitEventRepository
	clock     *usecase.MockClock
	uc        usecase.TransitEnterVisitUsecase
}

func newTransitEnterVisitSUT(t *testing.T) *transitEnterVisitSUT {
	t.Helper()
	eventRepo := usecase.NewMockVisitEventRepository(t)
	clock := usecase.NewMockClock(t)
	return &transitEnterVisitSUT{
		eventRepo: eventRepo,
		clock:     clock,
		uc:        usecase.NewTransitEnterVisit(eventRepo, clock),
	}
}

func matchTransitEnterEvent(visitID, staffID uuid.UUID, gateID int16, pos entity.CurrentPosition, at time.Time) any {
	return mock.MatchedBy(func(e *entity.VisitEvent) bool {
		return e.VisitID == visitID &&
			e.StaffID != nil && *e.StaffID == staffID &&
			e.GateID == gateID &&
			e.Action == entity.VisitActionTransitEnter &&
			e.CurrentPosition == pos &&
			e.CreatedAt.Equal(at)
	})
}

func TestTransitEnterVisit_Gate2LandsVilla1(t *testing.T) {
	sut := newTransitEnterVisitSUT(t)
	visitID := uuid.New()
	staffID := uuid.New()
	now := time.Date(2026, 5, 19, 10, 30, 0, 0, time.UTC)

	sut.clock.EXPECT().Now().Return(now).Once()
	sut.eventRepo.EXPECT().Append(mock.Anything, matchTransitEnterEvent(visitID, staffID, 2, entity.CurrentPositionVilla1, now)).
		Return(nil).Once()

	out, err := sut.uc.Execute(context.Background(), usecase.TransitEnterVisitInput{VisitID: visitID, StaffID: staffID, GateID: 2})

	require.NoError(t, err)
	require.NotNil(t, out)
	assert.Equal(t, entity.CurrentPositionVilla1, out.CurrentArea)
	assert.Equal(t, now, out.UpdatedAt)
}

func TestTransitEnterVisit_Gate3LandsVilla2(t *testing.T) {
	sut := newTransitEnterVisitSUT(t)
	visitID := uuid.New()
	staffID := uuid.New()
	now := time.Now().UTC()

	sut.clock.EXPECT().Now().Return(now).Once()
	sut.eventRepo.EXPECT().Append(mock.Anything, matchTransitEnterEvent(visitID, staffID, 3, entity.CurrentPositionVilla2, now)).
		Return(nil).Once()

	out, err := sut.uc.Execute(context.Background(), usecase.TransitEnterVisitInput{VisitID: visitID, StaffID: staffID, GateID: 3})

	require.NoError(t, err)
	assert.Equal(t, entity.CurrentPositionVilla2, out.CurrentArea)
}

func TestTransitEnterVisit_Gate4LandsExclusive(t *testing.T) {
	sut := newTransitEnterVisitSUT(t)
	visitID := uuid.New()
	staffID := uuid.New()
	now := time.Now().UTC()

	sut.clock.EXPECT().Now().Return(now).Once()
	sut.eventRepo.EXPECT().Append(mock.Anything, matchTransitEnterEvent(visitID, staffID, 4, entity.CurrentPositionExclusive, now)).
		Return(nil).Once()

	out, err := sut.uc.Execute(context.Background(), usecase.TransitEnterVisitInput{VisitID: visitID, StaffID: staffID, GateID: 4})

	require.NoError(t, err)
	assert.Equal(t, entity.CurrentPositionExclusive, out.CurrentArea)
}

func TestTransitEnterVisit_UnknownGate(t *testing.T) {
	sut := newTransitEnterVisitSUT(t)

	out, err := sut.uc.Execute(context.Background(), usecase.TransitEnterVisitInput{VisitID: uuid.New(), StaffID: uuid.New(), GateID: 1})

	assert.ErrorIs(t, err, entity.ErrInvalidVisitInput)
	assert.Nil(t, out)
}

func TestTransitEnterVisit_AppendError(t *testing.T) {
	sut := newTransitEnterVisitSUT(t)
	now := time.Now().UTC()
	dbErr := errors.New("append failed")

	sut.clock.EXPECT().Now().Return(now).Once()
	sut.eventRepo.EXPECT().Append(mock.Anything, mock.Anything).Return(dbErr).Once()

	out, err := sut.uc.Execute(context.Background(), usecase.TransitEnterVisitInput{VisitID: uuid.New(), StaffID: uuid.New(), GateID: 2})

	assert.ErrorIs(t, err, dbErr)
	assert.Nil(t, out)
}
