package usecase_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/hansenhalim/dgb/api/internal/entity"
	"github.com/hansenhalim/dgb/api/internal/transferrequest/usecase"
)

type createTransferRequestSUT struct {
	repo     *usecase.MockTransferRequestRepository
	gateRepo *usecase.MockGateRepository
	uc       usecase.CreateTransferRequestUsecase
}

func newCreateTransferRequestSUT(t *testing.T) *createTransferRequestSUT {
	t.Helper()
	repo := usecase.NewMockTransferRequestRepository(t)
	gateRepo := usecase.NewMockGateRepository(t)
	return &createTransferRequestSUT{
		repo:     repo,
		gateRepo: gateRepo,
		uc:       usecase.NewCreateTransferRequest(repo, gateRepo),
	}
}

func TestCreateTransferRequest_Success(t *testing.T) {
	sut := newCreateTransferRequestSUT(t)
	staffID := uuid.New()

	sut.gateRepo.EXPECT().FindByID(context.Background(), int16(2)).
		Return(&entity.Gate{ID: 2, CurrentQuota: 100}, nil).Once()
	sut.gateRepo.EXPECT().FindByID(context.Background(), int16(1)).
		Return(&entity.Gate{ID: 1, CurrentQuota: 50}, nil).Once()
	sut.repo.EXPECT().Create(context.Background(), mock.MatchedBy(func(t *entity.TransferRequest) bool {
		return t.Status == entity.TransferStatusPending &&
			t.FromGateID == 2 &&
			t.ToGateID == 1 &&
			t.Amount == 25 &&
			t.SenderStaffID == staffID
	})).Return(nil).Once()

	err := sut.uc.Execute(context.Background(), usecase.CreateTransferRequestInput{
		FromGateID: 2, ToGateID: 1, Amount: 25, SenderStaffID: staffID,
	})

	require.NoError(t, err)
}

func TestCreateTransferRequest_UnknownFromGate(t *testing.T) {
	sut := newCreateTransferRequestSUT(t)
	sut.gateRepo.EXPECT().FindByID(context.Background(), int16(2)).Return(nil, entity.ErrGateNotFound).Once()

	err := sut.uc.Execute(context.Background(), usecase.CreateTransferRequestInput{
		FromGateID: 2, ToGateID: 1, Amount: 25, SenderStaffID: uuid.New(),
	})

	assert.ErrorIs(t, err, entity.ErrInvalidTransferGates)
}

func TestCreateTransferRequest_InsufficientQuota(t *testing.T) {
	sut := newCreateTransferRequestSUT(t)
	sut.gateRepo.EXPECT().FindByID(context.Background(), int16(2)).
		Return(&entity.Gate{ID: 2, CurrentQuota: 10}, nil).Once()

	err := sut.uc.Execute(context.Background(), usecase.CreateTransferRequestInput{
		FromGateID: 2, ToGateID: 1, Amount: 25, SenderStaffID: uuid.New(),
	})

	assert.ErrorIs(t, err, entity.ErrInsufficientQuota)
}

func TestCreateTransferRequest_UnknownToGate(t *testing.T) {
	sut := newCreateTransferRequestSUT(t)
	sut.gateRepo.EXPECT().FindByID(context.Background(), int16(2)).
		Return(&entity.Gate{ID: 2, CurrentQuota: 100}, nil).Once()
	sut.gateRepo.EXPECT().FindByID(context.Background(), int16(1)).
		Return(nil, entity.ErrGateNotFound).Once()

	err := sut.uc.Execute(context.Background(), usecase.CreateTransferRequestInput{
		FromGateID: 2, ToGateID: 1, Amount: 25, SenderStaffID: uuid.New(),
	})

	assert.ErrorIs(t, err, entity.ErrInvalidTransferGates)
}

func TestCreateTransferRequest_RepoCreateError(t *testing.T) {
	sut := newCreateTransferRequestSUT(t)
	dbErr := errors.New("db down")
	sut.gateRepo.EXPECT().FindByID(context.Background(), int16(2)).
		Return(&entity.Gate{ID: 2, CurrentQuota: 100}, nil).Once()
	sut.gateRepo.EXPECT().FindByID(context.Background(), int16(1)).
		Return(&entity.Gate{ID: 1}, nil).Once()
	sut.repo.EXPECT().Create(context.Background(), mock.Anything).Return(dbErr).Once()

	err := sut.uc.Execute(context.Background(), usecase.CreateTransferRequestInput{
		FromGateID: 2, ToGateID: 1, Amount: 25, SenderStaffID: uuid.New(),
	})

	assert.ErrorIs(t, err, dbErr)
}
