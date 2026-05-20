package controller

import (
	"net/http"

	"github.com/labstack/echo/v5"

	"github.com/hansenhalim/dgb/api/internal/destination/usecase"
	"github.com/hansenhalim/dgb/api/internal/entity"
)

type DestinationController struct {
	listDestinations usecase.ListDestinationsUsecase
	jwtMW            echo.MiddlewareFunc
}

func NewDestinationController(listDestinations usecase.ListDestinationsUsecase, jwtMW echo.MiddlewareFunc) *DestinationController {
	return &DestinationController{listDestinations: listDestinations, jwtMW: jwtMW}
}

func (c *DestinationController) Register(g *echo.Group) {
	g.GET("", c.List, c.jwtMW)
}

func (c *DestinationController) List(ctx *echo.Context) error {
	destinations, err := c.listDestinations.Execute(ctx.Request().Context())
	if err != nil {
		return err
	}

	items := make([]destinationItem, len(destinations))
	for i, d := range destinations {
		items[i] = destinationItem{Name: d.Name, Position: positionHuman(d.Position)}
	}

	return ctx.JSON(http.StatusOK, listDestinationsResponse{
		Message: "Destinations retrieved successfully.",
		Data:    items,
	})
}

func positionHuman(p entity.Position) string {
	switch p {
	case entity.PositionVilla1:
		return "villa1"
	case entity.PositionVilla2:
		return "villa2"
	case entity.PositionExclusive:
		return "exclusive"
	default:
		return ""
	}
}
