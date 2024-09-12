const healthcheck = require('@hmcts/nodejs-healthcheck');
const express = require('express');
const amqp = require('amqplib');
const app = express();
var promise = require('bluebird'),
    pgp = require('pg-promise')(pgOptions),
    pgOptions = {
        promiseLib: promise,
    },
    fs = require('fs'),
    yaml = require('js-yaml'),
    databases = {},
    db,
    dbopts;


/**
 * Gestiona el heakthcheck de la aplicación
 */
class HealthcheckHandler {

    /**
     * {server: express instance}
     * @param {object} options 
     */
    constructor(options) {
        var config = {};
        // Load the config file
        try {
            config = yaml.safeLoad(fs.readFileSync('config.yaml', 'utf8'));
        } catch (e) {
            console.log('error', e);
        }
        
        // We need the databases loaded
        if (config.databases) {
            // console.log("🚀 ~ HealthcheckHandler ~ constructor ~ config.databases:", config.databases)
            databases = Object.keys(config.databases)
            .reduce(function (a, b) {
                var c = config.databases[b];
                if (c.enabled) {
                    dbopts = {
                        host: c.host,
                        port: c.port ? c.port : 5432,
                        database: c.database,
                        user: c.user,
                        password: c.password,
                        ssl: typeof c.ssl === "boolean" ? c.ssl :  {
                            // @see https://stackoverflow.com/questions/76899023/rds-while-connection-error-no-pg-hba-conf-entry-for-host
                            rejectUnauthorized: false
                        },
                        query_timeout: 1000 * 5
                    };

                    // Creating a new database instance from the connection details:
                    // db = pgp(dbopts);
                    db = a[b] = pgp(dbopts);
                }
                return a;
            }, {});
        }

        this.options = options;   
        const configHealth = {
            checks: {
              // mySimpleWebCheck: healthcheck.web("https://example.com/status"),
              /* myComplexWebCheck: healthcheck.web("https://example.com/other", {
                callback: (err, res) => {
                  return res.body.status == "good" ? healthcheck.up() : healthcheck.down()
                },
                timeout: 5000,
                deadline: 10000,
              }), */
              databaseConnection: healthcheck.raw(() => {
                //
                return this.checkDatabaseConnection(db, databases)
              }),
              rabbitConnection: healthcheck.raw(() => {
                return this.checkRabbitmqConnection(config.rabbit) // ? healthcheck.up() : healthcheck.down() 
            })
            },
            readinessChecks: {
                rabbitNotifyChannel: healthcheck.raw(() => {
                    return this.checkNotifyChannel(config.rabbit) ? healthcheck.up() : healthcheck.down()
                })
            },
            buildInfo: {
              myCustomBuildInfo: "healthcheck"
            }
        };
        healthcheck.addTo(this.options.server, configHealth);
    }

    // Lógica personalizada, por ejemplo, verificar la conexión a una base de datos
    checkDatabaseConnection = async (db, databases) => {
        try {
            var sco = await db.connect({
                direct: true,
                allowExitOnIdle: true
            });
            
            if (sco.client.connectionParameters.database) {                
                console.log(`[HEALTHCHECK: db connected] ${JSON.stringify(sco.client.connectionParameters.database)}` )
                // gestiona la desconexión de base de datos
                if(databases){
                    Object.keys(databases).forEach( (dbname) => {
                        try {
                            process.stdout.write(`[database.disconnecting] ${dbname}...`);
                            databases[dbname].$pool.end()
                            // process.stdout.write(`${logger.FGGREEN}OK${logger.BGRESET}`)
                        } catch (error) {
                            console.log("🚀 ~ Object.keys ~ error:", error)
                        }
                    })
                }
                return healthcheck.up()
            } else {
                console.log(`[HEALTHCHECK: db not connected] ${JSON.stringify(sco)}`)
                return healthcheck.down()
            }

        } catch (error) {
            console.log("🚀 ~ HealthcheckHandler ~ checkDatabaseConnection= ~ error:", error) 
            return healthcheck.down()
        }
    };

    // verificar conexion con rabbitmq
    rabbitmqConnection = async (url) => {
        var res;
        try {
            res = await amqp.connect(url, {
                clientProperties: {
                    // Show what this connection is for in management
                    connection_name: 'Notify '
                }
            })
            console.log(`[amqp.connected] (${url})`);
            res.close();
            return true;

        } catch (error) {
            // console.log("🚀 ~ HealthcheckHandler ~ rabbitmqConnection= ~ error:", error)
            // res.close();
            console.log(`[amqp.close] (${url})`);
            return false;
        }
    }

    // verificar conexion con rabbitmq
    checkRabbitmqConnection = async (configRabbit) => {
        var self = this;
        var flag = false;

        for (const key in configRabbit) {
            if (Object.hasOwnProperty.call(configRabbit, key)) {
                const url = configRabbit[key];
                let val = await self.rabbitmqConnection(url)
                if(val){
                    console.log('---RETORNA Exitoso [rabbit]----');
                    flag = true
                } else {
                    flag = false
                }
            }
        }
        // console.log('All done!');
        // console.log("🚀 ~ HealthcheckHandler ~ Object.values ~ flag:", flag)
        return flag ? healthcheck.up() : healthcheck.down()        
    }

    // verificar el canal de prueba usado en el notify
    checkNotifyChannel = async (configRabbit) => {
        for (const key in configRabbit) {
            if (Object.hasOwnProperty.call(configRabbit, key)) {
                const url = configRabbit[key];

                let conn = await amqp.connect(url, {
                    clientProperties: {
                        // Show what this connection is for in management
                        connection_name: 'Notify '
                    }
                })

                let channel = await conn.createConfirmChannel()
                // console.log("🚀 ~ HealthcheckHandler ~ checkNotifyChannel= ~ channel:", channel)

                try {
                    channel.assertQueue('task_queue', {
                        durable: true
                    });
                    return true

                } catch (error) {
                    console.log("🚀 ~ HealthcheckHandler ~ checkNotifyChannel= ~ error:", error)
                    return false                    
                }
            }
        }
    }    
}

module.exports = HealthcheckHandler