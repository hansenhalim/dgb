package jwt

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type HS256 struct {
	secret []byte
}

func NewHS256(secret []byte) *HS256 {
	return &HS256{secret: secret}
}

func (h *HS256) Issue(subject string, expiresAt time.Time) (string, error) {
	now := time.Now()
	claims := jwt.RegisteredClaims{
		Subject:   subject,
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(expiresAt),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(h.secret)
}
