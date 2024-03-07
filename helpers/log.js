const { createLogger, format, transports, addColors } = require('winston');
require('winston-daily-rotate-file');
const config = require('config').get('dailyingestion.logger'); //get config for logger
const {
	ERROR,
	WARNING,
	SUCCESS,
	DEBUG,
} = require('../constants/message-types');

if (config.console) {
	module.exports = console.log;
	return;
}

const myCustomLevels = {
	levels: {
		error: 0,
		warning: 1,
		success: 2,
		info: 3,
		debug: 4,
	},
	colors: {
		error: 'red',
		warning: 'yellow',
		success: 'green',
		info: 'blue',
		debug: `white`,
	},
};

var myTransports = [];
config.transports.forEach((transp) => {
	if (transp.enabled) {
		let aTransport = new transports.DailyRotateFile({
			filename: `${transp.filepath}-%DATE%.log`,
			datePattern: transp.datepattern,
			zippedArchive: transp.zippedarchive,
			maxSize: transp.maxsize,
			maxFiles: transp.maxfiles,
			handleExceptions: transp.handleExceptions,
			level: transp.level,
		});
		myTransports.push(aTransport);
	}
});

addColors(myCustomLevels.colors);
const logger = createLogger({
	level: 'debug',
	levels: myCustomLevels.levels,
	format: format.combine(
		format.timestamp({
			format: 'YYYY-MM-DD HH:mm:ss',
		}),
		format.errors({ stack: true }),
		format.json()
	),
	defaultMeta: { service: 'daily-ingestion' },
	transports: myTransports,
});

//
// If we're in our lab then **ALSO** log to the `console`
// with the colorized simple format.
//
if (process.env.NODE_ENV == 'LAB') {
	logger.add(
		new transports.Console({
			//format: format.combine(format.colorize(), format.simple()),
			format: format.combine(format.colorize({ all: true }), format.simple()),
			handleRejections: true,
			handleExceptions: true,
		})
	);
}
module.exports = function log(module, message, level) {
	switch (level) {
		case DEBUG:
			logger.debug(message, { module: `${module}` });
			break;
		case ERROR:
			logger.error(message, { module: `${module}` });

			// add notification
			break;
		case WARNING:
			logger.warning(message, { module: `${module}` });

			//possible notificaton
			break;
		case SUCCESS:
			logger.success(message, { module: `${module}` });
			break;
		default:
			logger.info(message, { module: `${module}` });
	}
};
