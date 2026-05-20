package usecase_test

import (
	"context"
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
	visitRepo *usecase.MockVisitRepository
	uc        usecase.TransitVisitUsecase
}

func newTransitVisitSUT(t *testing.T) *transitVisitSUT {
	t.Helper()
	visitRepo := usecase.NewMockVisitRepository(t)
	return &transitVisitSUT{
		visitRepo: visitRepo,
		uc:        usecase.NewTransitVisit(visitRepo),
	}
}

func TestTransitVisit_PerimeterGateGoesToTransit(t *testing.T) {
	sut := newTransitVisitSUT(t)
	visitID := uuid.New()
	updatedAt := time.Date(2026, 5, 19, 10, 30, 0, 0, time.UTC)

	sut.visitRepo.EXPECT().UpdateState(mock.Anything, visitID, entity.CurrentPositionInTransit, (*time.Time)(nil), (*int16)(nil)).
		Return(&entity.Visit{ID: visitID, CurrentPosition: entity.CurrentPositionInTransit, UpdatedAt: updatedAt}, nil).Once()

	out, err := sut.uc.Execute(context.Background(), usecase.TransitVisitInput{VisitID: visitID, GateID: 2})

	require.NoError(t, err)
	require.NotNil(t, out)
	assert.Equal(t, entity.CurrentPositionInTransit, out.CurrentArea)
	assert.Equal(t, updatedAt, out.UpdatedAt)
}

func TestTransitVisit_InnerGateGoesToVilla2(t *testing.T) {
	sut := newTransitVisitSUT(t)
	visitID := uuid.New()
	updatedAt := time.Now().UTC()

	sut.visitRepo.EXPECT().UpdateState(mock.Anything, visitID, entity.CurrentPositionVilla2, (*time.Time)(nil), (*int16)(nil)).
		Return(&entity.Visit{ID: visitID, CurrentPosition: entity.CurrentPositionVilla2, UpdatedAt: updatedAt}, nil).Once()

	out, err := sut.uc.Execute(context.Background(), usecase.TransitVisitInput{VisitID: visitID, GateID: 4})

	require.NoError(t, err)
	assert.Equal(t, entity.CurrentPositionVilla2, out.CurrentArea)
}

func TestTransitVisit_UnknownGate(t *testing.T) {
	sut := newTransitVisitSUT(t)

	out, err := sut.uc.Execute(context.Background(), usecase.TransitVisitInput{VisitID: uuid.New(), GateID: 1})

	assert.ErrorIs(t, err, entity.ErrInvalidVisitInput)
	assert.Nil(t, out)
}

func TestTransitVisit_VisitNotFound(t *testing.T) {
	sut := newTransitVisitSUT(t)
	visitID := uuid.New()

	sut.visitRepo.EXPECT().UpdateState(mock.Anything, visitID, entity.CurrentPositionInTransit, (*time.Time)(nil), (*int16)(nil)).
		Return(nil, entity.ErrVisitNotFound).Once()

	out, err := sut.uc.Execute(context.Background(), usecase.TransitVisitInput{VisitID: visitID, GateID: 3})

	assert.ErrorIs(t, err, entity.ErrVisitNotFound)
	assert.Nil(t, out)
}
