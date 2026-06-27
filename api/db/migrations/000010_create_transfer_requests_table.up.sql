CREATE TABLE IF NOT EXISTS transfer_requests (
    id                 bigserial    NOT NULL,
    status             varchar(255) NOT NULL,
    from_gate_id       smallint     NOT NULL,
    to_gate_id         smallint     NOT NULL,
    sender_staff_id    uuid         NOT NULL,
    recipient_staff_id uuid         NULL,
    amount             smallint     NOT NULL,
    responded_at       timestamp(0) WITHOUT TIME ZONE NULL,
    created_at         timestamp(0) WITHOUT TIME ZONE NULL,
    updated_at         timestamp(0) WITHOUT TIME ZONE NULL,
    CONSTRAINT transfer_requests_pkey PRIMARY KEY (id),
    CONSTRAINT transfer_requests_status_check CHECK (status IN ('PEND', 'CFRM', 'RJCT')),
    CONSTRAINT transfer_requests_from_gate_id_foreign FOREIGN KEY (from_gate_id) REFERENCES gates (id),
    CONSTRAINT transfer_requests_to_gate_id_foreign FOREIGN KEY (to_gate_id) REFERENCES gates (id),
    CONSTRAINT transfer_requests_sender_staff_id_foreign FOREIGN KEY (sender_staff_id) REFERENCES staff (id),
    CONSTRAINT transfer_requests_recipient_staff_id_foreign FOREIGN KEY (recipient_staff_id) REFERENCES staff (id)
);
