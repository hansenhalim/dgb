package usecase

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"github.com/hansenhalim/dgb/api/internal/entity"
)

type CreateTransferRequestInput struct {
	FromGateID    int16
	ToGateID      int16
	Amount        int16
	SenderStaffID uuid.UUID
}

type CreateTransferRequestUsecase interface {
	Execute(ctx context.Context, in CreateTransferRequestInput) error
}

type createTransferRequest struct {
	repo     TransferRequestRepository
	gateRepo GateRepository
}

func NewCreateTransferRequest(
	repo TransferRequestRepository,
	gateRepo GateRepository,
) CreateTransferRequestUsecase {
	return &createTransferRequest{repo: repo, gateRepo: gateRepo}
}

func (u *createTransferRequest) Execute(ctx context.Context, in CreateTransferRequestInput) error {
	fromGate, err := u.gateRepo.FindByID(ctx, in.FromGateID)
	if err != nil {
		if errors.Is(err, entity.ErrGateNotFound) {
			return entity.ErrInvalidTransferGates
		}
		return err
	}
	if fromGate.CurrentQuota < in.Amount {
		return entity.ErrInsufficientQuota
	}

	if _, err := u.gateRepo.FindByID(ctx, in.ToGateID); err != nil {
		if errors.Is(err, entity.ErrGateNotFound) {
			return entity.ErrInvalidTransferGates
		}
		return err
	}

	return u.repo.Create(ctx, &entity.TransferRequest{
		Status:        entity.TransferStatusPending,
		FromGateID:    in.FromGateID,
		ToGateID:      in.ToGateID,
		SenderStaffID: in.SenderStaffID,
		Amount:        in.Amount,
	})
}
