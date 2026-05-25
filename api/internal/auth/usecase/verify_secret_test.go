package usecase_test

import (
	"context"
	"encoding/hex"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/hansenhalim/dgb/api/internal/auth/usecase"
	"github.com/hansenhalim/dgb/api/internal/entity"
)

type verifySecretSUT struct {
	rfidRepo *usecase.MockRfidRepository
	digester *usecase.MockDigester
	issuer   *usecase.MockTokenIssuer
	clock    *usecase.MockClock
	uc       usecase.VerifySecretUsecase
}

func newVerifySecretSUT(t *testing.T) *verifySecretSUT {
	t.Helper()
	rfidRepo := usecase.NewMockRfidRepository(t)
	digester := usecase.NewMockDigester(t)
	issuer := usecase.NewMockTokenIssuer(t)
	clock := usecase.NewMockClock(t)
	return &verifySecretSUT{
		rfidRepo: rfidRepo,
		digester: digester,
		issuer:   issuer,
		clock:    clock,
		uc:       usecase.NewVerifySecret(rfidRepo, digester, issuer, clock),
	}
}

func TestVerifySecret_Success(t *testing.T) {
	sut := newVerifySecretSUT(t)

	uid := []byte{0xDE, 0xAD, 0xBE, 0xEF}
	staffID := uuid.New()
	storedSecretHash := "stored-secret-hash"
	secretHex := strings.Repeat("AB", 512)
	secretBytes, _ := hex.DecodeString(secretHex)
	now := time.Date(2026, 5, 16, 12, 0, 0, 0, time.UTC)
	expectedExpiry := now.Add(12 * time.Hour)

	sut.rfidRepo.EXPECT().FindGuardByUID(context.Background(), uid).
		Return(&entity.Rfid{Staff: &entity.Staff{ID: staffID, Name: "Jokul Doe", SecretKey: storedSecretHash}}, nil).Once()
	sut.digester.EXPECT().SHA256Hex(secretBytes).Return(storedSecretHash).Once()
	sut.clock.EXPECT().Now().Return(now).Once()
	sut.issuer.EXPECT().Issue(staffID.String(), expectedExpiry).Return("signed.jwt.value", nil).Once()

	out, err := sut.uc.Execute(context.Background(), usecase.VerifySecretInput{
		UID:        uid,
		SecretKey:  secretHex,
		DeviceName: "Jokul's iPhone",
	})

	require.NoError(t, err)
	require.NotNil(t, out)
	assert.Equal(t, "signed.jwt.value", out.Token)
	assert.True(t, out.ValidUntil.Equal(expectedExpiry))
	assert.Equal(t, "Jokul Doe", out.GuardName)
}

func TestVerifySecret_RfidNotFound(t *testing.T) {
	sut := newVerifySecretSUT(t)

	uid := []byte{0xDE, 0xAD, 0xBE, 0xEF}
	sut.rfidRepo.EXPECT().FindGuardByUID(context.Background(), uid).Return(nil, entity.ErrRfidNotFound).Once()

	out, err := sut.uc.Execute(context.Background(), usecase.VerifySecretInput{
		UID:        uid,
		SecretKey:  strings.Repeat("00", 512),
		DeviceName: "device",
	})

	assert.ErrorIs(t, err, entity.ErrRfidNotFound)
	assert.Nil(t, out)
}

func TestVerifySecret_NonHexSecret(t *testing.T) {
	sut := newVerifySecretSUT(t)

	uid := []byte{0xDE, 0xAD, 0xBE, 0xEF}
	sut.rfidRepo.EXPECT().FindGuardByUID(context.Background(), uid).
		Return(&entity.Rfid{Staff: &entity.Staff{}}, nil).Once()

	out, err := sut.uc.Execute(context.Background(), usecase.VerifySecretInput{
		UID:        uid,
		SecretKey:  "not-hex",
		DeviceName: "device",
	})

	assert.ErrorIs(t, err, entity.ErrInvalidKey)
	assert.Nil(t, out)
}

func TestVerifySecret_HashMismatch(t *testing.T) {
	sut := newVerifySecretSUT(t)

	uid := []byte{0xDE, 0xAD, 0xBE, 0xEF}
	secretHex := strings.Repeat("AB", 512)
	secretBytes, _ := hex.DecodeString(secretHex)

	sut.rfidRepo.EXPECT().FindGuardByUID(context.Background(), uid).
		Return(&entity.Rfid{Staff: &entity.Staff{SecretKey: "stored"}}, nil).Once()
	sut.digester.EXPECT().SHA256Hex(secretBytes).Return("computed-different").Once()

	out, err := sut.uc.Execute(context.Background(), usecase.VerifySecretInput{
		UID:        uid,
		SecretKey:  secretHex,
		DeviceName: "device",
	})

	assert.ErrorIs(t, err, entity.ErrInvalidKey)
	assert.Nil(t, out)
}

func TestVerifySecret_IssuerError(t *testing.T) {
	sut := newVerifySecretSUT(t)

	uid := []byte{0xDE, 0xAD, 0xBE, 0xEF}
	staffID := uuid.New()
	secretHex := strings.Repeat("AB", 512)
	secretBytes, _ := hex.DecodeString(secretHex)
	now := time.Now().UTC()
	signErr := errors.New("sign failed")

	sut.rfidRepo.EXPECT().FindGuardByUID(context.Background(), uid).
		Return(&entity.Rfid{Staff: &entity.Staff{ID: staffID, SecretKey: "h"}}, nil).Once()
	sut.digester.EXPECT().SHA256Hex(secretBytes).Return("h").Once()
	sut.clock.EXPECT().Now().Return(now).Once()
	sut.issuer.EXPECT().Issue(staffID.String(), now.Add(12*time.Hour)).Return("", signErr).Once()

	out, err := sut.uc.Execute(context.Background(), usecase.VerifySecretInput{
		UID:        uid,
		SecretKey:  secretHex,
		DeviceName: "device",
	})

	assert.ErrorIs(t, err, signErr)
	assert.Nil(t, out)
}
