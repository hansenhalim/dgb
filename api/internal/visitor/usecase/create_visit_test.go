package usecase_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/hansenhalim/dgb/api/internal/entity"
	"github.com/hansenhalim/dgb/api/internal/visitor/usecase"
)

type createVisitSUT struct {
	rfidRepo    *usecase.MockRfidRepository
	visitorRepo *usecase.MockVisitorRepository
	visitRepo   *usecase.MockVisitRepository
	gateRepo    *usecase.MockGateRepository
	digester    *usecase.MockDigester
	encryptor   *usecase.MockEncryptor
	clock       *usecase.MockClock
	tx          *usecase.MockTxRunner
	uc          usecase.CreateVisitUsecase
}

func newCreateVisitSUT(t *testing.T) *createVisitSUT {
	t.Helper()
	rfidRepo := usecase.NewMockRfidRepository(t)
	visitorRepo := usecase.NewMockVisitorRepository(t)
	visitRepo := usecase.NewMockVisitRepository(t)
	gateRepo := usecase.NewMockGateRepository(t)
	digester := usecase.NewMockDigester(t)
	encryptor := usecase.NewMockEncryptor(t)
	clock := usecase.NewMockClock(t)
	tx := usecase.NewMockTxRunner(t)
	return &createVisitSUT{
		rfidRepo:    rfidRepo,
		visitorRepo: visitorRepo,
		visitRepo:   visitRepo,
		gateRepo:    gateRepo,
		digester:    digester,
		encryptor:   encryptor,
		clock:       clock,
		tx:          tx,
		uc:          usecase.NewCreateVisit(rfidRepo, visitorRepo, visitRepo, gateRepo, digester, encryptor, clock, tx),
	}
}

// expectPassthroughTx sets up the TxRunner mock to invoke fn(ctx) and return
// fn's result, simulating a successful tx that commits whatever the inner
// function returned.
func (s *createVisitSUT) expectPassthroughTx() {
	s.tx.EXPECT().Run(mock.Anything, mock.Anything).
		RunAndReturn(func(ctx context.Context, fn func(context.Context) error) error {
			return fn(ctx)
		}).Once()
}

func validInput() usecase.CreateVisitInput {
	return usecase.CreateVisitInput{
		UID:                []byte{0xCD, 0x45, 0x78, 0xF3},
		IdentityPhoto:      []byte("photo-bytes"),
		IdentityNumber:     "3174020101700001",
		Fullname:           "JOKUL DOE",
		VehiclePlateNumber: "BE 1199 AA",
		PurposeOfVisit:     "Service AC Rumah",
		DestinationName:    "AA-1",
		GateID:             1,
	}
}

func TestCreateVisit_Success(t *testing.T) {
	sut := newCreateVisitSUT(t)
	in := validInput()
	now := time.Date(2026, 5, 17, 12, 0, 0, 0, time.UTC)
	createdAt := time.Date(2026, 5, 17, 12, 0, 1, 0, time.UTC)
	visitorID := uuid.New()
	visitID := uuid.New()

	sut.rfidRepo.EXPECT().FindByUID(mock.Anything, in.UID).
		Return(&entity.Rfid{ID: 7, RfidableType: entity.RfidableVisit}, nil).Once()
	sut.encryptor.EXPECT().Encrypt(in.IdentityPhoto).Return([]byte("encrypted"), nil).Once()
	sut.clock.EXPECT().Now().Return(now).Once()
	sut.expectPassthroughTx()
	sut.digester.EXPECT().SHA256Hex([]byte(in.IdentityNumber)).Return("hashed-identity").Once()
	sut.visitorRepo.EXPECT().UpsertByIdentityHash(mock.Anything, "hashed-identity", in.Fullname).
		Return(&entity.Visitor{ID: visitorID, Fullname: in.Fullname}, nil).Once()
	sut.visitRepo.EXPECT().Create(mock.Anything, mock.MatchedBy(func(v *entity.Visit) bool {
		gateID := in.GateID
		return v.VisitorID == visitorID &&
			string(v.IdentityPhoto) == "encrypted" &&
			v.VehiclePlateNumber == in.VehiclePlateNumber &&
			v.PurposeOfVisit == in.PurposeOfVisit &&
			v.DestinationName == in.DestinationName &&
			v.CurrentPosition == entity.CurrentPositionVilla1 &&
			v.CheckinAt != nil && v.CheckinAt.Equal(now) &&
			v.CheckinGateID != nil && *v.CheckinGateID == gateID
	})).Run(func(_ context.Context, v *entity.Visit) {
		v.ID = visitID
		v.UpdatedAt = createdAt
	}).Return(nil).Once()
	sut.rfidRepo.EXPECT().AssociateVisit(mock.Anything, uint16(7), visitID).Return(nil).Once()
	sut.visitorRepo.EXPECT().MarkBanned(mock.Anything, visitorID, "Checked in at gate 1", now).Return(nil).Once()
	sut.gateRepo.EXPECT().AdjustQuota(mock.Anything, in.GateID, int16(-1)).Return(nil).Once()

	out, err := sut.uc.Execute(context.Background(), in)

	require.NoError(t, err)
	require.NotNil(t, out)
	assert.Equal(t, visitID.String(), out.VisitID)
	assert.Equal(t, entity.CurrentPositionVilla1, out.CurrentArea)
	assert.Equal(t, createdAt, out.UpdatedAt)
}

