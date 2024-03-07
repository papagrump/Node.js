//
const path = require('path');
const log = require('./../helpers/log');
const { ERROR, WARNING, SUCCESS } = require('./../constants/message-types');
const { Storage } = require('@google-cloud/storage');
const config = require('config');
const gcpConfig = config.get('dailyingestion.gcpConfig');
const gcpBuckets = JSON.parse(gcpConfig.bucketNames);
//const bucketName = gcpConfig.bucketName;

const storage = new Storage({
	projectId: gcpConfig.projectId,
	keyFilename: gcpConfig.keyFilename,
});
//console.log(gcpBuckets);

const logPrefix = path.basename(module.filename, path.extname(module.filename));
module.exports = {
	uploadFileToGCP: async function (options) {
		//get gcpbucket
		//let bucketName = gcpBuckets[options.repository];
		const bucket = gcpBuckets.find(({ name }) => name === options.repository);
		try {
			// const docType = mf.documenttypes.find(
			// 	({ filenameprefix }) => gcpBuckets === thePrefix
			// );
			await storage.bucket(bucket.value).upload(options.filePath, {
				destination: options.destFileName,
				timeout: 120000,
			});
			log(
				logPrefix,
				`${options.filePath} uploaded to ${bucket.value}/${options.destFileName}`,
				SUCCESS
			);
		} catch (error) {
			log(
				logPrefix,
				`Failed to Upload to GCP bucket: ${bucket.value} ` +
					JSON.stringify(error),
				ERROR
			);
			log(
				logPrefix,
				`File failed to upload to GCP: source: ${options.filePath} MD5: ${options.destFileName} `,
				ERROR
			);
		}
	},
};
