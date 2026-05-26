package usecase_test

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/hansenhalim/dgb/api/internal/entity"
	"github.com/hansenhalim/dgb/api/internal/transferrequest/usecase"
)

type checkTransferRequestSUT struct {
	repo *usecase.MockTransferRequestRepository
	uc   usecase.CheckTransferRequestUsecase
}

func newCheckTransferRequestSUT(t *testing.T) *checkTransferRequestSUT {
	t.Helper()
	repo := usecase.NewMockTransferRequestRepository(t)
	return &checkTransferRequestSUT{
		repo: repo,
		uc:   usecase.NewCheckTransferRequest(repo),
	}
}

func TestCheckTransferRequest_Found(t *testing.T) {
	sut := newCheckTransferRequestSUT(t)

	expected := []*entity.TransferRequest{
		{ID: 1, FromGateID: 2, ToGateID: 1, Amount: 25},
		{ID: 2, FromGateID: 1, ToGateID: 3, Amount: 10},
	}
	sut.repo.EXPECT().FindAllPendingByGateID(context.Background(), int16(1)).Return(expected, nil).Once()

	out, err := sut.uc.Execute(context.Background(), 1)
	require.NoError(t, err)
	assert.Equal(t, expected, out)
}

func TestCheckTransferRequest_NotFound(t *testing.T) {
	sut := newCheckTransferRequestSUT(t)

	sut.repo.EXPECT().FindAllPendingByGateID(context.Background(), int16(1)).Return(nil, nil).Once()

	out, err := sut.uc.Execute(context.Background(), 1)
	require.NoError(t, err)
	assert.Nil(t, out)
}

func TestCheckTransferRequest_RepoError(t *testing.T) {
	sut := newCheckTransferRequestSUT(t)
	dbErr := errors.New("db down")
	sut.repo.EXPECT().FindAllPendingByGateID(context.Background(), int16(1)).Return(nil, dbErr).Once()

	out, err := sut.uc.Execute(context.Background(), 1)
	assert.ErrorIs(t, err, dbErr)
	assert.Nil(t, out)
}
