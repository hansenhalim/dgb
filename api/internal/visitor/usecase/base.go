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

type Digester interface {
	SHA256Hex(data []byte) string
}

// Encryptor wraps a plaintext payload into the same envelope format Laravel's
// `Crypt::encryptString` produces, so rows written here can later be decrypted
// by either side using the shared APP_KEY.
type Encryptor interface {
	Encrypt(plaintext []byte) ([]byte, error)
}

type RfidRepository interface {
	FindByUID(ctx context.Context, uid []byte) (*entity.Rfid, error)
	// AssociateVisit re-points the RFID row at a visit (sets
	// rfidable_type='App\Models\Visit', rfidable_id=visitID).
	AssociateVisit(ctx context.Context, rfidID uint16, visitID uuid.UUID) error
	// ReleaseByVisit nulls the rfidable pointer on whichever RFID row is
	// currently associated with the visit, freeing the card for reuse. Called
	// on checkout; the inverse of AssociateVisit.
	ReleaseByVisit(ctx context.Context, visitID uuid.UUID) error
}

type GateRepository interface {
	AdjustQuota(ctx context.Context, gateID int16, delta int16) error
}

// TxRunner lets a usecase wrap several repository writes in a single atomic
// transaction. The implementation is responsible for stashing whatever
// transactional handle the repositories need on the ctx it passes to fn.
type TxRunner interface {
	Run(ctx context.Context, fn func(ctx context.Context) error) error
}

type VisitRepository interface {
	// FindLatestByVisitor returns nil, nil when the visitor has no visits.
	FindLatestByVisitor(ctx context.Context, visitorID uuid.UUID) (*entity.Visit, error)
	// FindByID returns entity.ErrVisitNotFound when no row matches id.
	FindByID(ctx context.Context, id uuid.UUID) (*entity.Visit, error)
	// Create inserts a new visit and populates v.ID, v.CreatedAt, v.UpdatedAt.
	Create(ctx context.Context, v *entity.Visit) error
	// UpdateState writes the new current_position (and, when non-nil, checkout
	// columns) and returns the post-state row. Returns entity.ErrVisitNotFound
	// when no row matches id.
	UpdateState(ctx context.Context, id uuid.UUID, pos entity.CurrentPosition, checkoutAt *time.Time, checkoutGateID *int16) (*entity.Visit, error)
	// ListByGate returns the 50 most recent visits touching the gate (either
	// checkin_gate_id or checkout_gate_id matches), ordered by created_at DESC.
	ListByGate(ctx context.Context, gateID int16) ([]entity.Visit, error)
}

type VisitorRepository interface {
	// FindByIdentityHash returns nil, nil when no visitor row matches the hash.
	FindByIdentityHash(ctx context.Context, identityHashHex string) (*entity.Visitor, error)
	// UpsertByIdentityHash inserts a new visitor or updates the existing one's
	// fullname. Mirrors Laravel's `Visitor::updateOrCreate`.
	UpsertByIdentityHash(ctx context.Context, identityHashHex, fullname string) (*entity.Visitor, error)
	// MarkBanned sets banned_at / banned_reason on the visitor.
	MarkBanned(ctx context.Context, visitorID uuid.UUID, reason string, bannedAt time.Time) error
	// ClearBan nulls banned_at / banned_reason. Called on checkout.
	ClearBan(ctx context.Context, visitorID uuid.UUID) error
}
