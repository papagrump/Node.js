const nodemailer = require('nodemailer');
const path = require('path');
const log = require('./../helpers/log');
const { ERROR, WARNING, SUCCESS } = require('./../constants/message-types');
const config = require('config');

//get config for dm
const smtpConfig = config.get('dailyingestion.smtpconfig');

const logPrefix = path.basename(module.filename, path.extname(module.filename));

const transporter = nodemailer.createTransport({
	host: smtpConfig.host,
	port: smtpConfig.port,
	secure: false,
	tls: {
		rejectUnauthorized: false,
	},
});

const sendEmail = (message) => {
	transporter.sendMail(message, (err, info) => {
		if (err) {
			log(logPrefix, err.message, ERROR);
		} else {
			log(logPrefix, `Message sent to: ${message.to}`);
		}
	});
};

module.exports = sendEmail;
