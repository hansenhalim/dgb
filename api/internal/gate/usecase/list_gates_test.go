package usecase_test

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/hansenhalim/dgb/api/internal/entity"
	"github.com/hansenhalim/dgb/api/internal/gate/usecase"
)

type listGatesSUT struct {
	repo         *usecase.MockGateRepository
	availability *usecase.MockGateAvailabilityChecker
	uc           usecase.ListGatesUsecase
}

func newListGatesSUT(t *testing.T) *listGatesSUT {
	t.Helper()
	repo := usecase.NewMockGateRepository(t)
	availability := usecase.NewMockGateAvailabilityChecker(t)
	return &listGatesSUT{
		repo:         repo,
		availability: availability,
		uc:           usecase.NewListGates(repo, availability),
	}
}

func TestListGates_Success(t *testing.T) {
	sut := newListGatesSUT(t)

	sut.repo.EXPECT().ListAll(context.Background()).Return([]entity.Gate{
		{ID: 1, Name: "Gerbang 1", CurrentQuota: 300},
		{ID: 2, Name: "Gerbang 2", CurrentQuota: 150},
		{ID: 4, Name: "Gerbang 4", CurrentQuota: 0},
	}, nil).Once()
	sut.availability.EXPECT().IsAvailable(int16(1)).Return(true).Once()
	sut.availability.EXPECT().IsAvailable(int16(2)).Return(false).Once()
	sut.availability.EXPECT().IsAvailable(int16(4)).Return(true).Once()

	out, err := sut.uc.Execute(context.Background())

	require.NoError(t, err)
	require.NotNil(t, out)
	require.Len(t, out.Items, 3)

	assert.Equal(t, usecase.ListGatesItem{ID: 1, Name: "Gerbang 1", IsAvailable: true}, out.Items[0])
	assert.Equal(t, usecase.ListGatesItem{ID: 2, Name: "Gerbang 2", IsAvailable: false}, out.Items[1])
	assert.Equal(t, usecase.ListGatesItem{ID: 4, Name: "Gerbang 4", IsAvailable: true}, out.Items[2])
}

func TestListGates_EmptyList(t *testing.T) {
	sut := newListGatesSUT(t)

	sut.repo.EXPECT().ListAll(context.Background()).Return([]entity.Gate{}, nil).Once()

	out, err := sut.uc.Execute(context.Background())

	require.NoError(t, err)
	require.NotNil(t, out)
	assert.Empty(t, out.Items)
}

func TestListGates_RepositoryError(t *testing.T) {
	sut := newListGatesSUT(t)
	dbErr := errors.New("db down")
	sut.repo.EXPECT().ListAll(context.Background()).Return(nil, dbErr).Once()

	out, err := sut.uc.Execute(context.Background())

	assert.ErrorIs(t, err, dbErr)
	assert.Nil(t, out)
}
