package controller

import (
	"net/http"

	"github.com/labstack/echo/v5"

	"github.com/hansenhalim/dgb/api/internal/home/usecase"
	"github.com/hansenhalim/dgb/api/internal/shared/httperror"
)

type HomeController struct {
	getHome usecase.GetHomeUsecase
	jwtMW   echo.MiddlewareFunc
}

func NewHomeController(getHome usecase.GetHomeUsecase, jwtMW echo.MiddlewareFunc) *HomeController {
	return &HomeController{getHome: getHome, jwtMW: jwtMW}
}

func (c *HomeController) Register(g *echo.Group) {
	g.GET("", c.Get, c.jwtMW)
}

func (c *HomeController) Get(ctx *echo.Context) error {
	var q getHomeQuery
	if err := ctx.Bind(&q); err != nil {
		return httperror.New(http.StatusUnprocessableEntity, "Validation failed.")
	}
	if err := ctx.Validate(&q); err != nil {
		return httperror.New(http.StatusUnprocessableEntity, "Validation failed.")
	}

	out, err := c.getHome.Execute(ctx.Request().Context(), usecase.GetHomeInput{GateID: q.GateID})
	if err != nil {
		return err
	}
	return ctx.JSON(http.StatusOK, homeResponse{
		Message: "Home dashboard retrieved successfully.",
		Data: homeData{
			CardStock: cardStockPayload{
				Available: out.CardStockAvailable,
				Total:     out.CardStockTotal,
			},
			Visits: visitsPayload{
				Active: out.VisitsActive,
				Total:  out.VisitsTotal,
			},
			HasIncomingTransferRequest: out.HasIncomingTransferRequest,
		},
	})
}
