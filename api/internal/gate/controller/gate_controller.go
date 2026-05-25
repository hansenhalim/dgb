package controller

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v5"

	"github.com/hansenhalim/dgb/api/internal/gate/usecase"
	"github.com/hansenhalim/dgb/api/internal/shared/gatewebhook"
	"github.com/hansenhalim/dgb/api/internal/shared/httperror"
)

type GateController struct {
	listGates usecase.ListGatesUsecase
	pulser    *gatewebhook.Pulser
	jwtMW     echo.MiddlewareFunc
}

func NewGateController(listGates usecase.ListGatesUsecase, pulser *gatewebhook.Pulser, jwtMW echo.MiddlewareFunc) *GateController {
	return &GateController{listGates: listGates, pulser: pulser, jwtMW: jwtMW}
}

func (c *GateController) Register(g *echo.Group) {
	g.GET("", c.List, c.jwtMW)
	g.POST("/:id/pulse", c.Pulse, c.jwtMW)
}

func (c *GateController) List(ctx *echo.Context) error {
	out, err := c.listGates.Execute(ctx.Request().Context())
	if err != nil {
		return err
	}

	items := make([]gateItem, len(out.Items))
	for i, it := range out.Items {
		items[i] = gateItem{
			ID:           it.ID,
			Name:         it.Name,
			CurrentQuota: it.CurrentQuota,
			IsAvailable:  it.IsAvailable,
		}
	}

	return ctx.JSON(http.StatusOK, listGatesResponse{
		Message: "Successfully retrieved available gates.",
		Data:    items,
	})
}

func (c *GateController) Pulse(ctx *echo.Context) error {
	gateID64, err := strconv.ParseInt(ctx.Param("id"), 10, 16)
	if err != nil || gateID64 <= 0 {
		return httperror.New(http.StatusBadRequest, "Invalid request data.")
	}

	var req pulseGateRequest
	if err := ctx.Bind(&req); err != nil {
		return httperror.New(http.StatusBadRequest, "Invalid request data.")
	}
	if err := ctx.Validate(&req); err != nil {
		return httperror.New(http.StatusBadRequest, "Invalid request data.")
	}

	c.pulser.Pulse(int16(gateID64), req.Direction)
	return ctx.NoContent(http.StatusNoContent)
}
