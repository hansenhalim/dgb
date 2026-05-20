package usecase_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/hansenhalim/dgb/api/internal/entity"
	"github.com/hansenhalim/dgb/api/internal/transferrequest/usecase"
)

type respondTransferRequestSUT struct {
	repo  *usecase.MockTransferRequestRepository
	clock *usecase.MockClock
	uc    usecase.RespondTransferRequestUsecase
}

func newRespondTransferRequestSUT(t *testing.T) *respondTransferRequestSUT {
	t.Helper()
	repo := usecase.NewMockTransferRequestRepository(t)
	clock := usecase.NewMockClock(t)
	return &respondTransferRequestSUT{
		repo:  repo,
		clock: clock,
		uc:    usecase.NewRespondTransferRequest(repo, clock),
	}
}

func TestRespondTransferRequest_Confirm(t *testing.T) {
	sut := newRespondTransferRequestSUT(t)
	staffID := uuid.New()
	now := time.Date(2026, 5, 16, 12, 0, 0, 0, time.UTC)

	sut.clock.EXPECT().Now().Return(now).Once()
	sut.repo.EXPECT().Confirm(context.Background(), int64(7), staffID, now).Return(nil).Once()

	out, err := sut.uc.Execute(context.Background(), usecase.RespondTransferRequestInput{
		TransferID:       7,
		Action:           usecase.RespondActionConfirm,
		RecipientStaffID: staffID,
	})

	require.NoError(t, err)
	require.NotNil(t, out)
	assert.Equal(t, entity.TransferStatusConfirmed, out.Status)
}

func TestRespondTransferRequest_Reject(t *testing.T) {
	sut := newRespondTransferRequestSUT(t)
	staffID := uuid.New()
	now := time.Date(2026, 5, 16, 12, 0, 0, 0, time.UTC)

	sut.clock.EXPECT().Now().Return(now).Once()
	sut.repo.EXPECT().Reject(context.Background(), int64(7), staffID, now).Return(nil).Once()

	out, err := sut.uc.Execute(context.Background(), usecase.RespondTransferRequestInput{
		TransferID:       7,
		Action:           usecase.RespondActionReject,
		RecipientStaffID: staffID,
	})

	require.NoError(t, err)
	require.NotNil(t, out)
	assert.Equal(t, entity.TransferStatusRejected, out.Status)
}

func TestRespondTransferRequest_UnknownAction(t *testing.T) {
	sut := newRespondTransferRequestSUT(t)

	out, err := sut.uc.Execute(context.Background(), usecase.RespondTransferRequestInput{
		TransferID:       7,
		Action:           usecase.RespondActionUnknown,
		RecipientStaffID: uuid.New(),
	})

	assert.ErrorIs(t, err, entity.ErrTransferAlreadyResponded)
	assert.Nil(t, out)
}

func TestRespondTransferRequest_RepoConfirmRejectsAlreadyResponded(t *testing.T) {
	sut := newRespondTransferRequestSUT(t)
	now := time.Now().UTC()
	staffID := uuid.New()

	sut.clock.EXPECT().Now().Return(now).Once()
	sut.repo.EXPECT().Confirm(context.Background(), int64(7), staffID, now).
		Return(entity.ErrTransferAlreadyResponded).Once()

	out, err := sut.uc.Execute(context.Background(), usecase.RespondTransferRequestInput{
		TransferID:       7,
		Action:           usecase.RespondActionConfirm,
		RecipientStaffID: staffID,
	})

	assert.ErrorIs(t, err, entity.ErrTransferAlreadyResponded)
	assert.Nil(t, out)
}

func TestRespondTransferRequest_RepoConfirmNotFound(t *testing.T) {
	sut := newRespondTransferRequestSUT(t)
	now := time.Now().UTC()
	staffID := uuid.New()

	sut.clock.EXPECT().Now().Return(now).Once()
	sut.repo.EXPECT().Confirm(context.Background(), int64(7), staffID, now).
		Return(entity.ErrTransferNotFound).Once()

	out, err := sut.uc.Execute(context.Background(), usecase.RespondTransferRequestInput{
		TransferID:       7,
		Action:           usecase.RespondActionConfirm,
		RecipientStaffID: staffID,
	})

	assert.ErrorIs(t, err, entity.ErrTransferNotFound)
	assert.Nil(t, out)
}
