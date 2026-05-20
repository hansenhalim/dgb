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

type transitEnterVisitSUT struct {
	visitRepo *usecase.MockVisitRepository
	uc        usecase.TransitEnterVisitUsecase
}

func newTransitEnterVisitSUT(t *testing.T) *transitEnterVisitSUT {
	t.Helper()
	visitRepo := usecase.NewMockVisitRepository(t)
	return &transitEnterVisitSUT{
		visitRepo: visitRepo,
		uc:        usecase.NewTransitEnterVisit(visitRepo),
	}
}

func TestTransitEnterVisit_Gate2LandsVilla1(t *testing.T) {
	sut := newTransitEnterVisitSUT(t)
	visitID := uuid.New()
	updatedAt := time.Date(2026, 5, 19, 10, 30, 0, 0, time.UTC)

	sut.visitRepo.EXPECT().UpdateState(mock.Anything, visitID, entity.CurrentPositionVilla1, (*time.Time)(nil), (*int16)(nil)).
		Return(&entity.Visit{ID: visitID, CurrentPosition: entity.CurrentPositionVilla1, UpdatedAt: updatedAt}, nil).Once()

	out, err := sut.uc.Execute(context.Background(), usecase.TransitEnterVisitInput{VisitID: visitID, GateID: 2})

	require.NoError(t, err)
	require.NotNil(t, out)
	assert.Equal(t, entity.CurrentPositionVilla1, out.CurrentArea)
	assert.Equal(t, updatedAt, out.UpdatedAt)
}

func TestTransitEnterVisit_Gate3LandsVilla2(t *testing.T) {
	sut := newTransitEnterVisitSUT(t)
	visitID := uuid.New()

	sut.visitRepo.EXPECT().UpdateState(mock.Anything, visitID, entity.CurrentPositionVilla2, (*time.Time)(nil), (*int16)(nil)).
		Return(&entity.Visit{ID: visitID, CurrentPosition: entity.CurrentPositionVilla2}, nil).Once()

	out, err := sut.uc.Execute(context.Background(), usecase.TransitEnterVisitInput{VisitID: visitID, GateID: 3})

	require.NoError(t, err)
	assert.Equal(t, entity.CurrentPositionVilla2, out.CurrentArea)
}

func TestTransitEnterVisit_Gate4LandsExclusive(t *testing.T) {
	sut := newTransitEnterVisitSUT(t)
	visitID := uuid.New()

	sut.visitRepo.EXPECT().UpdateState(mock.Anything, visitID, entity.CurrentPositionExclusive, (*time.Time)(nil), (*int16)(nil)).
		Return(&entity.Visit{ID: visitID, CurrentPosition: entity.CurrentPositionExclusive}, nil).Once()

	out, err := sut.uc.Execute(context.Background(), usecase.TransitEnterVisitInput{VisitID: visitID, GateID: 4})

	require.NoError(t, err)
	assert.Equal(t, entity.CurrentPositionExclusive, out.CurrentArea)
}

func TestTransitEnterVisit_UnknownGate(t *testing.T) {
	sut := newTransitEnterVisitSUT(t)

	out, err := sut.uc.Execute(context.Background(), usecase.TransitEnterVisitInput{VisitID: uuid.New(), GateID: 1})

	assert.ErrorIs(t, err, entity.ErrInvalidVisitInput)
	assert.Nil(t, out)
}

func TestTransitEnterVisit_VisitNotFound(t *testing.T) {
	sut := newTransitEnterVisitSUT(t)
	visitID := uuid.New()

	sut.visitRepo.EXPECT().UpdateState(mock.Anything, visitID, entity.CurrentPositionVilla1, (*time.Time)(nil), (*int16)(nil)).
		Return(nil, entity.ErrVisitNotFound).Once()

	out, err := sut.uc.Execute(context.Background(), usecase.TransitEnterVisitInput{VisitID: visitID, GateID: 2})

	assert.ErrorIs(t, err, entity.ErrVisitNotFound)
	assert.Nil(t, out)
}
