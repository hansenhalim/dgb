CREATE TABLE IF NOT EXISTS visitors (
    id              uuid         NOT NULL DEFAULT uuidv7(),
    identity_number varchar(255) NOT NULL,
    banned_at       timestamp(0) WITHOUT TIME ZONE NULL,
    banned_reason   varchar(255) NULL,
    created_at      timestamp(0) WITHOUT TIME ZONE NULL,
    updated_at      timestamp(0) WITHOUT TIME ZONE NULL,
    fullname        varchar(255) NOT NULL DEFAULT '',
    CONSTRAINT visitors_pkey PRIMARY KEY (id),
    CONSTRAINT visitors_identity_number_unique UNIQUE (identity_number)
);
