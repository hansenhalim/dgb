package usecase_test

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/hansenhalim/dgb/api/internal/auth/usecase"
	"github.com/hansenhalim/dgb/api/internal/entity"
)

type verifyPinSUT struct {
	repo   *usecase.MockRfidRepository
	hasher *usecase.MockHasher
	uc     usecase.VerifyPinUsecase
}

func newVerifyPinSUT(t *testing.T) *verifyPinSUT {
	t.Helper()
	repo := usecase.NewMockRfidRepository(t)
	hasher := usecase.NewMockHasher(t)
	return &verifyPinSUT{
		repo:   repo,
		hasher: hasher,
		uc:     usecase.NewVerifyPin(repo, hasher),
	}
}

func TestVerifyPin_Success(t *testing.T) {
	sut := newVerifyPinSUT(t)

	uid := []byte{0xDE, 0xAD, 0xBE, 0xEF}
	key := []byte{0xC0, 0xFF, 0xEE}
	rfid := &entity.Rfid{
		PIN: "$2y$10$hashvalue",
		Key: key,
	}

	sut.repo.EXPECT().FindGuardByUID(context.Background(), uid).Return(rfid, nil).Once()
	sut.hasher.EXPECT().Verify("$2y$10$hashvalue", "123456").Return(true, nil).Once()

	out, err := sut.uc.Execute(context.Background(), usecase.VerifyPinInput{UID: uid, PIN: "123456"})

	require.NoError(t, err)
	require.NotNil(t, out)
	assert.Equal(t, key, out.RfidKey)
}

func TestVerifyPin_RfidNotFound(t *testing.T) {
	sut := newVerifyPinSUT(t)

	uid := []byte{0xDE, 0xAD, 0xBE, 0xEF}
	sut.repo.EXPECT().FindGuardByUID(context.Background(), uid).Return(nil, entity.ErrRfidNotFound).Once()

	out, err := sut.uc.Execute(context.Background(), usecase.VerifyPinInput{UID: uid, PIN: "123456"})

	assert.ErrorIs(t, err, entity.ErrRfidNotFound)
	assert.Nil(t, out)
}

func TestVerifyPin_InvalidPIN(t *testing.T) {
	sut := newVerifyPinSUT(t)

	uid := []byte{0xDE, 0xAD, 0xBE, 0xEF}
	rfid := &entity.Rfid{
		PIN: "$2y$10$hashvalue",
		Key: []byte{0xC0, 0xFF, 0xEE},
	}

	sut.repo.EXPECT().FindGuardByUID(context.Background(), uid).Return(rfid, nil).Once()
	sut.hasher.EXPECT().Verify("$2y$10$hashvalue", "999999").Return(false, nil).Once()

	out, err := sut.uc.Execute(context.Background(), usecase.VerifyPinInput{UID: uid, PIN: "999999"})

	assert.ErrorIs(t, err, entity.ErrInvalidPIN)
	assert.Nil(t, out)
}

func TestVerifyPin_RepositoryError(t *testing.T) {
	sut := newVerifyPinSUT(t)

	uid := []byte{0xDE, 0xAD, 0xBE, 0xEF}
	dbErr := errors.New("db is down")
	sut.repo.EXPECT().FindGuardByUID(context.Background(), uid).Return(nil, dbErr).Once()

	out, err := sut.uc.Execute(context.Background(), usecase.VerifyPinInput{UID: uid, PIN: "123456"})

	assert.ErrorIs(t, err, dbErr)
	assert.Nil(t, out)
}

func TestVerifyPin_HasherError(t *testing.T) {
	sut := newVerifyPinSUT(t)

	uid := []byte{0xDE, 0xAD, 0xBE, 0xEF}
	rfid := &entity.Rfid{PIN: "broken-hash"}
	hashErr := errors.New("malformed hash")

	sut.repo.EXPECT().FindGuardByUID(context.Background(), uid).Return(rfid, nil).Once()
	sut.hasher.EXPECT().Verify("broken-hash", "123456").Return(false, hashErr).Once()

	out, err := sut.uc.Execute(context.Background(), usecase.VerifyPinInput{UID: uid, PIN: "123456"})

	assert.ErrorIs(t, err, hashErr)
	assert.Nil(t, out)
}
