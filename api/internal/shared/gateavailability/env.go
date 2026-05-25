package gateavailability

import (
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
	switch gateID {
	case 1:
		return parseBoolDefault(os.Getenv("GATE_1_IS_AVAILABLE"), true)
	case 2:
		return parseBoolDefault(os.Getenv("GATE_2_IS_AVAILABLE"), true)
	case 3:
		return parseBoolDefault(os.Getenv("GATE_3_IS_AVAILABLE"), true)
	case 4:
		return parseBoolDefault(os.Getenv("GATE_4_IS_AVAILABLE"), true)
	default:
		return true
	}
}

func parseBoolDefault(s string, def bool) bool {
	if s == "" {
		return def
	}
	b, err := strconv.ParseBool(s)
	if err != nil {
		return def
	}
	return b
}
