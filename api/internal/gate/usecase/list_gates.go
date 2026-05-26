package usecase

import (
	"context"
)

type ListGatesItem struct {
	ID          int16
	Name        string
	IsAvailable bool
}

type ListGatesOutput struct {
	Items []ListGatesItem
}

type ListGatesUsecase interface {
	Execute(ctx context.Context) (*ListGatesOutput, error)
}

type listGates struct {
	repo         GateRepository
	availability GateAvailabilityChecker
}

func NewListGates(repo GateRepository, availability GateAvailabilityChecker) ListGatesUsecase {
	return &listGates{repo: repo, availability: availability}
}

func (u *listGates) Execute(ctx context.Context) (*ListGatesOutput, error) {
	gates, err := u.repo.ListAll(ctx)
	if err != nil {
		return nil, err
	}

	items := make([]ListGatesItem, len(gates))
	for i, g := range gates {
		items[i] = ListGatesItem{
			ID:          g.ID,
			Name:        g.Name,
			IsAvailable: u.availability.IsAvailable(g.ID),
		}
	}
	return &ListGatesOutput{Items: items}, nil
}
