package controller

type cardStockPayload struct {
	Available int64 `json:"available"`
	Total     int64 `json:"total"`
}

type visitsPayload struct {
	Active int64 `json:"active"`
	Total  int64 `json:"total"`
}

type homeData struct {
	CardStock cardStockPayload `json:"cardStock"`
	Visits    visitsPayload    `json:"visits"`
}

type homeResponse struct {
	Message string   `json:"message"`
	Data    homeData `json:"data"`
}
