package controller

import (
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"

	"github.com/hansenhalim/dgb/api/internal/entity"
	"github.com/hansenhalim/dgb/api/internal/shared/httperror"
	"github.com/hansenhalim/dgb/api/internal/visitor/usecase"
)

const (
	maxPhotoBytes  = 512 * 1024
	maxUploadBytes = 1 << 20 // 1 MB total form body — headroom over the photo

	stateChangeMessage = "Visit area updated successfully."
)

type VisitorController struct {
	getStatus    usecase.GetVisitorStatusUsecase
	createVisit  usecase.CreateVisitUsecase
	checkout     usecase.CheckoutVisitUsecase
	transit      usecase.TransitVisitUsecase
	transitEnter usecase.TransitEnterVisitUsecase
	getHistory   usecase.GetVisitHistoryUsecase
	jwtMW        echo.MiddlewareFunc
}

func NewVisitorController(
	getStatus usecase.GetVisitorStatusUsecase,
	createVisit usecase.CreateVisitUsecase,
	checkout usecase.CheckoutVisitUsecase,
	transit usecase.TransitVisitUsecase,
	transitEnter usecase.TransitEnterVisitUsecase,
	getHistory usecase.GetVisitHistoryUsecase,
	jwtMW echo.MiddlewareFunc,
) *VisitorController {
	return &VisitorController{
		getStatus:    getStatus,
		createVisit:  createVisit,
		checkout:     checkout,
		transit:      transit,
		transitEnter: transitEnter,
		getHistory:   getHistory,
		jwtMW:        jwtMW,
	}
}

func (c *VisitorController) RegisterVisitors(g *echo.Group) {
	g.GET("", c.GetStatus, c.jwtMW)
}

func (c *VisitorController) RegisterVisits(g *echo.Group) {
	g.POST("", c.CreateVisit, c.jwtMW)
	g.GET("/history", c.GetHistory, c.jwtMW)
	g.POST("/:id/checkout", c.Checkout, c.jwtMW)
	g.POST("/:id/transit", c.Transit, c.jwtMW)
	g.POST("/:id/transit-enter", c.TransitEnter, c.jwtMW)
}

func (c *VisitorController) GetStatus(ctx *echo.Context) error {
	var q getVisitorStatusQuery
	if err := ctx.Bind(&q); err != nil {
		return httperror.New(http.StatusUnprocessableEntity, "Validation failed.")
	}
	if err := ctx.Validate(&q); err != nil {
		return httperror.New(http.StatusUnprocessableEntity, "Validation failed.")
	}

	out, err := c.getStatus.Execute(ctx.Request().Context(), q.IdentityNumber)
	if err != nil {
		return err
	}
	if out == nil {
		return ctx.NoContent(http.StatusNoContent)
	}

	return ctx.JSON(http.StatusOK, getVisitorStatusResponse{
		Message: "Visitor status retrieved successfully.",
		Data: visitorPayload{
			ID:           out.Visitor.ID.String(),
			Fullname:     out.Visitor.Fullname,
			BannedAt:     formatBannedAt(out.Visitor.BannedAt),
			BannedReason: out.Visitor.BannedReason,
			LatestVisit:  mapLatestVisit(out.LatestVisit),
		},
	})
}

