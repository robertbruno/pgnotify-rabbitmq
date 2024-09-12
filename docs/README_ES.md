# notify-rabbit

🇺🇸 [Go to english version](README.md)

## Introducción
Esta es una aplicación simple de nodejs que permite que PostgreSQL envíe mensajes a un servidor RabbitMQ usando un [NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html).

Por ejemplo, en SQL puede emitir uno de los siguientes comandos:

```sql
SELECT pgnotify_rabbitmq.send('rabbit', 'hola!');
```

Esta aplicación enviará inmediatamente un mensaje a un topic de RabbitMQ con ese mensaje a al routing key definido.
Luego puede hacer que una aplicación escuche los mensajes con dicho key y procese esos eventos de inmediato.

Se esperan algunas estructuras y elementos en la base de datos que debe crear ejecutando el siguiente script:

* [scripts/pgnotify-rabbitmq.sql](scripts/pgnotify-rabbitmq.sql)

Cada vez que se inicie la aplicación ejecutará la función `"pgnotify_rabbitmq"."handle_ack"()` con la intención de procesar mensajes sin acuse de recibo.

> Para mayor información visite:
> * [Database Functions](DBFUNCTION.md)

## Build Docker Compose

```bash
docker-compose -f docker-compose-dev.yml  up --build
```
> Debe esperar al menos 5 segundos para que se inicie Rabbitmq.

## Configuración

Debe proporcionar un archivo [config.yaml](src/config.yaml) que contenga detalles sobre su base de datos; se proporciona una plantilla en el repositorio.

Consta de tres secciones:

### databases

Esta sección contiene detalles de conexión para conectarse a sus bases de datos:

```yml
databases:
    testDB:
        enabled: true
        host: localhost
        port: 5432
        database: postgres
        user: postgres
        password: postgres
        ssl: false
```

> Necesita ejecutar los scripts[scripts/pgnotify-rabbitmq.sql](scripts/pgnotify-rabbitmq.sql) en cada base de datos.
> Aquí solo tenemos una base de datos configurada llamada postgres a la que nos referiremos más adelante.

### rabbit

Esta sección define los detalles de las instancias de rabbitmq a las que desea conectarse.
Simplemente consiste en un nombre para la instancia y el URI de conexión para conectarse a ella.

```yml
rabbit:
    testRabbit: amqp://guest:password@localhost
```

Nota: Puede poner una dirección IP aquí en lugar del nombre de host.
Si es una dirección IPv6, envuélvala dentro de un par de [].

### notify

Esta sección define qué bases de datos desea escuchar para recibir notificaciones.
Por lo general, tiene una entrada por base de datos (pero no está limitado a esto).

#### Simple messages

```yml
notify:
    -
        enabled: true
        database: testdb
        name: rabbit
        handlers:
            rabbit:
                instance: rabbit
                key: job.status
```

Aquí le estamos diciendo a la aplicación que escuche las notificaciones enviadas a la cola `'rabbit'` en la base de datos `'postgres'`.
Todos los mensajes recibidos se enviarían tal cual a la instancia de rabbit con la clave de enrutamiento `'job.status'`.

Luego, desde PostgreSQL puedes usar para enviar le mensaje:

```
echo "SELECT pgnotify_rabbitmq.send('rabbit', 'hola!');"  | \
    docker exec -i pgnotify-rabbitmq-postgresql-1 psql -U postgres
```


#### Estableciendo el routing key en PostgreSQL

Este es un caso simple, puede permitir que PostgreSQL defina la clave de enrutamiento:

```yml
notify:
    -
        enabled: true
        database: testdb
        name: rabbit
        json: true
        handlers:
            rabbit:
                instance: testRabbit
                routingKey: key
                payload: body
```

Aquí le estamos diciendo a la aplicación que espere un objeto JSON de PostgreSQL con dos propiedades.
* "key" contendrá la clave de enrutamiento a utilizar
* "body" contendrá el mensaje a enviar.
* 
```bash
echo "SELECT SELECT pgnotify_rabbitmq.send('rabbit','{\"key\":\"key.test\",\"body\": \"My message\"}');"  | \
    docker exec -i pgnotify-rabbitmq-postgresql-1 psql -U postgres
```

> Nota: "payload" es opcional aquí. Si está ausente, se enviará el mensaje original, incluida la clave de enrutamiento, etc.


Opcionalmente puede establecer la varibale de entorno `HANDLE_ACK` en true para ejecutar  `SELECT pgnotify_rabbitmq.handle_ack();` al incio del app.

## Running docker

Para ejecutar, primero cree un archivo config.yaml con su configuración y luego ejecute:

```bash
docker run -d -v $(pwd)/config.yaml:/opt/config.yaml robertbruno/pgnotify-rabbitmq:latest
```

## Monitoring with Prometheus and Grafana

[Prometheus](https://prometheus.io/) Registra métricas en tiempo real en una base de datos de series temporales creada con un modelo de extracción HTTP, con consultas flexibles y alertas en tiempo real.

[Grafana](https://grafana.com/) que permite la visualización y formateo de datos métricos. Le permite crear paneles y gráficos a partir de múltiples fuentes, incluidas bases de datos de series temporales

Puedes visualizar esta métrica en [Grafana](https://grafana.com/) con el siguiente dashboard:

* [scripts/grafana-dashboard.json](scripts/grafana-dashboard.json)

> Para mayor nformación visite:
>
> * [Metrics docs](docs/METRICS_ES.md)

## Help

* Para ver el historial de cambios ir a [changelog](./src/CHANGELOG.md)
* Para ver o reportar errores ir a [issues](https://github.com/robertbruno/pgnotify-rabbitmq/issues)