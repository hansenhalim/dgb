FROM postgres:18

RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-18-pglogical \
    && rm -rf /var/lib/apt/lists/*

COPY init-pglogical.sql /docker-entrypoint-initdb.d/init-pglogical.sql

CMD ["postgres", "-c", "wal_level=logical", "-c", "shared_preload_libraries=pglogical", "-c", "track_commit_timestamp=on"]