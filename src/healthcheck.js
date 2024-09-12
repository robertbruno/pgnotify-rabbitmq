let data;

const http = require('http');

const HEALTHCHECK_METRICS_MATCH_REGEX=process.env.HEALTHCHECK_METRICS_MATCH_REGEX || /notify_rabbit_ack.*\ (\d+)/g
const HEALTHCHECK_ENABLED_METRICS=process.env.HEALTHCHECK_ENABLED_METRICS || 1

const options = {
    host: process.env.HEALTHCHECK_HTTP_SERVER_HOST || '127.0.0.1',
    path: process.env.HEALTHCHECK_HTTP_SERVER_PATH || '/metrics',
    port: process.env.HEALTHCHECK_HTTP_SERVER_PORT || 9021,
    timeout: process.env.HEALTHCHECK_HTTP_SERVER_TIMEOUT || 2000,
};

const healthCheck = http.request(options, (res) => {
    console.log(`HEALTHCHECK status: ${res.statusCode}`);
    if (res.statusCode == 200) {
        res.on("data", (chunk) => {
            const data = chunk.toString()

            if( !data || !data.length) {
                console.log("HEALTHCHECK data is null")
                process.exit(2);
            }


            try {
                if(Number.parseInt(HEALTHCHECK_ENABLED_METRICS) > 0) {
                    const found = data.match(HEALTHCHECK_METRICS_MATCH_REGEX);
    
                    if(!found){
                        console.log("HEALTHCHECK matches not found")
                        process.exit(4);
                    }
        
                    try {
                        const ack = found[0].split(" ")[1]
                        if(!ack){
                            console.log("HEALTHCHECK Not acks")
                            process.exit(5);
                        }
                        console.log("HEALTHCHECK notify_rabbit_ack", ack)
        
                    } catch (error) {
                        console.log(error.messages)
                        process.exit(6);
                    }    
                }
            } catch (error) {
                
            }
                    
            process.exit(0);
        })        
    }
    else {
        process.exit(1);
    }
});

healthCheck.on('error', function (err) {
    console.error('HEALTHCHECK ERROR');
    process.exit(1);
});

healthCheck.end();

console.log(`HEALTHCHECK running...`);