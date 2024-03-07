const fse = require('fs-extra');
const path = require('path');
const { Client, Pool } = require('pg');

const log = require('../helpers/log');
const {
	DEBUG,
	ERROR,
	WARNING,
	SUCCESS,
} = require('../constants/message-types');
const e = require('express');
const config = require('config').get('dailyingestion.dbconfig');
//const config = config.get('dailyingestion.dbconfig');
//console.log(`DB config.dbuser: ${dbConfig.user}`);
//console.log('DB ENV DB_USER: ' + config.util.getEnv('DB_USER'));

const logPrefix = path.basename(module.filename, path.extname(module.filename));
const dbConnection = {
	user: config.user,
	password: config.password,
	database: config.database,
	port: config.port,
	host: config.host,
	// this object will be passed to the TLSSocket constructor
	ssl: {
		sslmode: config.ssl.sslmode,
		rejectUnauthorized: config.ssl.rejectunauthorized,
		ca: fse.readFileSync(config.ssl.ca).toString(),
		key: fse.readFileSync(config.ssl.key).toString(),
		cert: fse.readFileSync(config.ssl.cert).toString(),
	},
	max: 25,
	idleTimeoutMillis: 30000,
	//connectionTimeoutMillis: 3000,
};

const pool = new Pool(dbConnection);
// pool
// 	.connect()
// 	.then((client) => {
// 		console.log('DB connected successfully');
// 		client.release();
// 	})
// 	.catch((err) => console.error('error connecting', err.stack))
// 	.then(() => pool.end());

pool.on('connect', (client) => {
	log(logPrefix, `Successfully connected to DB ${config.database}`, DEBUG);
	client.query(`SET search_path TO ${config.schema}`).then((res) => {
		log(
			logPrefix,
			`Successfully set DB search path to ${config.schema}`,
			DEBUG
		);
	});
});

module.exports = {
	query: (text, params, callback) => {
		const start = Date.now();
		return pool.query(text, params, (err, res) => {
			const duration = Date.now() - start;
			if (res != null && res != undefined) {
				log(
					logPrefix,
					`executed query: ${text}, duration:${duration}, rows: ${res.rowCount}`,
					DEBUG
				);
			} else {
				log(
					logPrefix,
					`Failed to execute queury: ${text}, error message: ${err.message}`,
					DEBUG
				);
			}

			callback(err, res);
		});
	},

	// query: (text, params, callback) => {
	// 	const start = Date.now();
	// 	return pool.query(text, params, (err, res) => {
	// 		if (err) {
	// 			// Wait for a bit, then retry again
	// 			setTimeout(function () {
	// 				log(logPrefix, `First retry of DB operation... ${text}`, WARNING);
	// 				return pool.query(text, params, (err, res) => {
	// 					if (err) {
	// 						// Wait a little longer, then retry again
	// 						setTimeout(function () {
	// 							log(
	// 								logPrefix,
	// 								`Second retry of DB operation... ${text}`,
	// 								WARNING
	// 							);
	// 							return pool.query(text, params, (err, res) => {});
	// 						}, 1000);
	// 					}
	// 				});
	// 			}, 300);
	// 		}
	// 		const duration = Date.now() - start;
	// 		if (res != null && res != undefined) {
	// 			log(
	// 				logPrefix,
	// 				`executed query: ${text} duration: ${duration} rows: ${res.rowCount}`,
	// 				DEBUG
	// 			);
	// 		}
	// 		callback(err, res);
	// 	});
	// },

	// async query(text, params) {
	// 	const start = Date.now();
	// 	let res;
	// 	try {
	// 		res = await pool.query(text, params);
	// 	} catch (error) {
	// 		//Wait for a bit, then retry again
	// 		setTimeout(function () {
	// 			log(logPrefix, `First retry of DB operation... ${text}`, WARNING);
	// 			try {
	// 				res = await pool.query(text, params);
	// 			} catch (error) {
	// 				//Wait for a bit longer, then retry again
	// 				setTimeout(function () {
	// 					log(logPrefix, `Second retry of DB operation... ${text}`, WARNING);
	// 					try {
	// 						res = await pool.query(text, params);
	// 					} catch (error) {
	// 						log(
	// 							logPrefix,
	// 							`Error Executing DB operation... ${text}|${error.message}`,
	// 							ERROR
	// 						);
	// 					}
	// 				}, 1000); //1 seconds wait the second retry
	// 			}
	// 		}, 300); //.3 second wait the first retry
	// 	}
	// 	const duration = Date.now() - start;
	// 	log(
	// 		logPrefix,
	// 		`executed query: ${text} duration: ${duration} rows: ${res.rowCount}`,
	// 		DEBUG
	// 	);
	// 	return res;
	// },

	getClient: (callback) => {
		pool.connect((err, client, done) => {
			const query = client.query;
			// monkey patch the query method to keep track of the last query executed
			client.query = (...args) => {
				client.lastQuery = args;
				return query.apply(client, args);
			};
			// set a timeout of 5 seconds, after which we will log this client's last query
			const timeout = setTimeout(() => {
				log(
					logPrefix,
					'A client has been checked out for more than 5 seconds!',
					ERROR
				);
				log(
					logPrefix,
					`The last executed query on this client was: ${client.lastQuery}`,
					ERROR
				);
			}, 5000);
			const release = (err) => {
				// call the actual 'done' method, returning this client to the pool
				done(err);
				// clear our timeout
				clearTimeout(timeout);
				// set the query method back to its old un-monkey-patched version
				client.query = query;
			};
			callback(err, client, release);
		});
	},
};
