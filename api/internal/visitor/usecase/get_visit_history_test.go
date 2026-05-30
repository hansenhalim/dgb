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

type getVisitHistorySUT struct {
	visitRepo *usecase.MockVisitRepository
	uc        usecase.GetVisitHistoryUsecase
}

func newGetVisitHistorySUT(t *testing.T) *getVisitHistorySUT {
	t.Helper()
	visitRepo := usecase.NewMockVisitRepository(t)
	return &getVisitHistorySUT{
		visitRepo: visitRepo,
		uc:        usecase.NewGetVisitHistory(visitRepo),
	}
}

func TestGetVisitHistory_SortsByPositionPriority(t *testing.T) {
	sut := newGetVisitHistorySUT(t)
	base := time.Date(2025, 6, 26, 14, 0, 0, 0, time.UTC)
	transitID := uuid.New()
	villa1ID := uuid.New()
	villa2ID := uuid.New()
	outsideID := uuid.New()
	exclusiveID := uuid.New()

	// Repo returns in created_at DESC order; transit is newest, villa1 is oldest.
	repoOut := []entity.Visit{
		{ID: transitID, CurrentPosition: entity.CurrentPositionInTransit, CreatedAt: base.Add(4 * time.Minute)},
		{ID: outsideID, CurrentPosition: entity.CurrentPositionOutside, CreatedAt: base.Add(3 * time.Minute)},
		{ID: exclusiveID, CurrentPosition: entity.CurrentPositionExclusive, CreatedAt: base.Add(2 * time.Minute)},
		{ID: villa2ID, CurrentPosition: entity.CurrentPositionVilla2, CreatedAt: base.Add(1 * time.Minute)},
		{ID: villa1ID, CurrentPosition: entity.CurrentPositionVilla1, CreatedAt: base},
	}
	sut.visitRepo.EXPECT().ListByGate(mock.Anything, int16(1)).Return(repoOut, nil).Once()

	out, err := sut.uc.Execute(context.Background(), 1)

	require.NoError(t, err)
	require.Len(t, out, 5)
	assert.Equal(t, villa1ID, out[0].ID)
	assert.Equal(t, villa2ID, out[1].ID)
	assert.Equal(t, exclusiveID, out[2].ID)
	assert.Equal(t, transitID, out[3].ID)
	assert.Equal(t, outsideID, out[4].ID)
}

func TestGetVisitHistory_StableWithinSamePriority(t *testing.T) {
	sut := newGetVisitHistorySUT(t)
	newer := uuid.New()
	older := uuid.New()

	// Both VILLA1 — created_at DESC ordering from the repo must be preserved.
	repoOut := []entity.Visit{
		{ID: newer, CurrentPosition: entity.CurrentPositionVilla1, CreatedAt: time.Now().UTC()},
		{ID: older, CurrentPosition: entity.CurrentPositionVilla1, CreatedAt: time.Now().UTC().Add(-time.Hour)},
	}
	sut.visitRepo.EXPECT().ListByGate(mock.Anything, int16(2)).Return(repoOut, nil).Once()

	out, err := sut.uc.Execute(context.Background(), 2)

	require.NoError(t, err)
	require.Len(t, out, 2)
	assert.Equal(t, newer, out[0].ID)
	assert.Equal(t, older, out[1].ID)
}

func TestGetVisitHistory_Empty(t *testing.T) {
	sut := newGetVisitHistorySUT(t)
	sut.visitRepo.EXPECT().ListByGate(mock.Anything, int16(3)).Return([]entity.Visit{}, nil).Once()

	out, err := sut.uc.Execute(context.Background(), 3)

	require.NoError(t, err)
	assert.Empty(t, out)
}

func TestGetVisitHistory_RepoError(t *testing.T) {
	sut := newGetVisitHistorySUT(t)
	dbErr := errors.New("db down")
	sut.visitRepo.EXPECT().ListByGate(mock.Anything, int16(1)).Return(nil, dbErr).Once()

	out, err := sut.uc.Execute(context.Background(), 1)

	assert.ErrorIs(t, err, dbErr)
	assert.Nil(t, out)
}
