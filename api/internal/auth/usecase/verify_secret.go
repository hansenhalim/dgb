package usecase

import (
	"context"
	"encoding/hex"
	"time"

	"github.com/hansenhalim/dgb/api/internal/entity"
)

const tokenTTL = 12 * time.Hour

type VerifySecretInput struct {
	UID        []byte
	SecretKey  string
	DeviceName string
}

type VerifySecretOutput struct {
	Token      string
	ValidUntil time.Time
	GuardName  string
}

type VerifySecretUsecase interface {
	Execute(ctx context.Context, in VerifySecretInput) (*VerifySecretOutput, error)
}

type verifySecret struct {
	rfidRepo RfidRepository
	digester Digester
	issuer   TokenIssuer
	clock    Clock
}

func NewVerifySecret(
	rfidRepo RfidRepository,
	digester Digester,
	issuer TokenIssuer,
	clock Clock,
) VerifySecretUsecase {
	return &verifySecret{
		rfidRepo: rfidRepo,
		digester: digester,
		issuer:   issuer,
		clock:    clock,
	}
}

func (u *verifySecret) Execute(ctx context.Context, in VerifySecretInput) (*VerifySecretOutput, error) {
	rfid, err := u.rfidRepo.FindGuardByUID(ctx, in.UID)
	if err != nil {
		return nil, err
	}

	secretBytes, err := hex.DecodeString(in.SecretKey)
	if err != nil {
		return nil, entity.ErrInvalidKey
	}
	if u.digester.SHA256Hex(secretBytes) != rfid.Staff.SecretKey {
		return nil, entity.ErrInvalidKey
	}

	expires := u.clock.Now().UTC().Add(tokenTTL)
	token, err := u.issuer.Issue(rfid.Staff.ID.String(), expires)
	if err != nil {
		return nil, err
	}

	return &VerifySecretOutput{
		Token:      token,
		ValidUntil: expires,
		GuardName:  rfid.Staff.Name,
	}, nil
}
