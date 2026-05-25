package config

import (
	"fmt"

	"github.com/joho/godotenv"
	"github.com/spf13/viper"
)

type Config struct {
	AppEnv  string
	AppPort int

	DBConnection string
	DBHost       string
	DBPort       int
	DBDatabase   string
	DBUsername   string
	DBPassword   string
	DBSSLMode    string

	JWTSecret string
	AppKey    string

	OCRURL string
}

func Load() (*Config, error) {
	_ = godotenv.Load()

	v := viper.New()
	v.AutomaticEnv()

	v.SetDefault("APP_ENV", "local")
	v.SetDefault("APP_PORT", 8080)
	v.SetDefault("DB_CONNECTION", "pgsql")
	v.SetDefault("DB_HOST", "127.0.0.1")
	v.SetDefault("DB_PORT", 5432)
	v.SetDefault("DB_SSLMODE", "disable")

	cfg := &Config{
		AppEnv:       v.GetString("APP_ENV"),
		AppPort:      v.GetInt("APP_PORT"),
		DBConnection: v.GetString("DB_CONNECTION"),
		DBHost:       v.GetString("DB_HOST"),
		DBPort:       v.GetInt("DB_PORT"),
		DBDatabase:   v.GetString("DB_DATABASE"),
		DBUsername:   v.GetString("DB_USERNAME"),
		DBPassword:   v.GetString("DB_PASSWORD"),
		DBSSLMode:    v.GetString("DB_SSLMODE"),
		JWTSecret:    v.GetString("JWT_SECRET"),
		AppKey:       v.GetString("APP_KEY"),
		OCRURL:       v.GetString("OCR_URL"),
	}

	if cfg.DBDatabase == "" {
		return nil, fmt.Errorf("DB_DATABASE is required")
	}
	if cfg.DBUsername == "" {
		return nil, fmt.Errorf("DB_USERNAME is required")
	}
	if len(cfg.JWTSecret) < 32 {
		return nil, fmt.Errorf("JWT_SECRET is required and must be at least 32 bytes")
	}
	if cfg.AppKey == "" {
		return nil, fmt.Errorf("APP_KEY is required (Laravel-style; e.g. base64:<32-byte-base64>)")
	}

	return cfg, nil
}

func (c *Config) PostgresDSN() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		c.DBHost, c.DBPort, c.DBUsername, c.DBPassword, c.DBDatabase, c.DBSSLMode,
	)
}
