
const pkg = require('./package.json')
const express = require('express')

/**
 * Handler http server
 */
class HttpServerHandler {   

    constructor(options) {
        // Inicializa el app express para atender peticiones http
        this.server = express();
        this.port = process.env.HTTP_SERVER_PORT || 9021;

        // Default endpoint, show application basic info
        this.server.get('/', (req, res) => {
            res.send(`${pkg.name} ${pkg.version}`);
        });
           
        this.server.listen(this.port, () => {
            console.log(`Listening on port ${this.port}`)
        });

        this.options = options;
    }
}

module.exports = new HttpServerHandler()