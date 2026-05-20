package usecase_test

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/hansenhalim/dgb/api/internal/destination/usecase"
	"github.com/hansenhalim/dgb/api/internal/entity"
)

type listDestinationsSUT struct {
	repo *usecase.MockDestinationRepository
	uc   usecase.ListDestinationsUsecase
}

func newListDestinationsSUT(t *testing.T) *listDestinationsSUT {
	t.Helper()
	repo := usecase.NewMockDestinationRepository(t)
	return &listDestinationsSUT{repo: repo, uc: usecase.NewListDestinations(repo)}
}

func TestListDestinations_Success(t *testing.T) {
	sut := newListDestinationsSUT(t)
	expected := []entity.Destination{
		{Name: "AA-1", Position: entity.PositionVilla1},
		{Name: "AA-2", Position: entity.PositionVilla2},
		{Name: "AA-3", Position: entity.PositionExclusive},
	}
	sut.repo.EXPECT().ListAll(context.Background()).Return(expected, nil).Once()

	out, err := sut.uc.Execute(context.Background())

	require.NoError(t, err)
	assert.Equal(t, expected, out)
}

func TestListDestinations_RepoError(t *testing.T) {
	sut := newListDestinationsSUT(t)
	dbErr := errors.New("db down")
	sut.repo.EXPECT().ListAll(context.Background()).Return(nil, dbErr).Once()

	out, err := sut.uc.Execute(context.Background())

	assert.ErrorIs(t, err, dbErr)
	assert.Nil(t, out)
}
