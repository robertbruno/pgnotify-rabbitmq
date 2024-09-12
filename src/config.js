/*
 * config.js  Handles our yaml style configuration
 */

// Prefix for errors code
const ERROR_PREFIX = 10;

// Logger Handler
const logger =  require('./LoggerHandler')

// Http Server Handler
const httpserver = require('./HttpServerHandler')

// Healthcheck Handler
const HealthcheckHandler = require('./HealthcheckHandler')
const healthcheck =  new HealthcheckHandler({server: httpserver.server})

// Metrics Handler
const MetricsHandler = require('./MetricsHandler')
const metrics =  new MetricsHandler({server: httpserver.server})

// tests channel name
const NOTIFY_TEST_CHANNEL_PREFIX  =  process.env.NOTIFY_TEST_CHANNEL_PREFIX  || 'checkConn'
const NOTIFY_TEST_TIMEOUT  =  process.env.NOTIFY_TEST_TIMEOUT  ||  1000 * 10
const NOTIFY_TEST_INTERVAL =  process.env.NOTIFY_TEST_INTERVAL ||  1000 * 5
const MAX_DB_INTENTS = process.env.MAX_DB_INTENTS || 10;

var fs = require('fs'),
    promise = require('bluebird'),
    DB_INTENTS_COUNT = 0,
    checkConnList = [],
    checkConnResultsList = [],
    yaml = require('js-yaml'),
    pgp = require('pg-promise')(options),
    options = {
        promiseLib: promise,
        // global event notification for pg_promise;
        error: function (error, e) {
            if (e.cn) {
                // A connection-related error;
                // Connections are reported back with the password hashed,
                // for safe errors logging, without exposing passwords.
                logger.log('error',["CN:", e.cn]);
                logger.log('error',["EVENT:", error.message || error]);
            }
        }
    };

var config = {},
    databases = {};

// Cierra la aplicación de forma seguro
const safelyClose = async (errorNumber = 0, errorMessage="") => {
    // gestiona los mensages de error
    const errorKey = logger.errorKey(errorNumber)
    metrics.errorCounter.inc({key: errorKey})
    console.log(`[${errorKey}] ${errorMessage}`)
    
    // gestiona la desconexión de base de datos
    if(databases){
        Object.keys(databases).forEach( (dbname) => {
            try {
                process.stdout.write(`[database.disconnecting] ${dbname}...`);
                databases[dbname].$pool.end()
                process.stdout.write(`${logger.FGGREEN}OK${logger.BGRESET}`)
            } catch (error) {
                console.log("🚀 ~ Object.keys ~ error:", error)
            }
        })
    }

    setTimeout(() => {
        metrics.clean()
        process.exit(errorNumber)
    }, 1000 * 2);
}

