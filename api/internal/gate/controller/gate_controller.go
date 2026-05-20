package controller

import (
	"net/http"

	"github.com/labstack/echo/v5"

	"github.com/hansenhalim/dgb/api/internal/gate/usecase"
)

type GateController struct {
	listGates usecase.ListGatesUsecase
	jwtMW     echo.MiddlewareFunc
}

func NewGateController(listGates usecase.ListGatesUsecase, jwtMW echo.MiddlewareFunc) *GateController {
	return &GateController{listGates: listGates, jwtMW: jwtMW}
}

func (c *GateController) Register(g *echo.Group) {
	g.GET("", c.List, c.jwtMW)
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
