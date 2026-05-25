package gatewebhook

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"time"
)

// Pulser dispatches an HTTP GET to the per-(gate, direction) webhook URL
// configured via env vars (`GATE_<id>_<IN|OUT>_WEBHOOK_URL`). Behaviour mirrors
// the Laravel reference: 1s timeout, missing URL is a silent no-op, errors are
// warn-logged and swallowed. Pulse is fire-and-forget — it returns immediately
// and runs the request on a background goroutine with a detached context.
type Pulser struct {
	client *http.Client
}

func NewPulser() *Pulser {
	return &Pulser{
		client: &http.Client{Timeout: time.Second},
	}
}

func (p *Pulser) Pulse(gateID int16, direction string) {
	url := webhookURL(gateID, direction)
	if url == "" {
		return
	}
	go p.dispatch(url, gateID, direction)
}

func (p *Pulser) dispatch(url string, gateID int16, direction string) {
	defer func() {
		if r := recover(); r != nil {
			slog.Warn("gate pulse panic", "panic", r, "url", url, "gate_id", gateID, "direction", direction)
		}
	}()
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, url, nil)
	if err != nil {
		slog.Warn("gate pulse build request failed", "error", err.Error(), "url", url, "gate_id", gateID, "direction", direction)
		return
	}
	resp, err := p.client.Do(req)
	if err != nil {
		slog.Warn("gate pulse webhook request failed", "error", err.Error(), "url", url, "gate_id", gateID, "direction", direction)
		return
	}
	resp.Body.Close()
}

func webhookURL(gateID int16, direction string) string {
	switch gateID {
	case 1:
		return urlForDirection(direction, "GATE_1_IN_WEBHOOK_URL", "GATE_1_OUT_WEBHOOK_URL")
	case 2:
		return urlForDirection(direction, "GATE_2_IN_WEBHOOK_URL", "GATE_2_OUT_WEBHOOK_URL")
	case 3:
		return urlForDirection(direction, "GATE_3_IN_WEBHOOK_URL", "GATE_3_OUT_WEBHOOK_URL")
	case 4:
		return urlForDirection(direction, "GATE_4_IN_WEBHOOK_URL", "GATE_4_OUT_WEBHOOK_URL")
	default:
		return ""
	}
}

func urlForDirection(direction, inKey, outKey string) string {
	switch direction {
	case "in":
		return os.Getenv(inKey)
	case "out":
		return os.Getenv(outKey)
	default:
		return ""
	}
}
