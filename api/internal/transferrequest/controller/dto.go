package controller

type createTransferRequestRequest struct {
	FromGate int16 `json:"from_gate" validate:"required,gt=0,nefield=ToGate"`
	ToGate   int16 `json:"to_gate" validate:"required,gt=0"`
	Amount   int16 `json:"amount" validate:"required,gt=0"`
}

type respondTransferRequestRequest struct {
	Status string `json:"status" validate:"required,oneof=confirm reject"`
}

type gateRef struct {
	ID   int16  `json:"id"`
	Name string `json:"name"`
}

type transferRequestPayload struct {
	ID       int64   `json:"id"`
	FromGate gateRef `json:"from_gate"`
	ToGate   gateRef `json:"to_gate"`
	Amount   int16   `json:"amount"`
}

type listTransferRequestsResponse struct {
	Message string                   `json:"message"`
	Data    []transferRequestPayload `json:"data"`
}

type messageResponse struct {
	Message string `json:"message"`
}
