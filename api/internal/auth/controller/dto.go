package controller

type verifyPinRequest struct {
	UID string `json:"uid" validate:"required,len=8,hexadecimal"`
	PIN string `json:"pin" validate:"required,len=6,numeric"`
}

type verifySecretRequest struct {
	UID        string `json:"uid" validate:"required,len=8,hexadecimal"`
	SecretKey  string `json:"secret_key" validate:"required,len=1024,hexadecimal"`
	DeviceName string `json:"device_name" validate:"required,max=255"`
}

type verifyPinResponse struct {
	Message string `json:"message"`
	RfidKey string `json:"rfid_key"`
}

type verifySecretResponse struct {
	Message    string `json:"message"`
	Token      string `json:"token"`
	ValidUntil string `json:"valid_until"`
}
