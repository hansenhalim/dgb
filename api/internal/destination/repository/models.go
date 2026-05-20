package repository

type destination struct {
	Name     string `gorm:"column:name;primaryKey"`
	Position string `gorm:"column:position"`
}

func (destination) TableName() string { return "destinations" }
