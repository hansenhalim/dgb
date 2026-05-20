package usecase

import (
	"context"

	"github.com/hansenhalim/dgb/api/internal/entity"
)

type VerifyPinInput struct {
	UID []byte
	PIN string
}

type VerifyPinOutput struct {
	RfidKey []byte
}

type VerifyPinUsecase interface {
	Execute(ctx context.Context, in VerifyPinInput) (*VerifyPinOutput, error)
}

type verifyPin struct {
	repo   RfidRepository
	hasher Hasher
}

func NewVerifyPin(repo RfidRepository, hasher Hasher) VerifyPinUsecase {
	return &verifyPin{repo: repo, hasher: hasher}
}

func (u *verifyPin) Execute(ctx context.Context, in VerifyPinInput) (*VerifyPinOutput, error) {
	rfid, err := u.repo.FindGuardByUID(ctx, in.UID)
	if err != nil {
		return nil, err
	}

	ok, err := u.hasher.Verify(rfid.PIN, in.PIN)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, entity.ErrInvalidPIN
	}

	return &VerifyPinOutput{RfidKey: rfid.Key}, nil
}
