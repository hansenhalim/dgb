package controller

import (
	"net/http"

	"github.com/labstack/echo/v5"

	"github.com/hansenhalim/dgb/api/internal/home/usecase"
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
	out, err := c.getHome.Execute(ctx.Request().Context())
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
		},
	})
}
