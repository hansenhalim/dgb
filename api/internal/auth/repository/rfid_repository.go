package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/hansenhalim/dgb/api/internal/entity"
	"github.com/hansenhalim/dgb/api/internal/shared/tx"
)

const laravelStaffType = `App\Models\Staff`
const laravelVisitType = `App\Models\Visit`

type RfidRepository struct {
	db *gorm.DB
}

func NewRfidRepository(db *gorm.DB) *RfidRepository {
	return &RfidRepository{db: db}
}

func (r *RfidRepository) FindGuardByUID(ctx context.Context, uid []byte) (*entity.Rfid, error) {
	var row rfid
	err := tx.DB(ctx, r.db).
		Where("uid = ?", uid).
		Where("rfidable_type = ?", laravelStaffType).
		First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, entity.ErrRfidNotFound
	}
	if err != nil {
		return nil, err
	}

	var s staff
	err = tx.DB(ctx, r.db).
		Where("id = ?", row.RfidableID).
		Where("role = ?", string(roleToDB(entity.RoleGuard))).
		First(&s).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, entity.ErrRfidNotFound
	}
	if err != nil {
		return nil, err
	}

	return toEntityRfid(&row, &s), nil
}

func (r *RfidRepository) FindByUID(ctx context.Context, uid []byte) (*entity.Rfid, error) {
	var row rfid
	err := tx.DB(ctx, r.db).Where("uid = ?", uid).First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, entity.ErrRfidNotFound
	}
	if err != nil {
		return nil, err
	}
	return toEntityRfid(&row, nil), nil
}

func (r *RfidRepository) AssociateVisit(ctx context.Context, rfidID uint16, visitID uuid.UUID) error {
	return tx.DB(ctx, r.db).
		Model(&rfid{}).
		Where("id = ?", rfidID).
		Updates(map[string]any{
			"rfidable_type": laravelVisitType,
			"rfidable_id":   visitID,
		}).Error
}

func (r *RfidRepository) ReleaseByVisit(ctx context.Context, visitID uuid.UUID) error {
	return tx.DB(ctx, r.db).
		Model(&rfid{}).
		Where("rfidable_type = ?", laravelVisitType).
		Where("rfidable_id = ?", visitID).
		Updates(map[string]any{
			"rfidable_type": nil,
			"rfidable_id":   nil,
		}).Error
}

func roleToDB(role entity.Role) string {
	switch role {
	case entity.RoleGuard:
		return "GRD"
	case entity.RoleManager:
		return "MAN"
	default:
		return ""
	}
}

func roleFromDB(s string) entity.Role {
	switch s {
	case "GRD":
		return entity.RoleGuard
	case "MAN":
		return entity.RoleManager
	default:
		return entity.RoleUnknown
	}
}

func rfidableTypeFromDB(s string) entity.RfidableType {
	switch s {
	case laravelStaffType:
		return entity.RfidableStaff
	case laravelVisitType:
		return entity.RfidableVisit
	default:
		return entity.RfidableUnknown
	}
}

func toEntityRfid(r *rfid, s *staff) *entity.Rfid {
	d := &entity.Rfid{
		ID:           r.ID,
		UID:          r.UID,
		Key:          r.Key,
		PIN:          r.PIN,
		RfidableType: rfidableTypeFromDB(r.RfidableType),
		RfidableID:   r.RfidableID,
		CreatedAt:    r.CreatedAt,
		UpdatedAt:    r.UpdatedAt,
	}
	if s != nil {
		d.Staff = &entity.Staff{
			ID:        s.ID,
			Role:      roleFromDB(s.Role),
			Name:      s.Name,
			SecretKey: s.SecretKey,
			CreatedAt: s.CreatedAt,
			UpdatedAt: s.UpdatedAt,
		}
	}
	return d
}
