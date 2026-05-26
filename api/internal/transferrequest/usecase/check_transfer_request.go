package usecase

import (
	"context"

	"github.com/hansenhalim/dgb/api/internal/entity"
)

type CheckTransferRequestUsecase interface {
	Execute(ctx context.Context, gateID int16) ([]*entity.TransferRequest, error)
}

type checkTransferRequest struct {
	repo TransferRequestRepository
}

func NewCheckTransferRequest(repo TransferRequestRepository) CheckTransferRequestUsecase {
	return &checkTransferRequest{repo: repo}
}

func (u *checkTransferRequest) Execute(ctx context.Context, gateID int16) ([]*entity.TransferRequest, error) {
	return u.repo.FindAllPendingByGateID(ctx, gateID)
}
