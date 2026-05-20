package usecase_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/hansenhalim/dgb/api/internal/entity"
	"github.com/hansenhalim/dgb/api/internal/visitor/usecase"
)

type getVisitorStatusSUT struct {
	visitorRepo *usecase.MockVisitorRepository
	visitRepo   *usecase.MockVisitRepository
	digester    *usecase.MockDigester
	uc          usecase.GetVisitorStatusUsecase
}

func newGetVisitorStatusSUT(t *testing.T) *getVisitorStatusSUT {
	t.Helper()
	visitorRepo := usecase.NewMockVisitorRepository(t)
	visitRepo := usecase.NewMockVisitRepository(t)
	digester := usecase.NewMockDigester(t)
	return &getVisitorStatusSUT{
		visitorRepo: visitorRepo,
		visitRepo:   visitRepo,
		digester:    digester,
		uc:          usecase.NewGetVisitorStatus(visitorRepo, visitRepo, digester),
	}
}

func TestGetVisitorStatus_FoundWithLatestVisit(t *testing.T) {
	sut := newGetVisitorStatusSUT(t)

	visitorID := uuid.New()
	bannedAt := time.Date(2024, 10, 1, 14, 0, 0, 0, time.UTC)
	reason := "Violation of guest rules"
	visitor := &entity.Visitor{
		ID:           visitorID,
		Fullname:     "JOKUL DOE",
		BannedAt:     &bannedAt,
		BannedReason: &reason,
	}
	latest := &entity.Visit{
		ID:                 uuid.New(),
		VehiclePlateNumber: "BE 1199 AA",
		PurposeOfVisit:     "Service AC",
		DestinationName:    "AA-1",
		CreatedAt:          time.Now(),
	}

	sut.digester.EXPECT().SHA256Hex([]byte("3174020101700001")).Return("hashed").Once()
	sut.visitorRepo.EXPECT().FindByIdentityHash(context.Background(), "hashed").Return(visitor, nil).Once()
	sut.visitRepo.EXPECT().FindLatestByVisitor(context.Background(), visitorID).Return(latest, nil).Once()

	out, err := sut.uc.Execute(context.Background(), "3174020101700001")

	require.NoError(t, err)
	require.NotNil(t, out)
	assert.Equal(t, *visitor, out.Visitor)
	assert.Equal(t, latest, out.LatestVisit)
}

func TestGetVisitorStatus_FoundNoVisits(t *testing.T) {
	sut := newGetVisitorStatusSUT(t)

	visitorID := uuid.New()
	visitor := &entity.Visitor{ID: visitorID, Fullname: "JOKUL DOE"}

	sut.digester.EXPECT().SHA256Hex([]byte("x")).Return("hashed").Once()
	sut.visitorRepo.EXPECT().FindByIdentityHash(context.Background(), "hashed").Return(visitor, nil).Once()
	sut.visitRepo.EXPECT().FindLatestByVisitor(context.Background(), visitorID).Return(nil, nil).Once()

	out, err := sut.uc.Execute(context.Background(), "x")

	require.NoError(t, err)
	require.NotNil(t, out)
	assert.Equal(t, *visitor, out.Visitor)
	assert.Nil(t, out.LatestVisit)
}

func TestGetVisitorStatus_VisitorNotFound(t *testing.T) {
	sut := newGetVisitorStatusSUT(t)

	sut.digester.EXPECT().SHA256Hex([]byte("x")).Return("hashed").Once()
	sut.visitorRepo.EXPECT().FindByIdentityHash(context.Background(), "hashed").Return(nil, nil).Once()

	out, err := sut.uc.Execute(context.Background(), "x")

	require.NoError(t, err)
	assert.Nil(t, out)
}

func TestGetVisitorStatus_VisitorRepoError(t *testing.T) {
	sut := newGetVisitorStatusSUT(t)
	dbErr := errors.New("db down")
	sut.digester.EXPECT().SHA256Hex([]byte("x")).Return("hashed").Once()
	sut.visitorRepo.EXPECT().FindByIdentityHash(context.Background(), "hashed").Return(nil, dbErr).Once()

	out, err := sut.uc.Execute(context.Background(), "x")

	assert.ErrorIs(t, err, dbErr)
	assert.Nil(t, out)
}

func TestGetVisitorStatus_VisitRepoError(t *testing.T) {
	sut := newGetVisitorStatusSUT(t)
	visitorID := uuid.New()
	dbErr := errors.New("visits down")
	sut.digester.EXPECT().SHA256Hex([]byte("x")).Return("hashed").Once()
	sut.visitorRepo.EXPECT().FindByIdentityHash(context.Background(), "hashed").
		Return(&entity.Visitor{ID: visitorID}, nil).Once()
	sut.visitRepo.EXPECT().FindLatestByVisitor(context.Background(), visitorID).Return(nil, dbErr).Once()

	out, err := sut.uc.Execute(context.Background(), "x")

	assert.ErrorIs(t, err, dbErr)
	assert.Nil(t, out)
}
