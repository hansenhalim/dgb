package usecase

import (
	"context"

	"github.com/google/uuid"

	"github.com/hansenhalim/dgb/api/internal/entity"
)

type RespondAction int

const (
	RespondActionUnknown RespondAction = iota
	RespondActionConfirm
	RespondActionReject
)

type RespondTransferRequestInput struct {
	TransferID       int64
	Action           RespondAction
	RecipientStaffID uuid.UUID
}

type RespondTransferRequestOutput struct {
	Status entity.TransferStatus
}

type RespondTransferRequestUsecase interface {
	Execute(ctx context.Context, in RespondTransferRequestInput) (*RespondTransferRequestOutput, error)
}

type respondTransferRequest struct {
	repo  TransferRequestRepository
	clock Clock
}

func NewRespondTransferRequest(
	repo TransferRequestRepository,
	clock Clock,
) RespondTransferRequestUsecase {
	return &respondTransferRequest{repo: repo, clock: clock}
}

func (u *respondTransferRequest) Execute(ctx context.Context, in RespondTransferRequestInput) (*RespondTransferRequestOutput, error) {
	if in.Action != RespondActionConfirm && in.Action != RespondActionReject {
		return nil, entity.ErrTransferAlreadyResponded
	}

	now := u.clock.Now().UTC()

	switch in.Action {
	case RespondActionConfirm:
		if err := u.repo.Confirm(ctx, in.TransferID, in.RecipientStaffID, now); err != nil {
			return nil, err
		}
		return &RespondTransferRequestOutput{Status: entity.TransferStatusConfirmed}, nil
	case RespondActionReject:
		if err := u.repo.Reject(ctx, in.TransferID, in.RecipientStaffID, now); err != nil {
			return nil, err
		}
		return &RespondTransferRequestOutput{Status: entity.TransferStatusRejected}, nil
	}
	return nil, entity.ErrTransferAlreadyResponded
}
