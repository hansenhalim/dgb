CREATE TABLE IF NOT EXISTS rfids (
    id            smallserial  NOT NULL,
    uid           bytea        NOT NULL,
    key           bytea        NOT NULL,
    pin           varchar(255) NULL,
    rfidable_type varchar(255) NULL,
    rfidable_id   uuid         NULL,
    created_at    timestamp(0) WITHOUT TIME ZONE NULL,
    updated_at    timestamp(0) WITHOUT TIME ZONE NULL,
    CONSTRAINT rfids_pkey PRIMARY KEY (id),
    CONSTRAINT rfids_uid_unique UNIQUE (uid)
);

CREATE INDEX IF NOT EXISTS rfids_rfidable_type_rfidable_id_index ON rfids (rfidable_type, rfidable_id);
