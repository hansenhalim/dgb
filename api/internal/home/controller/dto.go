package controller

type getHomeQuery struct {
	GateID int16 `query:"gate_id" validate:"required,gt=0"`
}

type cardStockPayload struct {
	Available int64 `json:"available"`
	Total     int64 `json:"total"`
}

type visitsPayload struct {
	Active int64 `json:"active"`
	Total  int64 `json:"total"`
}

type homeData struct {
	CardStock                  cardStockPayload `json:"cardStock"`
	Visits                     visitsPayload    `json:"visits"`
	HasIncomingTransferRequest bool             `json:"has_incoming_transfer_request"`
}

type homeResponse struct {
	Message string   `json:"message"`
	Data    homeData `json:"data"`
}
