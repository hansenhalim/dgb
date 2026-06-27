CREATE TABLE IF NOT EXISTS telescope_entries (
    sequence                bigserial    NOT NULL,
    uuid                    uuid         NOT NULL,
    batch_id                uuid         NOT NULL,
    family_hash             varchar(255) NULL,
    should_display_on_index boolean      NOT NULL DEFAULT true,
    type                    varchar(20)  NOT NULL,
    content                 text         NOT NULL,
    created_at              timestamp(0) WITHOUT TIME ZONE NULL,
    CONSTRAINT telescope_entries_pkey PRIMARY KEY (sequence),
    CONSTRAINT telescope_entries_uuid_unique UNIQUE (uuid)
);

CREATE INDEX IF NOT EXISTS telescope_entries_batch_id_index ON telescope_entries (batch_id);
CREATE INDEX IF NOT EXISTS telescope_entries_family_hash_index ON telescope_entries (family_hash);
CREATE INDEX IF NOT EXISTS telescope_entries_created_at_index ON telescope_entries (created_at);
CREATE INDEX IF NOT EXISTS telescope_entries_type_should_display_on_index_index ON telescope_entries (type, should_display_on_index);

CREATE TABLE IF NOT EXISTS telescope_entries_tags (
    entry_uuid uuid         NOT NULL,
    tag        varchar(255) NOT NULL,
    CONSTRAINT telescope_entries_tags_pkey PRIMARY KEY (entry_uuid, tag),
    CONSTRAINT telescope_entries_tags_entry_uuid_foreign FOREIGN KEY (entry_uuid) REFERENCES telescope_entries (uuid) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS telescope_entries_tags_tag_index ON telescope_entries_tags (tag);

CREATE TABLE IF NOT EXISTS telescope_monitoring (
    tag varchar(255) NOT NULL,
    CONSTRAINT telescope_monitoring_pkey PRIMARY KEY (tag)
);