func (c *VisitorController) CreateVisit(ctx *echo.Context) error {
	const badInput = "Photo exceeds 512KB limit or invalid input"

	req := ctx.Request()
	req.Body = http.MaxBytesReader(ctx.Response(), req.Body, maxUploadBytes)
	if err := req.ParseMultipartForm(maxUploadBytes); err != nil {
		return httperror.New(http.StatusBadRequest, badInput)
	}

	uidStr := strings.ToLower(strings.TrimSpace(ctx.FormValue("uid")))
	if len(uidStr) != 8 {
		return httperror.New(http.StatusBadRequest, badInput)
	}
	uid, err := hex.DecodeString(uidStr)
	if err != nil {
		return httperror.New(http.StatusBadRequest, badInput)
	}

	identityNumber := strings.TrimSpace(ctx.FormValue("identity_number"))
	fullname := strings.TrimSpace(ctx.FormValue("fullname"))
	purposeOfVisit := strings.TrimSpace(ctx.FormValue("purpose_of_visit"))
	destinationName := strings.TrimSpace(ctx.FormValue("destination_name"))
	vehiclePlate := strings.TrimSpace(ctx.FormValue("vehicle_plate_number"))
	gateIDStr := strings.TrimSpace(ctx.FormValue("gate_id"))
	if identityNumber == "" || fullname == "" || purposeOfVisit == "" || destinationName == "" || gateIDStr == "" {
		return httperror.New(http.StatusBadRequest, badInput)
	}

	gateID64, err := strconv.ParseInt(gateIDStr, 10, 16)
	if err != nil || gateID64 <= 0 {
		return httperror.New(http.StatusBadRequest, badInput)
	}

	fileHeader, err := ctx.FormFile("identity_photo")
	if err != nil || fileHeader == nil {
		return httperror.New(http.StatusBadRequest, badInput)
	}
	if fileHeader.Size > maxPhotoBytes {
		return httperror.New(http.StatusBadRequest, badInput)
	}
	f, err := fileHeader.Open()
	if err != nil {
		return httperror.New(http.StatusBadRequest, badInput)
	}
	defer f.Close()
	photo, err := io.ReadAll(io.LimitReader(f, maxPhotoBytes+1))
	if err != nil {
		return httperror.New(http.StatusBadRequest, badInput)
	}
	if len(photo) > maxPhotoBytes {
		return httperror.New(http.StatusBadRequest, badInput)
	}

	out, err := c.createVisit.Execute(ctx.Request().Context(), usecase.CreateVisitInput{
		UID:                uid,
		IdentityPhoto:      photo,
		IdentityNumber:     identityNumber,
		Fullname:           fullname,
		VehiclePlateNumber: vehiclePlate,
		PurposeOfVisit:     purposeOfVisit,
		DestinationName:    destinationName,
		GateID:             int16(gateID64),
	})
	if err != nil {
		switch {
		case errors.Is(err, entity.ErrRfidNotFound):
			return httperror.New(http.StatusNotFound, "RFID not found or assigned to staff.")
		case errors.Is(err, entity.ErrInvalidVisitInput):
			return httperror.New(http.StatusBadRequest, badInput)
		default:
			return err
		}
	}

	return ctx.JSON(http.StatusCreated, createVisitResponse{
		Message: "Visit created successfully",
		Data: createVisitData{
			ID:          out.VisitID,
			CurrentArea: currentAreaWire(out.CurrentArea),
			UpdatedAt:   out.UpdatedAt.UTC().Format(time.RFC3339),
		},
	})
}

func (c *VisitorController) Checkout(ctx *echo.Context) error {
	visitID, gateID, err := bindVisitStateRequest(ctx)
	if err != nil {
		return err
	}

	err = c.checkout.Execute(ctx.Request().Context(), usecase.CheckoutVisitInput{
		VisitID: visitID,
		GateID:  gateID,
	})
	if err != nil {
		return mapStateChangeError(err)
	}

	return ctx.JSON(http.StatusOK, messageResponse{Message: stateChangeMessage})
}

func (c *VisitorController) Transit(ctx *echo.Context) error {
	visitID, gateID, err := bindVisitStateRequest(ctx)
	if err != nil {
		return err
	}

	out, err := c.transit.Execute(ctx.Request().Context(), usecase.TransitVisitInput{
		VisitID: visitID,
		GateID:  gateID,
	})
	if err != nil {
		return mapStateChangeError(err)
	}

	return ctx.JSON(http.StatusOK, visitStateResponse{
		Message: stateChangeMessage,
		Data: visitStateData{
			CurrentArea: currentAreaWire(out.CurrentArea),
			UpdatedAt:   out.UpdatedAt.UTC().Format(time.RFC3339),
		},
	})
}

