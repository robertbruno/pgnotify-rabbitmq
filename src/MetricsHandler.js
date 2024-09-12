
const Prometheus = require('prom-client')
const pkg = require('./package.json')

/**
 * Gestiona las metricas de la aplicación
 */
class MetricsHandler {   

    /**
     * {server: express instance}
     * @param {object} options 
     */
    constructor(options) {
        this.options = options;
        this.register = new Prometheus.Registry();
        this.collectDefaultMetrics = Prometheus.collectDefaultMetrics
        this.prefix = `${pkg.name.replace(new RegExp(/-/g), '_')}_`;
        this.metricsInterval = this.collectDefaultMetrics({ 
            register: this.register,
            prefix : this.prefix
        });

        this.ackCounter = new Prometheus.Counter({
            name: `${this.prefix}ack`,
            help: 'Total number of ack by notify channel',
            labelNames: ['notify'],
        })

        this.messageCounter = new Prometheus.Counter({
            name: `${this.prefix}messages`,
            help: 'Total number of messages by notify channel',
            labelNames: ['notify'],
        })

        this.errorCounter = new Prometheus.Counter({
            name: `${this.prefix}errors`,
            help: 'Total number of error by key',
            labelNames: ['key'],
        })        

        this.register.registerMetric(this.ackCounter);
        this.register.registerMetric(this.messageCounter); 
        this.register.registerMetric(this.errorCounter); 

        // Setup server to Prometheus scrapes
        if(this.options && this.options.server){
            this.options.server.get('/metrics', async (req, res) => {
                try {
                    res.set('Content-Type', this.register.contentType);
                    res.end(await this.register.metrics());
                } catch (ex) {
                    res.status(500).end(ex);
                }
            });    
        }
    }

    /**
     * Libera los recursos usados por la metricas
     */
    clean () {
        if(this.metricsInterval){
            clearInterval(this.metricsInterval)
        }
    }
}

module.exports = MetricsHandler