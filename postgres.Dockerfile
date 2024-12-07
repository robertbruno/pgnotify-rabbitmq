# Usa la imagen oficial de PostgreSQL 17
FROM postgres:17

# Instala las dependencias necesarias
RUN apt-get update && apt-get install -y postgresql-17-cron

# Configura la extensión pg_cron
RUN echo "shared_preload_libraries='pg_cron'" >> /usr/share/postgresql/postgresql.conf.sample
RUN echo "cron.database_name='postgres'" >> /usr/share/postgresql/postgresql.conf.sample

COPY scripts/pgnotify-rabitmq-width-rules-in-db.sql /docker-entrypoint-initdb.d/pgnotify-rabitmq-width-rules-in-db.sql

