package controller

type gateItem struct {
	ID           int16  `json:"id"`
	Name         string `json:"name"`
	CurrentQuota int16  `json:"current_quota"`
	IsAvailable  bool   `json:"is_available"`
}

type listGatesResponse struct {
	Message string     `json:"message"`
	Data    []gateItem `json:"data"`
}

type pulseGateRequest struct {
	VisitID   string `json:"visit_id" validate:"required,uuid"`
	Direction string `json:"direction" validate:"required,oneof=in out"`
}