func (c *VisitorController) GetHistory(ctx *echo.Context) error {
	var q getVisitHistoryQuery
	if err := ctx.Bind(&q); err != nil {
		return httperror.New(http.StatusUnprocessableEntity, "Validation failed.")
	}
	if err := ctx.Validate(&q); err != nil {
		return httperror.New(http.StatusUnprocessableEntity, "Validation failed.")
	}

	visits, err := c.getHistory.Execute(ctx.Request().Context(), q.GateID)
	if err != nil {
		return err
	}

	items := make([]visitHistoryItem, len(visits))
	for i, v := range visits {
		items[i] = visitHistoryItem{
			ID:                 v.ID.String(),
			VehiclePlateNumber: v.VehiclePlateNumber,
			CurrentPosition:    currentAreaWire(v.CurrentPosition),
			DestinationName:    v.DestinationName,
			CreatedAt:          v.CreatedAt.UTC().Format(time.RFC3339),
		}
	}

	return ctx.JSON(http.StatusOK, getVisitHistoryResponse{
		Message: "Successfully get visit history",
		Data:    items,
	})
}

func (c *VisitorController) TransitEnter(ctx *echo.Context) error {
	visitID, gateID, err := bindVisitStateRequest(ctx)
	if err != nil {
		return err
	}

	out, err := c.transitEnter.Execute(ctx.Request().Context(), usecase.TransitEnterVisitInput{
		VisitID: visitID,
		GateID:  gateID,
	})
	if err != nil {
		return mapStateChangeError(err)
	}

	return ctx.JSON(http.StatusOK, visitStateResponse{
		Message: stateChangeMessage,
		Data: visitStateData{
			CurrentArea: currentAreaWire(out.CurrentArea),
			UpdatedAt:   out.UpdatedAt.UTC().Format(time.RFC3339),
		},
	})
}

func bindVisitStateRequest(ctx *echo.Context) (uuid.UUID, int16, error) {
	visitID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		return uuid.Nil, 0, httperror.New(http.StatusBadRequest, "Invalid request data.")
	}

	var req gateOnlyRequest
	if err := ctx.Bind(&req); err != nil {
		return uuid.Nil, 0, httperror.New(http.StatusBadRequest, "Invalid request data.")
	}
	if err := ctx.Validate(&req); err != nil {
		return uuid.Nil, 0, httperror.New(http.StatusBadRequest, "Invalid request data.")
	}

	return visitID, req.GateID, nil
}

func mapStateChangeError(err error) error {
	switch {
	case errors.Is(err, entity.ErrVisitNotFound):
		return httperror.New(http.StatusNotFound, "Visit not found.")
	case errors.Is(err, entity.ErrInvalidVisitInput):
		return httperror.New(http.StatusBadRequest, "Invalid request data.")
	default:
		return err
	}
}

func currentAreaWire(p entity.CurrentPosition) string {
	switch p {
	case entity.CurrentPositionOutside:
		return "OUT"
	case entity.CurrentPositionVilla1:
		return "VIL_1"
	case entity.CurrentPositionVilla2:
		return "VIL_2"
	case entity.CurrentPositionExclusive:
		return "VIL_E"
	case entity.CurrentPositionInTransit:
		return "TRNST"
	default:
		return ""
	}
}

func formatBannedAt(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.UTC().Format(time.RFC3339)
	return &s
}

func mapLatestVisit(v *entity.Visit) *visitPayload {
	if v == nil {
		return nil
	}
	return &visitPayload{
		ID:                 v.ID.String(),
		VehiclePlateNumber: v.VehiclePlateNumber,
		PurposeOfVisit:     v.PurposeOfVisit,
		DestinationName:    v.DestinationName,
		CreatedAt:          v.CreatedAt.UTC().Format(time.RFC3339),
	}
}
