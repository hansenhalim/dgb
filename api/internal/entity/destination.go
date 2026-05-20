package entity

type Position int

const (
	PositionUnknown Position = iota
	PositionVilla1
	PositionVilla2
	PositionExclusive
)

type Destination struct {
	Name     string
	Position Position
}
