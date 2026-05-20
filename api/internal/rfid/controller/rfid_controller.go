package controller

import (
	"encoding/hex"
	"errors"
	"net/http"
	"strings"

	"github.com/labstack/echo/v5"

	"github.com/hansenhalim/dgb/api/internal/entity"
	"github.com/hansenhalim/dgb/api/internal/rfid/usecase"
	"github.com/hansenhalim/dgb/api/internal/shared/httperror"
)

type RfidController struct {
	getKey usecase.GetRfidKeyUsecase
	jwtMW  echo.MiddlewareFunc
}

func NewRfidController(getKey usecase.GetRfidKeyUsecase, jwtMW echo.MiddlewareFunc) *RfidController {
	return &RfidController{getKey: getKey, jwtMW: jwtMW}
}

func (c *RfidController) Register(g *echo.Group) {
	g.GET("", c.GetKey, c.jwtMW)
}

func (c *RfidController) GetKey(ctx *echo.Context) error {
	var q getRfidKeyQuery
	if err := ctx.Bind(&q); err != nil {
		return httperror.New(http.StatusUnprocessableEntity, "Validation failed.")
	}
	if err := ctx.Validate(&q); err != nil {
		return httperror.New(http.StatusUnprocessableEntity, "Validation failed.")
	}

	uid, err := hex.DecodeString(strings.ToLower(q.UID))
	if err != nil {
		return httperror.New(http.StatusUnprocessableEntity, "Validation failed.")
	}

	out, err := c.getKey.Execute(ctx.Request().Context(), uid)
	if err != nil {
		if errors.Is(err, entity.ErrRfidNotFound) {
			return httperror.New(http.StatusNotFound, "RFID not found or assigned to staff.")
		}
		return err
	}

	return ctx.JSON(http.StatusOK, getRfidKeyResponse{
		Message: "Successfully retrieving key.",
		RfidKey: strings.ToUpper(hex.EncodeToString(out.Key)),
	})
}
