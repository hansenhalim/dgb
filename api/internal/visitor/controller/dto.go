package controller

type getVisitorStatusQuery struct {
	IdentityNumber string `query:"identity_number" validate:"required"`
}

type visitPayload struct {
	ID                 string `json:"id"`
	VehiclePlateNumber string `json:"vehicle_plate_number"`
	PurposeOfVisit     string `json:"purpose_of_visit"`
	DestinationName    string `json:"destination_name"`
	CreatedAt          string `json:"created_at"`
}

type visitorPayload struct {
	ID           string        `json:"id"`
	Fullname     string        `json:"fullname"`
	BannedAt     *string       `json:"banned_at"`
	BannedReason *string       `json:"banned_reason"`
	LatestVisit  *visitPayload `json:"latest_visit"`
}

type getVisitorStatusResponse struct {
	Message string         `json:"message"`
	Data    visitorPayload `json:"data"`
}

type createVisitData struct {
	ID          string `json:"id"`
	CurrentArea string `json:"current_area"`
	UpdatedAt   string `json:"updated_at"`
}

type createVisitResponse struct {
	Message string          `json:"message"`
	Data    createVisitData `json:"data"`
}

type gateOnlyRequest struct {
	GateID int16 `json:"gate_id" validate:"required,gt=0"`
}

type messageResponse struct {
	Message string `json:"message"`
}

type visitStateData struct {
	CurrentArea string `json:"current_area"`
	UpdatedAt   string `json:"updated_at"`
}

type visitStateResponse struct {
	Message string         `json:"message"`
	Data    visitStateData `json:"data"`
}

type getVisitHistoryQuery struct {
	GateID int16 `query:"gate_id" validate:"required,gt=0"`
}

type visitHistoryItem struct {
	ID                 string `json:"id"`
	VehiclePlateNumber string `json:"vehicle_plate_number"`
	CurrentPosition    string `json:"current_position"`
	DestinationName    string `json:"destination_name"`
	CreatedAt          string `json:"created_at"`
}

type getVisitHistoryResponse struct {
	Message string             `json:"message"`
	Data    []visitHistoryItem `json:"data"`
}
