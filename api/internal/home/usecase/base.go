package usecase

import (
	"context"
	"time"

	"github.com/hansenhalim/dgb/api/internal/home/repository"
)

type HomeRepository interface {
	Snapshot(ctx context.Context, nowUTC time.Time) (*repository.SnapshotCounts, error)
}

type Clock interface {
	Now() time.Time
}
