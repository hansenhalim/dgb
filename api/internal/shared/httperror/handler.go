package httperror

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/labstack/echo/v5"
)

type messageBody struct {
	Message string `json:"message"`
}

func Handler(c *echo.Context, err error) {
	if r, _ := echo.UnwrapResponse(c.Response()); r != nil && r.Committed {
		return
	}

	var apiErr *APIError
	if errors.As(err, &apiErr) {
		_ = c.JSON(apiErr.Status, messageBody{Message: apiErr.Message})
		return
	}

	if errors.Is(err, echo.ErrNotFound) {
		_ = c.JSON(http.StatusNotFound, messageBody{
			Message: fmt.Sprintf("The route %s %s could not be found.", c.Request().Method, c.Request().URL.Path),
		})
		return
	}

	if errors.Is(err, echo.ErrMethodNotAllowed) {
		_ = c.JSON(http.StatusMethodNotAllowed, messageBody{
			Message: fmt.Sprintf("The %s method is not supported for route %s.", c.Request().Method, c.Request().URL.Path),
		})
		return
	}

	var httpErr *echo.HTTPError
	if errors.As(err, &httpErr) {
		msg := httpErr.Message
		if msg == "" {
			msg = http.StatusText(httpErr.Code)
		}
		_ = c.JSON(httpErr.Code, messageBody{Message: msg})
		return
	}

	var sc echo.HTTPStatusCoder
	if errors.As(err, &sc) {
		code := sc.StatusCode()
		_ = c.JSON(code, messageBody{Message: http.StatusText(code)})
		return
	}

	_ = c.JSON(http.StatusInternalServerError, messageBody{Message: "Internal server error."})
}
