package usecase

import (
	"context"

	"github.com/hansenhalim/dgb/api/internal/entity"
)

type GetRfidKeyOutput struct {
	Key []byte
}

type GetRfidKeyUsecase interface {
	Execute(ctx context.Context, uid []byte) (*GetRfidKeyOutput, error)
}

type getRfidKey struct {
	repo RfidRepository
}

func NewGetRfidKey(repo RfidRepository) GetRfidKeyUsecase {
	return &getRfidKey{repo: repo}
}

func (u *getRfidKey) Execute(ctx context.Context, uid []byte) (*GetRfidKeyOutput, error) {
	rfid, err := u.repo.FindByUID(ctx, uid)
	if err != nil {
		return nil, err
	}
	if rfid.RfidableType == entity.RfidableStaff {
		return nil, entity.ErrRfidNotFound
	}
	return &GetRfidKeyOutput{Key: rfid.Key}, nil
}
