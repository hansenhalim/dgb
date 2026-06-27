CREATE TABLE IF NOT EXISTS failed_import_rows (
    id               bigserial NOT NULL,
    data             json      NOT NULL,
    import_id        bigint    NOT NULL,
    validation_error text      NULL,
    created_at       timestamp(0) WITHOUT TIME ZONE NULL,
    updated_at       timestamp(0) WITHOUT TIME ZONE NULL,
    CONSTRAINT failed_import_rows_pkey PRIMARY KEY (id),
    CONSTRAINT failed_import_rows_import_id_foreign FOREIGN KEY (import_id) REFERENCES imports (id) ON DELETE CASCADE
);
