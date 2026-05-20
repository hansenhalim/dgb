package controller

import (
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v5"

	"github.com/hansenhalim/dgb/api/internal/auth/usecase"
	"github.com/hansenhalim/dgb/api/internal/entity"
	"github.com/hansenhalim/dgb/api/internal/shared/httperror"
)

type AuthController struct {
	verifyPin    usecase.VerifyPinUsecase
	verifySecret usecase.VerifySecretUsecase
}

func NewAuthController(
	verifyPin usecase.VerifyPinUsecase,
	verifySecret usecase.VerifySecretUsecase,
) *AuthController {
	return &AuthController{
		verifyPin:    verifyPin,
		verifySecret: verifySecret,
	}
}

func (c *AuthController) Register(g *echo.Group) {
	g.POST("/verify-pin", c.VerifyPin)
	g.POST("/verify-secret", c.VerifySecret)
}

func (c *AuthController) VerifyPin(ctx *echo.Context) error {
	var req verifyPinRequest
	if err := ctx.Bind(&req); err != nil {
		return httperror.New(http.StatusBadRequest, "Invalid request body.")
	}
	if err := ctx.Validate(&req); err != nil {
		return httperror.New(http.StatusUnprocessableEntity, "Validation failed.")
	}

	uid, err := hex.DecodeString(strings.ToLower(req.UID))
	if err != nil {
		return httperror.New(http.StatusUnprocessableEntity, "Validation failed.")
	}

	out, err := c.verifyPin.Execute(ctx.Request().Context(), usecase.VerifyPinInput{UID: uid, PIN: req.PIN})
	if err != nil {
		switch {
		case errors.Is(err, entity.ErrRfidNotFound):
			return httperror.New(http.StatusNotFound, "RFID not found or not assigned to guard.")
		case errors.Is(err, entity.ErrInvalidPIN):
			return httperror.New(http.StatusUnauthorized, "Invalid PIN.")
		default:
			return err
		}
	}

	return ctx.JSON(http.StatusOK, verifyPinResponse{
		Message: "PIN is valid.",
		RfidKey: strings.ToUpper(hex.EncodeToString(out.RfidKey)),
	})
}

func (c *AuthController) VerifySecret(ctx *echo.Context) error {
	var req verifySecretRequest
	if err := ctx.Bind(&req); err != nil {
		return httperror.New(http.StatusBadRequest, "Invalid request body.")
	}
	if err := ctx.Validate(&req); err != nil {
		return httperror.New(http.StatusUnprocessableEntity, "Validation failed.")
	}

	uid, err := hex.DecodeString(strings.ToLower(req.UID))
	if err != nil {
		return httperror.New(http.StatusUnprocessableEntity, "Validation failed.")
	}

	out, err := c.verifySecret.Execute(ctx.Request().Context(), usecase.VerifySecretInput{
		UID:        uid,
		SecretKey:  strings.ToLower(req.SecretKey),
		DeviceName: req.DeviceName,
	})
	if err != nil {
		switch {
		case errors.Is(err, entity.ErrRfidNotFound):
			return httperror.New(http.StatusNotFound, "RFID not found or not assigned to guard.")
		case errors.Is(err, entity.ErrInvalidKey):
			return httperror.New(http.StatusUnauthorized, "Invalid key.")
		default:
			return err
		}
	}

	return ctx.JSON(http.StatusOK, verifySecretResponse{
		Message:    "You have logged in successfully.",
		Token:      out.Token,
		ValidUntil: out.ValidUntil.UTC().Format(time.RFC3339),
	})
}
