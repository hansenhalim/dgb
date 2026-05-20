package httperror

type APIError struct {
	Status  int
	Message string
}

func (e *APIError) Error() string {
	return e.Message
}

func New(status int, message string) *APIError {
	return &APIError{Status: status, Message: message}
}
