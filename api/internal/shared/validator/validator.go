package validator

import (
	"github.com/go-playground/validator/v10"
)

type Validator struct {
	v *validator.Validate
}

func New() *Validator {
	return &Validator{v: validator.New(validator.WithRequiredStructEnabled())}
}

func (cv *Validator) Validate(i any) error {
	return cv.v.Struct(i)
}
