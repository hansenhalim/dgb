FROM golang:1.26-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w" \
    -trimpath \
    -o /out/api ./cmd/api

FROM scratch
COPY --from=builder /out/api /api
EXPOSE 8080
ENTRYPOINT ["/api"]
