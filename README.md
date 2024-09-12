# pgnotify-rabbitmq

🇪🇸 [Go to spanish version](docs/README_ES.md)

## Introduction
This is a simple nodejs application that allows PostgreSQL to send messages to a RabbitMQ server using [NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html).

For example, in SQL you can run the following query:

```sql
SELECT pgnotify_rabbitmq.send('rabbit', 'hola!');
```

This application will then immediately send a message to a RabbitMQ topic with that message to a configured routing key.
You can then have an application listen for messages with that key and process those events immediately.

Some structure and elements are expected in the database which you need to create by running the following script:

* [scripts/pgnotify-rabbitmq.sql](scripts/pgnotify-rabbitmq.sql)

Every time the application starts it will execute the function `"pgnotify_rabbitmq"."handle_ack"()` with the intention of processing messages without ack.

> For more info see:
> * [Database Functions](docs/DBFUNCTION.md)

## Build Docker Compose

```bash
docker compose -f docker-compose-dev.yml  up --build
```
> You must wait for at least 5 seconds for Rabbitmq to start.

## Configuration

You need to provide a [config.yaml](src/config.yaml) file containing details about your database - a template is provided in the repository.

It consists of three sections:

### databases
This section contains connection details to connect to your databases:

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

> You need to run the scripts [scripts/pgnotify-rabbitmq.sql](scripts/pgnotify-rabbitmq.sql) in each database.
> Here we have just one database configured called testDB which will be referred to later.

### rabbit
This section defines details of the rabbitmq instances you want to connect to.
It simply consists of a name for the instance and the connection URI to connect to it.

```yml
rabbit:
    testRabbit: amqp://guest:password@localhost
```

Note: You can put an IP address here instead of the hostname.
If it's an IPv6 address then wrap it within a pair of [ ].

### notify
This section defines which databases you want to listen to for notifications.
You usually have one entry per database (but you are not limited to this).

#### Simple messages

```yml
notify:
    -
        enabled: true
        database: testdb
        name: rabbit
        handlers:
            rabbit:
                instance: testRabbit
                key: job.status
```

Here we are telling the application to listen for notifications sent to the 'rabbit' queue on the testdb database.
All messages received would be sent as-is to the testRabbit RabbitMQ instance with the routing key 'job.status'.

Then from PostgreSQL you can use:

```bash
echo -e "SELECT pgnotify_rabbitmq.send('rabbit','hola');" | docker exec -i pgnotify-rabbitmq-postgresql-1 psql -U postgres
```

to send the message.

#### Set the routing key in PostgreSQL

This is a simple case, you can allow PostgreSQL to define the routing key:

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

Here we are telling the application to expect a JSON object from PostgreSQL with two properties.
* "key" will contain the routing key to use
* "body" will contain the message to send.

```bash
echo "SELECT SELECT pgnotify_rabbitmq.send('rabbit','{\"key\":\"key.test\",\"body\": \"My message\"}');" docker exec -i pgnotify-rabbitmq-postgresql-1 psql -U postgres
```

> Note: "payload" is optional here. If absent then the original message will be sent including the routing key etc.

## Environment

You can use environment variables to configure the service, for more info about it see:

* [src/templates/config.yaml.template](src/templates/config.yaml.template)

> To avoid conflicts in configuration files, if you want to use environment variables you must specify USE_TEMPLATE to true

Optional you can set `HANDLE_ACK` Environment variable to run `SELECT pgnotify_rabbitmq.handle_ack();` at app startup.

## Running docker

To run first create a config.yaml file with your configuration then run:

```bash
docker run -d -v $(pwd)/config.yaml:/opt/config.yaml registry.sigis.com.ve/gdt/pgnotify-rabbitmq:latest
```

## Monitoring with Prometheus and Grafana.

[Prometheus](https://prometheus.io/) It logs real-time metrics to a time-series database built using an HTTP pull model, with flexible queries and real-time alerts.
[Grafana](https://grafana.com/) that allows the display and formatting of metric data. Allows you to create dashboards and graphs from multiple sources, including time series databases

You can visualize this metrics in [Grafana](https://grafana.com/) with the following dashboard:

* [scripts/grafana-dashboard.json](scripts/grafana-dashboard.json)

> For more info about metrics visit:
>
> * [Metrics docs](docs/METRICS.md)

## Automation

This project has a Jenkinsfile with the necessary instructions for the automation of tests, construction of the app.
For more information visit:

* [Jenkinsfile](Jenkinsfile)
* [Jenkins Project](https://jenkins.sigis.com.ve/job/dockers/job/pgnotify-rabbitmq/)
* [Estándares Integración Continua](http://git.sigis.com.ve/gdt/estandares-desarrollo/blob/master/docs/jenkins/jenkins.md)

## Help

* To view the change history [changelog](./src/CHANGELOG.md)
* To view or report bug's go to [issues](http://git.sigis.com.ve/librerias-desarrollo/pgnotify-rabbitmq/-/issues)
