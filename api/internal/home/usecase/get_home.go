package usecase

import "context"

type GetHomeInput struct {
	GateID int16
}

// GetHomeOutput shapes the raw repository counts into the dashboard fields
// rendered by the home screen. Every count is scoped to the input gate.
type GetHomeOutput struct {
	CardStockAvailable         int64
	CardStockTotal             int64
	VisitsActive               int64
	VisitsTotal                int64 // today's visit count at this gate (UTC day)
	HasIncomingTransferRequest bool
}

type GetHomeUsecase interface {
	Execute(ctx context.Context, in GetHomeInput) (*GetHomeOutput, error)
}

type getHome struct {
	repo  HomeRepository
	clock Clock
}

func NewGetHome(repo HomeRepository, clock Clock) GetHomeUsecase {
	return &getHome{repo: repo, clock: clock}
}

func (u *getHome) Execute(ctx context.Context, in GetHomeInput) (*GetHomeOutput, error) {
	counts, err := u.repo.Snapshot(ctx, in.GateID, u.clock.Now().UTC())
	if err != nil {
		return nil, err
	}
	quota := int64(counts.GateQuota)
	return &GetHomeOutput{
		CardStockAvailable:         quota,
		CardStockTotal:             quota + counts.ActiveVisits,
		VisitsActive:               counts.ActiveVisits,
		VisitsTotal:                counts.TodayVisits,
		HasIncomingTransferRequest: counts.HasIncomingTransferRequest,
	}, nil
}
