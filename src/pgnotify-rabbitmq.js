#!/usr/bin/env node

/*
 * Small application that connects to one or more databases and listens for
 * notifications, passing them on to a rabbitmq instance allowing code inside
 * the database to do realtime messaging out to the rest of the system.
 */

// prefix for erros code
const ERROR_PREFIX = 20;
const pkg = require('./package.json')
const amqp = require('amqplib');
const config = require('./config')({
	databases: true
})


// Logger Handler
const logger =  require('./LoggerHandler')
const httpNotifyHandler = require('./HttpNotifyHandler');
const fcmNotifyHandler = require('./FcmNotifyHandler');

console.log(`${pkg.name} ${pkg.version}`);

config.notify({
	// Log entire message to the console
	console: function (c, n, v) {
		if (v === true) {
			return function (m) {
				logger.log('info',['Notify', n.database, n.name, JSON.stringify(m)].join(':'));
			};
		}
		return null;
	},
	// Publish the message to a rabbit topic
	rabbit: function (c, n, v) {
		const o = {
			// Connection details
			uri: c.rabbit[v.instance],
			channel: false,
			// Topic or default to amq.topic
			topic: v.topic ? v.topic : 'amq.topic',
			// Routing key, send as is if defined
			key: v.key,
			// If an object then the key holding the route and payload.
			// For payload undefined here means the parent object rather than]
			// a child/ Only valid if json is true
			routingKey: v.routingKey,
			payload: v.payload,
			// Message parsed into json?
			json: n.json,
			// Function to handle publishing
			publish: function (m) {
				const me = this;

				return new Promise( (resolve, reject) => {
					if (me.channel) {

						logger.log('info',`rabbit.publish: ${m}`);

						// Plain send to route
						if (me.key){
							me.channel.publish(
								me.topic,
								me.key,
								Buffer.from(me.json ? JSON.stringify(m) : m),
								{},
								(err, ok)  => {
									if(err){
										reject(err)
									}else{
										resolve(ok)
									}
								}
							);
						}

						if (me.routingKey && me.json) {
							me.channel.publish(
								me.topic,
								m[me.routingKey],
								Buffer.from(JSON.stringify(me.payload ? m[me.payload] : m)),
								{},
								(err, ok)  => {
									if(err){
										reject(err)
									}else{
										resolve(ok)
									}
								}
							);
						}
					}else{
						logger.log('warn','dont has channel')
					}
				})
			}
		};

		// No uri or if not json then no key then don't do anything
		if (!o.uri || (!o.key && !o.json))
			return null;

		amqp.connect(o.uri, {
			clientProperties: {
				// Show what this connection is for in management
				connection_name: 'Notify ' + n.database + ' ' + n.name
			}
		}).then(function (conn) {
			/// setting connection object && signals
			o.conn = conn;
			console.log(`[amqp.connected] (${o.uri})`);
			process.once('SIGINT', () => {
				conn.close.bind(conn)
				console.log(`[amqp.close] (${o.uri})`);
			});
			return conn
		})
		.then((connection) => {
			// Creating channels
			return connection.createConfirmChannel()
		})
		.then((channel) => {
			console.log(`[createConfirmChannel] (${o.topic})`);

			// use prefetch only with createChannel method
			// channel.prefetch(1);

			// setting global channel ref
			o.channel = channel;

			// channel error callback
			o.channel.on('error', (error) => {
				/*console.log("[channel.error]", error)
				process.exit(ERROR_PREFIX+1)
				*/
				config.safelyClose(ERROR_PREFIX+1, `Channel error (${o.topic})`)
			});

			// channel close  callback
			o.channel.on('close', () => {
				/*console.log("[channel closed]")
				process.exit(ERROR_PREFIX+2)
				*/
				config.safelyClose(ERROR_PREFIX+2, `Channel closed (${o.topic})`)
			});

		}).catch(function (ex) {
			// logger.log('error',`[amqp.error] ${e.message}`);
			// process.exit(ERROR_PREFIX+3)
			config.safelyClose(ERROR_PREFIX+3, ex.message )
		});

		return function (m) {
			return o.publish(m);
		};
	},
	http: function(_c, _n) {
		return function(m) {
		return httpNotifyHandler.dispatch(m);
		}
	},
	fcm: function(_c, _n, v) {
		if(v.projectId){
			fcmNotifyHandler.initialize(v);

			return function(message) {
				return fcmNotifyHandler.sendMessage(message);
			}
		}
	}
});