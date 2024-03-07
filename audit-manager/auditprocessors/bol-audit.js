//requires
const Nuxeo = require('nuxeo');
const path = require('path');
const sendEmail = require('../../helpers/send-mail');
const config = require('config');
const { DateTime } = require('luxon');
const log = require('../../helpers/log');
const { ERROR, WARNING, SUCCESS } = require('../../constants/message-types');

//const { uploadFileToGCP } = require('../../helpers/gcp-file-upload');

const logPrefix = path.basename(module.filename, path.extname(module.filename));
//read config
const audConfig = config.get('dailyingestion.audit-manager');

// connect to nuxeo
let nuxeo = new Nuxeo({
	baseURL: audConfig.nuxeobaseurl,
	httpTimeout: 30,
	auth: {
		method: 'basic',
		username: audConfig.nuxeousername,
		password: audConfig.nuxeopassword,
	},
});

// query Nuxeo
const today = DateTime.now().toFormat('y-LL-dd');
const yesterday = DateTime.now().plus({ days: -1 }).toFormat('y-LL-dd'); //~> this time yesterday
let query =
	`SELECT * FROM Document ` +
	`WHERE ecm:primaryType='mms_BOL' ` +
	`and dc:modified >= DATE '${yesterday}' and dc:modified < DATE '${today}'`;

log(logPrefix, query);

nuxeo
	.repository()
	.schemas(['dublincore', 'file'])
	.query({ query: query })
	.then((docs) => {
		log(`${logPrefix}|Total Docs`, docs.resultsCount);
		let message = {};
		if (docs.resultsCount > 0) {
			message = setEmailMessage(audConfig.BOL.successtolist, docs.resultsCount);
		} else {
			message = setEmailMessage(
				audConfig.BOL.noresultstolist,
				docs.resultsCount
			);
		}
		//console.log(message);
		//console.log(audConfig.node_env + ' ' + audConfig.gcpbucket);
		sendEmail(message);
	})
	.catch((error) => {
		log(logPrefix, error.message, ERROR);
	});

let formatMessage = (count) => {
	message = `The total count of BOL documents loaded into Nuxeo ${audConfig.node_env} ${yesterday} is: ${count}`;
	return message;
};

let setEmailMessage = (toList, docCount) => {
	let msg = formatMessage(docCount);
	log(logPrefix, msg);
	const subject = `${audConfig.node_env} BOL Daily Audit Report - Total Docs Loaded: ${docCount}`;
	const body = `${msg}`;
	let emailMessage = {
		from: audConfig.BOL.from,
		to: toList,
		subject,
		body,
		html: `<h3>Daily Load of BOL to Nuxeo ${audConfig.node_env}</h3><h4>${msg}</h4>`,
	};
	return emailMessage;
};
