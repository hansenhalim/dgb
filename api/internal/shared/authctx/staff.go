package authctx

import (
	"errors"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
)

// ContextKey is what echo-jwt is configured to set on the request context
// (Echo's default for the JWT middleware).
const ContextKey = "user"

var ErrUnauthenticated = errors.New("no authenticated staff in request context")

// StaffID extracts the `sub` claim from the bearer JWT and parses it as a UUID.
// Requires the request to have passed through the echo-jwt middleware configured
// with `*jwt.RegisteredClaims`.
func StaffID(c *echo.Context) (uuid.UUID, error) {
	token, ok := c.Get(ContextKey).(*jwt.Token)
	if !ok || token == nil {
		return uuid.Nil, ErrUnauthenticated
	}
	claims, ok := token.Claims.(*jwt.RegisteredClaims)
	if !ok || claims == nil {
		return uuid.Nil, ErrUnauthenticated
	}
	id, err := uuid.Parse(claims.Subject)
	if err != nil {
		return uuid.Nil, ErrUnauthenticated
	}
	return id, nil
}
