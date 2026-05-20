package usecase

import (
	"context"

	"github.com/hansenhalim/dgb/api/internal/entity"
)

type DestinationRepository interface {
	ListAll(ctx context.Context) ([]entity.Destination, error)
}