func TestCreateVisit_RfidNotFound(t *testing.T) {
	sut := newCreateVisitSUT(t)
	in := validInput()

	sut.rfidRepo.EXPECT().FindByUID(mock.Anything, in.UID).
		Return(nil, entity.ErrRfidNotFound).Once()

	out, err := sut.uc.Execute(context.Background(), in)

	assert.ErrorIs(t, err, entity.ErrRfidNotFound)
	assert.Nil(t, out)
}

func TestCreateVisit_RfidAssignedToStaff(t *testing.T) {
	sut := newCreateVisitSUT(t)
	in := validInput()

	sut.rfidRepo.EXPECT().FindByUID(mock.Anything, in.UID).
		Return(&entity.Rfid{ID: 7, RfidableType: entity.RfidableStaff}, nil).Once()

	out, err := sut.uc.Execute(context.Background(), in)

	assert.ErrorIs(t, err, entity.ErrRfidNotFound)
	assert.Nil(t, out)
}

func TestCreateVisit_UnknownGate(t *testing.T) {
	sut := newCreateVisitSUT(t)
	in := validInput()
	in.GateID = 4 // not a valid checkin gate per CheckinPositionForGate

	sut.rfidRepo.EXPECT().FindByUID(mock.Anything, in.UID).
		Return(&entity.Rfid{ID: 7, RfidableType: entity.RfidableVisit}, nil).Once()

	out, err := sut.uc.Execute(context.Background(), in)

	assert.ErrorIs(t, err, entity.ErrInvalidVisitInput)
	assert.Nil(t, out)
}

func TestCreateVisit_EncryptError(t *testing.T) {
	sut := newCreateVisitSUT(t)
	in := validInput()
	cryptErr := errors.New("key wedged")

	sut.rfidRepo.EXPECT().FindByUID(mock.Anything, in.UID).
		Return(&entity.Rfid{ID: 7, RfidableType: entity.RfidableVisit}, nil).Once()
	sut.encryptor.EXPECT().Encrypt(in.IdentityPhoto).Return(nil, cryptErr).Once()

	out, err := sut.uc.Execute(context.Background(), in)

	assert.ErrorIs(t, err, cryptErr)
	assert.Nil(t, out)
}

func TestCreateVisit_TxRollsBackOnInnerError(t *testing.T) {
	sut := newCreateVisitSUT(t)
	in := validInput()
	now := time.Date(2026, 5, 17, 12, 0, 0, 0, time.UTC)
	visitorID := uuid.New()
	dbErr := errors.New("visit insert failed")

	sut.rfidRepo.EXPECT().FindByUID(mock.Anything, in.UID).
		Return(&entity.Rfid{ID: 7, RfidableType: entity.RfidableVisit}, nil).Once()
	sut.encryptor.EXPECT().Encrypt(in.IdentityPhoto).Return([]byte("encrypted"), nil).Once()
	sut.clock.EXPECT().Now().Return(now).Once()
	sut.expectPassthroughTx()
	sut.digester.EXPECT().SHA256Hex([]byte(in.IdentityNumber)).Return("hashed").Once()
	sut.visitorRepo.EXPECT().UpsertByIdentityHash(mock.Anything, "hashed", in.Fullname).
		Return(&entity.Visitor{ID: visitorID}, nil).Once()
	sut.visitRepo.EXPECT().Create(mock.Anything, mock.Anything).Return(dbErr).Once()

	out, err := sut.uc.Execute(context.Background(), in)

	assert.ErrorIs(t, err, dbErr)
	assert.Nil(t, out)
}
