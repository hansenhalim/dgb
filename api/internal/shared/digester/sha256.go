package digester

import (
	"crypto/sha256"
	"encoding/hex"
)

type SHA256 struct{}

func NewSHA256() *SHA256 {
	return &SHA256{}
}

func (SHA256) SHA256Hex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}
