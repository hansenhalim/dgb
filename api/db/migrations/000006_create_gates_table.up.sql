CREATE TABLE IF NOT EXISTS gates (
    id            smallserial  NOT NULL,
    name          varchar(255) NOT NULL,
    current_quota smallint     NOT NULL,
    created_at    timestamp(0) WITHOUT TIME ZONE NULL,
    updated_at    timestamp(0) WITHOUT TIME ZONE NULL,
    CONSTRAINT gates_pkey PRIMARY KEY (id)
);
