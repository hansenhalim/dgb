package usecase

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/hansenhalim/dgb/api/internal/entity"
)

type Clock interface {
	Now() time.Time
}

type GateRepository interface {
	FindByID(ctx context.Context, id int16) (*entity.Gate, error)
}

type TransferRequestRepository interface {
	FindPendingByGateID(ctx context.Context, gateID int16) (*entity.TransferRequest, error)
	ExistsPendingForGates(ctx context.Context, fromGateID, toGateID int16) (bool, error)
	Create(ctx context.Context, t *entity.TransferRequest) error
	FindByID(ctx context.Context, id int64) (*entity.TransferRequest, error)
	Confirm(ctx context.Context, id int64, recipientStaffID uuid.UUID, respondedAt time.Time) error
	Reject(ctx context.Context, id int64, recipientStaffID uuid.UUID, respondedAt time.Time) error
}
