CREATE TABLE IF NOT EXISTS staff (
    id         uuid         NOT NULL DEFAULT uuidv7(),
    role       varchar(255) NOT NULL,
    name       varchar(255) NOT NULL,
    secret_key varchar(255) NOT NULL,
    created_at timestamp(0) WITHOUT TIME ZONE NULL,
    updated_at timestamp(0) WITHOUT TIME ZONE NULL,
    CONSTRAINT staff_pkey PRIMARY KEY (id),
    CONSTRAINT staff_role_check CHECK (role IN ('GRD', 'MAN'))
);
