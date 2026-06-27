CREATE TABLE IF NOT EXISTS destinations (
    name       varchar(30)  NOT NULL,
    "position" varchar(255) NOT NULL,
    created_at timestamp(0) WITHOUT TIME ZONE NULL,
    updated_at timestamp(0) WITHOUT TIME ZONE NULL,
    CONSTRAINT destinations_pkey PRIMARY KEY (name),
    CONSTRAINT destinations_position_check CHECK ("position" IN ('VIL_1', 'VIL_2', 'VIL_E'))
);
