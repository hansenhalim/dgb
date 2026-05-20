package controller

type destinationItem struct {
	Name     string `json:"name"`
	Position string `json:"position"`
}

type listDestinationsResponse struct {
	Message string            `json:"message"`
	Data    []destinationItem `json:"data"`
}
