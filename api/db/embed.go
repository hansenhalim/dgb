package db

import "embed"

// MigrationsFS holds the golang-migrate SQL migration files embedded into the
// binary so they ship inside the scratch image and run on startup.
//
//go:embed migrations/*.sql
var MigrationsFS embed.FS
