package controller

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"time"

	"github.com/labstack/echo/v5"

	"github.com/hansenhalim/dgb/api/internal/shared/httperror"
)

// Upload caps mirror /visits' identity_photo flow: 512 KB image + a tiny bit of
// form headroom. The OCR service rejects anything past that anyway.
const (
	maxImageBytes  = 512 * 1024
	maxUploadBytes = 1 << 20
	upstreamPath   = "/extract-id"
)

// ExtractIDController proxies multipart OCR requests to the external OCR
// service configured by OCR_URL. JWT is enforced by the caller; this handler
// just validates input shape, forwards the body, and returns the upstream
// response verbatim. Mirrors the Laravel ExtractIdController.
type ExtractIDController struct {
	ocrBaseURL string
	client     *http.Client
	jwtMW      echo.MiddlewareFunc
}

func NewExtractIDController(ocrBaseURL string, jwtMW echo.MiddlewareFunc) *ExtractIDController {
	return &ExtractIDController{
		ocrBaseURL: ocrBaseURL,
		client:     &http.Client{Timeout: 30 * time.Second},
		jwtMW:      jwtMW,
	}
}

func (c *ExtractIDController) Register(g *echo.Group) {
	g.POST("", c.Extract, c.jwtMW)
}

func (c *ExtractIDController) Extract(ctx *echo.Context) error {
	const badInput = "Image exceeds 512KB limit or invalid input"

	if c.ocrBaseURL == "" {
		return httperror.New(http.StatusServiceUnavailable, "OCR service not configured.")
	}

	req := ctx.Request()
	req.Body = http.MaxBytesReader(ctx.Response(), req.Body, maxUploadBytes)
	if err := req.ParseMultipartForm(maxUploadBytes); err != nil {
		return httperror.New(http.StatusBadRequest, badInput)
	}

	fileHeader, err := ctx.FormFile("image")
	if err != nil || fileHeader == nil {
		return httperror.New(http.StatusBadRequest, badInput)
	}
	if fileHeader.Size > maxImageBytes {
		return httperror.New(http.StatusBadRequest, badInput)
	}
	f, err := fileHeader.Open()
	if err != nil {
		return httperror.New(http.StatusBadRequest, badInput)
	}
	defer f.Close()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("image", fileHeader.Filename)
	if err != nil {
		return err
	}
	if _, err := io.Copy(part, io.LimitReader(f, maxImageBytes+1)); err != nil {
		return httperror.New(http.StatusBadRequest, badInput)
	}
	if fields := ctx.FormValue("fields"); fields != "" {
		if err := writer.WriteField("fields", fields); err != nil {
			return err
		}
	}
	if err := writer.Close(); err != nil {
		return err
	}

	upstream, err := http.NewRequestWithContext(req.Context(), http.MethodPost, c.ocrBaseURL+upstreamPath, &body)
	if err != nil {
		return err
	}
	upstream.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := c.client.Do(upstream)
	if err != nil {
		return httperror.New(http.StatusBadGateway, "OCR service unreachable.")
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return httperror.New(http.StatusBadGateway, "OCR service unreachable.")
	}
	if ct := resp.Header.Get("Content-Type"); ct != "" {
		ctx.Response().Header().Set("Content-Type", ct)
	}
	return ctx.Blob(resp.StatusCode, resp.Header.Get("Content-Type"), respBody)
}
