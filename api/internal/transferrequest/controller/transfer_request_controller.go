package controller

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v5"

	"github.com/hansenhalim/dgb/api/internal/entity"
	"github.com/hansenhalim/dgb/api/internal/shared/authctx"
	"github.com/hansenhalim/dgb/api/internal/shared/httperror"
	"github.com/hansenhalim/dgb/api/internal/transferrequest/usecase"
)

type TransferRequestController struct {
	check   usecase.CheckTransferRequestUsecase
	create  usecase.CreateTransferRequestUsecase
	respond usecase.RespondTransferRequestUsecase
	jwtMW   echo.MiddlewareFunc
}

func NewTransferRequestController(
	check usecase.CheckTransferRequestUsecase,
	create usecase.CreateTransferRequestUsecase,
	respond usecase.RespondTransferRequestUsecase,
	jwtMW echo.MiddlewareFunc,
) *TransferRequestController {
	return &TransferRequestController{
		check:   check,
		create:  create,
		respond: respond,
		jwtMW:   jwtMW,
	}
}

func (c *TransferRequestController) Register(trs *echo.Group, gates *echo.Group) {
	trs.POST("", c.Create, c.jwtMW)
	trs.PATCH("/:id", c.Respond, c.jwtMW)
	gates.GET("/:id/transfer-requests", c.Check, c.jwtMW)
}

func (c *TransferRequestController) Check(ctx *echo.Context) error {
	gateID, err := parseInt16Param(ctx, "id")
	if err != nil {
		return httperror.New(http.StatusUnprocessableEntity, "Validation failed.")
	}

	tr, err := c.check.Execute(ctx.Request().Context(), gateID)
	if err != nil {
		return err
	}
	if tr == nil {
		return ctx.NoContent(http.StatusNoContent)
	}

	return ctx.JSON(http.StatusOK, findTransferRequestResponse{
		Message: "Transfer request found.",
		Data: transferRequestPayload{
			ID:       tr.ID,
			FromGate: gateRef{ID: tr.FromGate.ID, Name: tr.FromGate.Name},
			ToGate:   gateRef{ID: tr.ToGate.ID, Name: tr.ToGate.Name},
			Amount:   tr.Amount,
		},
	})
}

func (c *TransferRequestController) Create(ctx *echo.Context) error {
	var req createTransferRequestRequest
	if err := ctx.Bind(&req); err != nil {
		return httperror.New(http.StatusBadRequest, "Invalid request body.")
	}
	if err := ctx.Validate(&req); err != nil {
		return httperror.New(http.StatusUnprocessableEntity, "Validation failed.")
	}

	staffID, err := authctx.StaffID(ctx)
	if err != nil {
		return httperror.New(http.StatusUnauthorized, "Invalid token.")
	}

	err = c.create.Execute(ctx.Request().Context(), usecase.CreateTransferRequestInput{
		FromGateID:    req.FromGate,
		ToGateID:      req.ToGate,
		Amount:        req.Amount,
		SenderStaffID: staffID,
	})
	if err != nil {
		switch {
		case errors.Is(err, entity.ErrInsufficientQuota):
			return httperror.New(http.StatusBadRequest, "Amount must be smaller or equal to source gate card amount.")
		case errors.Is(err, entity.ErrTransferAlreadyPending), errors.Is(err, entity.ErrInvalidTransferGates):
			return httperror.New(http.StatusBadRequest, "Invalid request data or transfer already pending.")
		default:
			return err
		}
	}

	return ctx.JSON(http.StatusOK, messageResponse{Message: "Transfer request created successfully."})
}

func (c *TransferRequestController) Respond(ctx *echo.Context) error {
	transferID, err := strconv.ParseInt(ctx.Param("id"), 10, 64)
	if err != nil {
		return httperror.New(http.StatusBadRequest, "Invalid status or request already processed.")
	}

	var req respondTransferRequestRequest
	if err := ctx.Bind(&req); err != nil {
		return httperror.New(http.StatusBadRequest, "Invalid status or request already processed.")
	}
	if err := ctx.Validate(&req); err != nil {
		return httperror.New(http.StatusBadRequest, "Invalid status or request already processed.")
	}

	staffID, err := authctx.StaffID(ctx)
	if err != nil {
		return httperror.New(http.StatusUnauthorized, "Invalid token.")
	}

	action := usecase.RespondActionUnknown
	switch req.Status {
	case "confirm":
		action = usecase.RespondActionConfirm
	case "reject":
		action = usecase.RespondActionReject
	}

	out, err := c.respond.Execute(ctx.Request().Context(), usecase.RespondTransferRequestInput{
		TransferID:       transferID,
		Action:           action,
		RecipientStaffID: staffID,
	})
	if err != nil {
		switch {
		case errors.Is(err, entity.ErrTransferAlreadyResponded), errors.Is(err, entity.ErrTransferNotFound):
			return httperror.New(http.StatusBadRequest, "Invalid status or request already processed.")
		default:
			return err
		}
	}

	verb := "responded"
	switch out.Status {
	case entity.TransferStatusConfirmed:
		verb = "confirmed"
	case entity.TransferStatusRejected:
		verb = "rejected"
	}
	return ctx.JSON(http.StatusOK, messageResponse{Message: "Transfer request " + verb + " successfully."})
}

func parseInt16Param(ctx *echo.Context, name string) (int16, error) {
	v, err := strconv.ParseInt(ctx.Param(name), 10, 16)
	if err != nil {
		return 0, err
	}
	return int16(v), nil
}