function $main(options) {
    // Load the config file
    try {
        config = yaml.safeLoad(fs.readFileSync(
                options.config ? options.config : 'config.yaml',
                'utf8'));
    } catch (e) {
        logger.log('error', e);
    }

    // We need the databases loaded
    if (options.databases && config.databases) {
        databases = Object.keys(config.databases)
        .reduce(function (a, b) {
                var c = config.databases[b];
                if (c.enabled) {
                    const dbopts = {
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
                    a[b] = pgp(dbopts);
                }
                return a;
            }, {});
        // console.log("🚀 ~ $main ~ databases:", databases)
    }

    // listenres para cerrar las conexiones a base de datos
    process.once('SIGINT', (signalnro) => {
        logger.log('info',`${signalnro} received`);
        safelyClose(ERROR_PREFIX)
    });

    return {
        // Link to the pg-promise databases
        db: databases,
        // Link to the configuraton
        config: config,
        // Link to enable notify code
        notify: notify,
        // function to safe close
        safelyClose
    };
}

/**
 * Gestiona la sección notify del yml
 * @param {array} handlers
 */
function notify(handlers) {
    const fn = arguments.callee;

    if (config.notify) {
        config.notify
            .filter(function (n) {
                return n.enabled === true;
            })
            .reduce(function (a, n) {
                logger.log('info',`[config.notify]  ${JSON.stringify(n)}`)
                const db = databases[n.database];

                // Add any handlers
                let actions;

                if (typeof n.handlers === "string") {
                  actions = [handlers[n.handlers](config, n)];
                } else {
                  actions = n.handlers ? Object.keys(handlers)
                  .filter(function (b) {
                      return n.handlers[b];
                  })
                  .reduce(function (a, b) {
                      // Call the handler with config, listener and the handler's config
                      // expect a function back that accepts the payload or null to ignore
                      var f = handlers[b](config, n, n.handlers[b]);
                      if (f)
                          a.push(f);
                      return a;
                  }, [])
                  : [];
                }

                logger.log('info', `[config.notify.actions] ${JSON.stringify(actions)}`);

                if (actions && actions.length) {
                    if(!db){
                        safelyClose(
                            ERROR_PREFIX+3,
                            `Not database (${ex.database}) found in config.yaml`
                        )
                    }

                const dbconnHandler = function () {
                    db.connect({
                        direct: true,
                        allowExitOnIdle: true
                    }).then(function (sco) {
                        console.log(`[${n.name}][db connected] ${JSON.stringify(sco.client.connectionParameters)}` )

                        const test_channel_name = `${NOTIFY_TEST_CHANNEL_PREFIX}@${n.name}`

                        // listen for check conn tests
                        sco.none('LISTEN $1~', test_channel_name);

                        // procesa los mensajes pendientes sin ack
                        if(process.env.HANDLE_ACK){
                            setTimeout(() => {
                                sco.client.query('SELECT pgnotify_rabbitmq.handle_ack();').catch((error) => {
                                    logger.log('warn',`[${n.database}] ${error.message}`)
                                })
                            }, 1000);
                        }

                        const checkConnHandler = () => {

                            if(checkConnList[test_channel_name]){
                                clearInterval(checkConnList[test_channel_name])
                            }
                            // detect connection problems
                            checkConnList[test_channel_name] = setInterval(() => {
                                sco.client.query(`SELECT pg_notify('${test_channel_name}', '' || now())`)
                                .catch((error) => {
                                    safelyClose(ERROR_PREFIX+10, `[${test_channel_name}] ${error.message}`)
                                })

                                if(checkConnResultsList[test_channel_name]){
                                    clearTimeout(checkConnResultsList[test_channel_name])
                                }

                                checkConnResultsList[test_channel_name] = setTimeout(() => {
                                    // si el notify no se recibe se arrojará un error
                                    // asumiendo que se trata de algun problema de conexión
                                    safelyClose(ERROR_PREFIX+4, `[${test_channel_name}]`)
                                }, NOTIFY_TEST_TIMEOUT);
                            }, NOTIFY_TEST_INTERVAL);
                        }

                        checkConnHandler();

                        sco.client.on('notification', function (data) {
                            try {
                                let payload = data.payload;
                                let msgID = null;
                                const notify = data.channel;

                                if(notify.indexOf(NOTIFY_TEST_CHANNEL_PREFIX) >= 0){
                                    const realChannelName =  notify.replace(`${NOTIFY_TEST_CHANNEL_PREFIX}@`,'')
                                    if(checkConnResultsList[notify]){
                                        clearTimeout(checkConnResultsList[notify])
                                        logger.log('info',`[${realChannelName}] [check] OK`)
                                    }else{
                                        logger.log('info',`[${realChannelName}] [check] Dirty`)
                                    }
                                    return
                                }

                                // Optional debug, log the message as we receive it
                                if (n.debug)
                                    logger.log('info','Notify:\t' + Object.keys(data)
                                        .reduce(function (a, b) {
                                            a.push([b, data[b]].join(b.length < 8 ? '\t\t' : '\t'));
                                            return a;
                                        }, [])
                                        .join('\n\t'));


                                // Getting and cleaning message id
                                if(payload.indexOf('ID:') === 0){
                                    const parts = payload.split('|')
                                    msgID =  parts.slice(0, 1)[0].replace('ID:', '')
                                    payload = parts.slice(1).join()
                                }

                                // The payload, either string or json as per config
                                payload = n.json ? JSON.parse(payload) : payload;

                                actions.forEach( (f) => {
                                    f(payload).then(()=>{

                                        // settings message metrics
                                        metrics.messageCounter.inc({notify})

                                        // send ack
                                        if(msgID){
                                            sco.query("SELECT pgnotify_rabbitmq.ack($1)", msgID)
                                            .then(()=>{

                                                logger.log('info',`[${notify}][ack] ID:${logger.FGGREEN}${msgID}${logger.BGRESET}`)

                                                // settings ack metrics
                                                metrics.ackCounter.inc({notify})

                                                // Si la petición se ejecta correctamente
                                                // limpiamos el intervalo de checking de conexión
                                                checkConnHandler()
                                            })
                                            .catch((ex)=>{
                                                safelyClose(ERROR_PREFIX+5, ex.message)
                                            });
                                        }
                                    }).catch((ex)=>{
                                        logger.log('error',ex.message)
                                    })
                                });

                            } catch (ex) {
                                logger.log('error', `[on notify] ${ex.message}`);
                            }
                        });
                        return sco.none('LISTEN $1~', n.name);
                    })
                    .catch(function (ex) {

                        if(DB_INTENTS_COUNT >= MAX_DB_INTENTS ){
                            safelyClose(ERROR_PREFIX+6, ex.message)
                        }else{
                            console.log(ex.message)
                            DB_INTENTS_COUNT++;
                            setTimeout(() => {
                                dbconnHandler()
                            }, 1000 * DB_INTENTS_COUNT);
                        }
                    });
                }

                setTimeout(() => {
                    dbconnHandler()
                }, 300);

                }else{
                    console.warn('not handlers defined in config.yaml')
                }

                return a;
            }, {});
    }
}

module.exports = $main;