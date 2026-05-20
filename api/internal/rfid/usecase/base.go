package usecase

import (
	"context"

	"github.com/hansenhalim/dgb/api/internal/entity"
)

type RfidRepository interface {
	FindByUID(ctx context.Context, uid []byte) (*entity.Rfid, error)
}
