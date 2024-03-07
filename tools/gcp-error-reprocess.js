//
//
//const StreamArray = require('stream-json/streamers/StreamArray');
const path = require('path');
const fse = require('fs-extra');
const es = require('event-stream');
const inspect = require('util').inspect;
//const { Writable } = require('stream');
const { md5hash, md5size } = require('./../helpers/md5-calc');
const log = require('./../helpers/log');
const { ERROR, WARNING, SUCCESS } = require('./../constants/message-types');
const { uploadFileToGCP } = require('./../helpers/gcp-file-upload');

function getLogFileName(theDate) {
	var myArgs = process.argv.slice(2);
	console.log('Processing File: ', myArgs[0]);

	//return myArgs[0]; //'C:/Users/eso4263/Documents/GitHub/ICP_DailyIngest/Node.js/logs/daily-ingestion-error.log-2021-08-11.log';
	return 'C:\\Users\\eso4263\\Documents\\GitHub\\ICP_DailyIngest\\Node.js\\logs\\daily-ingestion-error.log-2021-12-02.log';
}

fse
	.createReadStream(getLogFileName()) //connect streams together with `pipe`
	.pipe(es.split()) //split stream to break on newlines
	.pipe(
		es.map(function (data, cb) {
			//turn this async function into a stream
			let row = JSON.parse(data);
			if (row.message.includes('File failed to upload to GCP')) {
				//console.log(row.message);
				let theFile = row.message.slice(
					row.message.indexOf('D:'),
					row.message.indexOf('MD5:') - 1
				);
				let md5 = row.message.slice(
					row.message.indexOf('MD5:') + 5,
					row.message.length - 1
				);
				//console.log('Filename: ' + theFile);
				//console.log('MD5: ' + md5);
				let repo = '';
				switch (theFile.split('/')[4]) {
					case 'packingslips':
						repo = 'Packing Slip Archive';
						break;

					default:
						repo = 'Default';
				}
				//if (theFile.includes('packingslips'))
				//upload to GCP renaming to hash
				const options = {
					filePath: theFile,
					destFileName: `${md5}`,
					repository: repo,
				};

				console.log(options);

				//uploadFileToGCP(options);
			}
			cb(null, inspect(JSON.parse(data))); //render it nicely
		})
	);
//.pipe(process.stdout);
