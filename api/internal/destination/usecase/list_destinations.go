package usecase

import (
	"context"

	"github.com/hansenhalim/dgb/api/internal/entity"
)

type ListDestinationsUsecase interface {
	Execute(ctx context.Context) ([]entity.Destination, error)
}

type listDestinations struct {
	repo DestinationRepository
}

func NewListDestinations(repo DestinationRepository) ListDestinationsUsecase {
	return &listDestinations{repo: repo}
}

func (u *listDestinations) Execute(ctx context.Context) ([]entity.Destination, error) {
	return u.repo.ListAll(ctx)
}
