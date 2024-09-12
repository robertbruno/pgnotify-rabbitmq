
const winston = require('winston')

/**
 * Handler http server
 */
class LoggerHandler {

    constructor() {
        this.logger = winston.createLogger({
            level: process.env.NODE_ENV === 'production' ? 'error' : 'info',
            format: winston.format.simple(),
            transports: [
                new winston.transports.Console()
            ]
        });

        this.FGGREEN = "\x1b[32m";
        this.BGRESET = "\x1b[0m";
    }

    log () {
        this.logger.log.apply(this.logger, arguments)
    }

    error () {
        this.logger.error.apply(this.logger, arguments)
    }

    /**
     * Obtiene el nombre y mensajes acorde a un número de error
     */
    errorKey (code) {
        let key = '';

        switch (code) {
            case 10:
                key = 'SIGINT'
                break;
            case 13:
                key = 'UNDEFINED_DATABASE_ERROR'
                break;
            case 14:
                key = 'NOTIFY_TEST_INTERVAL_TIMEOUT'
                break;
            case 20:
                key = 'NOTIFY_TEST_INTERVAL_ERROR'
                break;
            case 15:
                key = 'DB_ACK_ERROR'
                break;
            case 16:
                key = 'DB_CONNECTION_ERROR'
                break;

            case 21:
                key = 'RMB_CHANNEL_ERROR'
                break;

            case 22:
                key = 'RMB_CHANNEL_CLOSE'
                break;

            case 23:
                key = 'RMB_CONNECTION_ERROR'
                break;

            default:
                break;
        }

        return `code: ${code} key: ${key}`
    }
}

module.exports = new LoggerHandler()