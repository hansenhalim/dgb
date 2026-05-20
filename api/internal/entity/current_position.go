package entity

type CurrentPosition int

const (
	CurrentPositionUnknown CurrentPosition = iota
	CurrentPositionOutside
	CurrentPositionVilla1
	CurrentPositionInTransit
	CurrentPositionVilla2
	CurrentPositionExclusive
)

// CheckinPositionForGate is the gate→position rule a visit transitions to at
// check-in time. Mirrors Laravel's CurrentPosition::getCheckinPosition. Returns
// CurrentPositionUnknown for gates that are not valid checkin gates (e.g. 4);
// callers should treat that as a 400 / invalid input.
func CheckinPositionForGate(gateID int16) CurrentPosition {
	switch gateID {
	case 1, 2:
		return CurrentPositionVilla1
	case 3:
		return CurrentPositionVilla2
	default:
		return CurrentPositionUnknown
	}
}

func CheckoutPositionForGate(gateID int16) CurrentPosition {
	switch gateID {
	case 1, 2, 3:
		return CurrentPositionOutside
	default:
		return CurrentPositionUnknown
	}
}

func TransitPositionForGate(gateID int16) CurrentPosition {
	switch gateID {
	case 2, 3:
		return CurrentPositionInTransit
	case 4:
		return CurrentPositionVilla2
	default:
		return CurrentPositionUnknown
	}
}

func TransitEnterPositionForGate(gateID int16) CurrentPosition {
	switch gateID {
	case 2:
		return CurrentPositionVilla1
	case 3:
		return CurrentPositionVilla2
	case 4:
		return CurrentPositionExclusive
	default:
		return CurrentPositionUnknown
	}
}
