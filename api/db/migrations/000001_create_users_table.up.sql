CREATE TABLE IF NOT EXISTS users (
    id                bigserial    NOT NULL,
    name              varchar(255) NOT NULL,
    email             varchar(255) NOT NULL,
    email_verified_at timestamp(0) WITHOUT TIME ZONE NULL,
    password          varchar(255) NOT NULL,
    remember_token    varchar(100) NULL,
    created_at        timestamp(0) WITHOUT TIME ZONE NULL,
    updated_at        timestamp(0) WITHOUT TIME ZONE NULL,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_unique UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    email      varchar(255) NOT NULL,
    token      varchar(255) NOT NULL,
    created_at timestamp(0) WITHOUT TIME ZONE NULL,
    CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (email)
);

CREATE TABLE IF NOT EXISTS sessions (
    id            varchar(255) NOT NULL,
    user_id       bigint       NULL,
    ip_address    varchar(45)  NULL,
    user_agent    text         NULL,
    payload       text         NOT NULL,
    last_activity integer      NOT NULL,
    CONSTRAINT sessions_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS sessions_user_id_index ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_last_activity_index ON sessions (last_activity);
