package entity

import "errors"

var (
	ErrRfidNotFound  = errors.New("rfid not found or not assigned to guard")
	ErrInvalidPIN    = errors.New("invalid pin")
	ErrInvalidKey    = errors.New("invalid key")
	ErrInvalidToken  = errors.New("invalid token")
	ErrTokenNotFound = errors.New("token not found")

	ErrGateNotFound = errors.New("gate not found")

	ErrTransferNotFound         = errors.New("transfer request not found")
	ErrTransferAlreadyPending   = errors.New("transfer request already pending for one of these gates")
	ErrTransferAlreadyResponded = errors.New("transfer request already responded")
	ErrInsufficientQuota        = errors.New("source gate quota is less than amount")
	ErrInvalidTransferGates     = errors.New("invalid transfer gates")

	// ErrInvalidVisitInput is returned by CreateVisit when the input fails a
	// business rule the controller layer cannot detect on its own (e.g. a
	// gate that doesn't have a checkin position mapping).
	ErrInvalidVisitInput = errors.New("invalid visit input")
	ErrVisitNotFound     = errors.New("visit not found")
)
