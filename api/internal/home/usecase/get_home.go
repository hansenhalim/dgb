package usecase

import "context"

// GetHomeOutput shapes the raw repository counts into the dashboard fields
// rendered by the home screen. Card stock is split into `Available` (free
// across all gates, sum of gates.current_quota) and `Total` (Available plus
// any cards currently issued to active visits — checkout_at IS NULL).
type GetHomeOutput struct {
	CardStockAvailable int64
	CardStockTotal     int64
	VisitsActive       int64
	VisitsTotal        int64 // today's visit count (UTC day)
}

type GetHomeUsecase interface {
	Execute(ctx context.Context) (*GetHomeOutput, error)
}

type getHome struct {
	repo  HomeRepository
	clock Clock
}

func NewGetHome(repo HomeRepository, clock Clock) GetHomeUsecase {
	return &getHome{repo: repo, clock: clock}
}

func (u *getHome) Execute(ctx context.Context) (*GetHomeOutput, error) {
	counts, err := u.repo.Snapshot(ctx, u.clock.Now().UTC())
	if err != nil {
		return nil, err
	}
	return &GetHomeOutput{
		CardStockAvailable: counts.GateQuotaSum,
		CardStockTotal:     counts.GateQuotaSum + counts.ActiveVisits,
		VisitsActive:       counts.ActiveVisits,
		VisitsTotal:        counts.TodayVisits,
	}, nil
}
