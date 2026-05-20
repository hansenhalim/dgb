package usecase_test

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/hansenhalim/dgb/api/internal/entity"
	"github.com/hansenhalim/dgb/api/internal/rfid/usecase"
)

type getRfidKeySUT struct {
	repo *usecase.MockRfidRepository
	uc   usecase.GetRfidKeyUsecase
}

func newGetRfidKeySUT(t *testing.T) *getRfidKeySUT {
	t.Helper()
	repo := usecase.NewMockRfidRepository(t)
	return &getRfidKeySUT{repo: repo, uc: usecase.NewGetRfidKey(repo)}
}

func TestGetRfidKey_VisitCardReturnsKey(t *testing.T) {
	sut := newGetRfidKeySUT(t)

	uid := []byte{0xDE, 0xAD, 0xC0, 0xDE}
	key := []byte{0xC0, 0xFF, 0xEE}

	sut.repo.EXPECT().FindByUID(context.Background(), uid).
		Return(&entity.Rfid{Key: key, RfidableType: entity.RfidableVisit}, nil).Once()

	out, err := sut.uc.Execute(context.Background(), uid)

	require.NoError(t, err)
	require.NotNil(t, out)
	assert.Equal(t, key, out.Key)
}

func TestGetRfidKey_NotFound(t *testing.T) {
	sut := newGetRfidKeySUT(t)
	uid := []byte{0xDE, 0xAD, 0xC0, 0xDE}

	sut.repo.EXPECT().FindByUID(context.Background(), uid).Return(nil, entity.ErrRfidNotFound).Once()

	out, err := sut.uc.Execute(context.Background(), uid)

	assert.ErrorIs(t, err, entity.ErrRfidNotFound)
	assert.Nil(t, out)
}

func TestGetRfidKey_StaffCardRejected(t *testing.T) {
	sut := newGetRfidKeySUT(t)
	uid := []byte{0xDE, 0xAD, 0xC0, 0xDE}

	sut.repo.EXPECT().FindByUID(context.Background(), uid).
		Return(&entity.Rfid{Key: []byte{0xAA}, RfidableType: entity.RfidableStaff}, nil).Once()

	out, err := sut.uc.Execute(context.Background(), uid)

	assert.ErrorIs(t, err, entity.ErrRfidNotFound)
	assert.Nil(t, out)
}

func TestGetRfidKey_RepoError(t *testing.T) {
	sut := newGetRfidKeySUT(t)
	uid := []byte{0xDE, 0xAD, 0xC0, 0xDE}
	dbErr := errors.New("db down")

	sut.repo.EXPECT().FindByUID(context.Background(), uid).Return(nil, dbErr).Once()

	out, err := sut.uc.Execute(context.Background(), uid)

	assert.ErrorIs(t, err, dbErr)
	assert.Nil(t, out)
}
