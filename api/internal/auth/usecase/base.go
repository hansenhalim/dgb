package usecase

import (
	"context"
	"time"

	"github.com/hansenhalim/dgb/api/internal/entity"
)

type Clock interface {
	Now() time.Time
}

type Digester interface {
	SHA256Hex(data []byte) string
}

type Hasher interface {
	Verify(hashed, plaintext string) (bool, error)
}

type RfidRepository interface {
	FindGuardByUID(ctx context.Context, uid []byte) (*entity.Rfid, error)
}

type TokenIssuer interface {
	Issue(subject string, expiresAt time.Time) (string, error)
}
