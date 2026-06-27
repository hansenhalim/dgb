CREATE TABLE IF NOT EXISTS cache (
    key        varchar(255) NOT NULL,
    value      text         NOT NULL,
    expiration integer      NOT NULL,
    CONSTRAINT cache_pkey PRIMARY KEY (key)
);

CREATE TABLE IF NOT EXISTS cache_locks (
    key        varchar(255) NOT NULL,
    owner      varchar(255) NOT NULL,
    expiration integer      NOT NULL,
    CONSTRAINT cache_locks_pkey PRIMARY KEY (key)
);
