CREATE TABLE IF NOT EXISTS personal_access_tokens (
    id             uuid         NOT NULL DEFAULT uuidv7(),
    tokenable_type varchar(255) NOT NULL,
    tokenable_id   uuid         NOT NULL,
    name           text         NOT NULL,
    token          varchar(64)  NOT NULL,
    abilities      text         NULL,
    last_used_at   timestamp(0) WITHOUT TIME ZONE NULL,
    expires_at     timestamp(0) WITHOUT TIME ZONE NULL,
    created_at     timestamp(0) WITHOUT TIME ZONE NULL,
    updated_at     timestamp(0) WITHOUT TIME ZONE NULL,
    CONSTRAINT personal_access_tokens_pkey PRIMARY KEY (id),
    CONSTRAINT personal_access_tokens_token_unique UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS personal_access_tokens_tokenable_type_tokenable_id_index ON personal_access_tokens (tokenable_type, tokenable_id);
CREATE INDEX IF NOT EXISTS personal_access_tokens_expires_at_index ON personal_access_tokens (expires_at);
