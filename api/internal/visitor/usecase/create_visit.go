package usecase

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/hansenhalim/dgb/api/internal/entity"
)

type CreateVisitInput struct {
	UID                []byte
	IdentityPhoto      []byte // plaintext; encrypted before persistence
	IdentityNumber     string
	Fullname           string
	VehiclePlateNumber string
	PurposeOfVisit     string
	DestinationName    string
	GateID             int16
}

type CreateVisitOutput struct {
	VisitID     string
	CurrentArea entity.CurrentPosition
	UpdatedAt   time.Time
}

type CreateVisitUsecase interface {
	Execute(ctx context.Context, in CreateVisitInput) (*CreateVisitOutput, error)
}

type createVisit struct {
	rfidRepo    RfidRepository
	visitorRepo VisitorRepository
	visitRepo   VisitRepository
	digester    Digester
	encryptor   Encryptor
	clock       Clock
	tx          TxRunner
}

func NewCreateVisit(
	rfidRepo RfidRepository,
	visitorRepo VisitorRepository,
	visitRepo VisitRepository,
	digester Digester,
	encryptor Encryptor,
	clock Clock,
	tx TxRunner,
) CreateVisitUsecase {
	return &createVisit{
		rfidRepo:    rfidRepo,
		visitorRepo: visitorRepo,
		visitRepo:   visitRepo,
		digester:    digester,
		encryptor:   encryptor,
		clock:       clock,
		tx:          tx,
	}
}

func (u *createVisit) Execute(ctx context.Context, in CreateVisitInput) (*CreateVisitOutput, error) {
	rfid, err := u.rfidRepo.FindByUID(ctx, in.UID)
	if err != nil {
		return nil, err
	}
	if rfid.RfidableType == entity.RfidableStaff {
		return nil, entity.ErrRfidNotFound
	}

	position := entity.CheckinPositionForGate(in.GateID)
	if position == entity.CurrentPositionUnknown {
		return nil, entity.ErrInvalidVisitInput
	}

	encryptedPhoto, err := u.encryptor.Encrypt(in.IdentityPhoto)
	if err != nil {
		return nil, err
	}

	now := u.clock.Now().UTC()
	gateID := in.GateID

	var (
		visitID   uuid.UUID
		updatedAt time.Time
	)
	err = u.tx.Run(ctx, func(ctx context.Context) error {
		visitor, err := u.visitorRepo.UpsertByIdentityHash(ctx,
			u.digester.SHA256Hex([]byte(in.IdentityNumber)),
			in.Fullname,
		)
		if err != nil {
			return err
		}

		visit := &entity.Visit{
			VisitorID:          visitor.ID,
			IdentityPhoto:      encryptedPhoto,
			VehiclePlateNumber: in.VehiclePlateNumber,
			PurposeOfVisit:     in.PurposeOfVisit,
			DestinationName:    in.DestinationName,
			CurrentPosition:    position,
			CheckinAt:          &now,
			CheckinGateID:      &gateID,
		}
		if err := u.visitRepo.Create(ctx, visit); err != nil {
			return err
		}

		if err := u.rfidRepo.AssociateVisit(ctx, rfid.ID, visit.ID); err != nil {
			return err
		}

		reason := fmt.Sprintf("Checked in at gate %d", in.GateID)
		if err := u.visitorRepo.MarkBanned(ctx, visitor.ID, reason, now); err != nil {
			return err
		}

		visitID = visit.ID
		updatedAt = visit.UpdatedAt
		return nil
	})
	if err != nil {
		return nil, err
	}

	return &CreateVisitOutput{
		VisitID:     visitID.String(),
		CurrentArea: position,
		UpdatedAt:   updatedAt,
	}, nil
}
