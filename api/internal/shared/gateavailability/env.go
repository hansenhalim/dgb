package gateavailability

import (
	"fmt"
	"os"
	"strconv"
)

// Env reads `GATE_<id>_IS_AVAILABLE` env vars at lookup time, defaulting to
// true when unset. Mirrors Laravel's `config("app.gate_{$id}_is_available", true)`.
type Env struct{}

func NewEnv() *Env {
	return &Env{}
}

func (Env) IsAvailable(gateID int16) bool {
	v := os.Getenv(fmt.Sprintf("GATE_%d_IS_AVAILABLE", gateID))
	if v == "" {
		return true
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return true
	}
	return b
}
