package database

import (
	"database/sql"
	"errors"
	"fmt"
	"io/fs"

	"github.com/golang-migrate/migrate/v4"
	migratepg "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

// Migrate applies all pending up migrations from the embedded filesystem,
// replicating Laravel's `php artisan migrate --force`. It is a no-op when the
// schema is already up to date. The migrations are idempotent (IF NOT EXISTS),
// so the first run against an already-provisioned database is safe.
func Migrate(sqlDB *sql.DB, migrations fs.FS) error {
	source, err := iofs.New(migrations, "migrations")
	if err != nil {
		return fmt.Errorf("migration source: %w", err)
	}

	driver, err := migratepg.WithInstance(sqlDB, &migratepg.Config{})
	if err != nil {
		return fmt.Errorf("migration driver: %w", err)
	}

	m, err := migrate.NewWithInstance("iofs", source, "postgres", driver)
	if err != nil {
		return fmt.Errorf("init migrator: %w", err)
	}

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("apply migrations: %w", err)
	}

	return nil
}
