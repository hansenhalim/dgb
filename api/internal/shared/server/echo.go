package server

import (
	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"

	"github.com/hansenhalim/dgb/api/internal/shared/httperror"
	sharedvalidator "github.com/hansenhalim/dgb/api/internal/shared/validator"
)

func NewEcho(isProduction bool) *echo.Echo {
	e := echo.New()
	e.Validator = sharedvalidator.New()
	e.HTTPErrorHandler = httperror.Handler
	e.Use(middleware.Recover())
	e.Use(middleware.RequestID())
	if !isProduction {
		e.Use(middleware.RequestLogger())
	}
	return e
}
