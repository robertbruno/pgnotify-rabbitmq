# Usa la imagen oficial de PostgreSQL 17
FROM postgres:17

# Instala las dependencias necesarias
RUN apt-get update && apt-get install -y postgresql-17-cron

# Configura la extensión pg_cron
RUN echo "shared_preload_libraries='pg_cron'" >> /usr/share/postgresql/postgresql.conf.sample
RUN echo "cron.database_name='postgres'" >> /usr/share/postgresql/postgresql.conf.sample

# Configura el script de entrada para iniciar pg_cron
COPY ./docker-entrypoint-initdb.d /docker-entrypoint-initdb.d
COPY ./entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["entrypoint.sh"]
CMD ["postgres"]
