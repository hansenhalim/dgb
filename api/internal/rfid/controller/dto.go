package controller

type getRfidKeyQuery struct {
	UID string `query:"uid" validate:"required,len=8,hexadecimal"`
}

type getRfidKeyResponse struct {
	Message string `json:"message"`
	RfidKey string `json:"rfid_key"`
}
