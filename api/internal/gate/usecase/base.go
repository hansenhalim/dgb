package usecase

import (
	"context"

	"github.com/hansenhalim/dgb/api/internal/entity"
)

type GateAvailabilityChecker interface {
	IsAvailable(gateID int16) bool
}

type GateRepository interface {
	ListAll(ctx context.Context) ([]entity.Gate, error)
	FindByID(ctx context.Context, id int16) (*entity.Gate, error)
}
