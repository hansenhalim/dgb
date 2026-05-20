package tx

import (
	"context"

	"gorm.io/gorm"
)

type ctxKey struct{}

// GormRunner adapts gorm.DB to a usecase-level TxRunner port. Inside Run, the
// tx-scoped *gorm.DB is stashed in ctx; repositories that route their queries
// through DB(ctx, r.db) pick it up automatically.
type GormRunner struct {
	db *gorm.DB
}

func NewGorm(db *gorm.DB) *GormRunner {
	return &GormRunner{db: db}
}

func (r *GormRunner) Run(ctx context.Context, fn func(ctx context.Context) error) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return fn(context.WithValue(ctx, ctxKey{}, tx))
	})
}

// DB returns the tx-scoped *gorm.DB if one was stashed on ctx by GormRunner,
// otherwise def. Repositories call this so a single method body works both
// inside and outside a transaction.
func DB(ctx context.Context, def *gorm.DB) *gorm.DB {
	if t, ok := ctx.Value(ctxKey{}).(*gorm.DB); ok && t != nil {
		return t.WithContext(ctx)
	}
	return def.WithContext(ctx)
}
