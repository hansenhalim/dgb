CREATE TABLE IF NOT EXISTS imports (
    id              bigserial    NOT NULL,
    completed_at    timestamp(0) WITHOUT TIME ZONE NULL,
    file_name       varchar(255) NOT NULL,
    file_path       varchar(255) NOT NULL,
    importer        varchar(255) NOT NULL,
    processed_rows  integer      NOT NULL DEFAULT 0,
    total_rows      integer      NOT NULL,
    successful_rows integer      NOT NULL DEFAULT 0,
    user_id         bigint       NOT NULL,
    created_at      timestamp(0) WITHOUT TIME ZONE NULL,
    updated_at      timestamp(0) WITHOUT TIME ZONE NULL,
    CONSTRAINT imports_pkey PRIMARY KEY (id),
    CONSTRAINT imports_user_id_foreign FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
