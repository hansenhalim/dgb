CREATE TABLE IF NOT EXISTS notifications (
    id              uuid         NOT NULL,
    type            varchar(255) NOT NULL,
    notifiable_type varchar(255) NOT NULL,
    notifiable_id   bigint       NOT NULL,
    data            json         NOT NULL,
    read_at         timestamp(0) WITHOUT TIME ZONE NULL,
    created_at      timestamp(0) WITHOUT TIME ZONE NULL,
    updated_at      timestamp(0) WITHOUT TIME ZONE NULL,
    CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS notifications_notifiable_type_notifiable_id_index ON notifications (notifiable_type, notifiable_id);
