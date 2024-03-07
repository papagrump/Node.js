const fse = require('fs-extra');
const db = require('../../db');
const path = require('path');
//const { DateTime } = require('luxon');
const moveToHold = require('../../helpers/move-hold');
//const copyMd5 = require('../../helpers/copy-md5');
const { md5hash, md5size } = require('../../helpers/md5-calc');
const log = require('../../helpers/log');
const { ERROR, WARNING, SUCCESS } = require('../../constants/message-types');
const { uploadFileToGCP } = require('../../helpers/gcp-file-upload');

const logPrefix = path.basename(module.filename, path.extname(module.filename));

function process(filePath, mf, rootPath, metaData, holdFolderPath) {
	return new Promise((resolve, reject) => {
		fse
			.pathExists(filePath)
			.then((exists) => {
				if (exists) {
					const fileSizeInBytes = md5size(filePath);
					const hash = md5hash(filePath);
					const fileName = path.basename(filePath);

					const insertStatement =
						`insert into "${mf.dbtablename}" (billto, executiondate, ` +
						`holdpath, m_status, m_md5, m_lastupdated, m_lastupdatedby, m_filesize, m_filename, m_audit_uuid) ` +
						`values ($1, $2, $3, $4, $5, current_timestamp, 'daily-ingestion', $6, $7, $8)`;

					const values = [
						metaData.BillTo,
						metaData.ExecutionDate,
						`${rootPath}${holdFolderPath}/${fileName}`,
						mf.finalM_Status,
						hash,
						fileSizeInBytes,
						fileName,
						metaData.job_uuid,
					];

					db.query(insertStatement, values, (err, res) => {
						if (err) {
							log(
								logPrefix,
								`Got ${err.message} inserting record for|${fileName}`,
								DEBUG
							);
							reject(`Error inserting record in DB for file|${fileName}`);
						} else {
							log(logPrefix, `Inserted record in DB for|${fileName}`);
							//move filePath to holdfolder
							moveToHold(filePath, holdFolderPath)
								.then((msg) => {
									log(logPrefix, `Moved to hold|${msg}`, SUCCESS);
									//upload to GCP renaming to hash
									const options = {
										filePath: `${msg}`, //use the filepath returned from moveToHold
										destFileName: `${hash}`,
										repository: mf.repository,
									};
									uploadFileToGCP(options);
								})
								.catch((err) => {
									log(`${logPrefix}_Move`, err.message, ERROR);
									reject(`Error moving file|${fileName}`);
								});
							resolve(`Successfully processed ${logPrefix} File|${filePath}`);
						}
					});
				} else {
					//doesn't exist
					reject(`File to process not found|${filePath}`);
				}
			})
			.catch((error) => {
				reject(`${error.message}`);
			});
	});
}

module.exports = process;

// module.exports = {
// 	process: function (filePath, mf, rootPath, metaData, holdFolderPath) {
// 		new Promise((resolve, reject) => {
// 			if (fse.existsSync(filePath)) {
// 				const fileSizeInBytes = md5size(filePath);
// 				const hash = md5hash(filePath);
// 				const fileName = path.basename(filePath);

// 				//let CustomerName = metaData.CustomerName.replace(/'/g, "\\'");

// 				//client.query('insert into mytable values ($1)', ["a value with sing''le quo''te"])
// 				const insertStatement =
// 					`insert into "${mf.dbtablename}" (billto, executiondate, ` +
// 					`holdpath, m_status, m_md5, m_lastupdated, m_lastupdatedby, m_filesize, m_filename) ` +
// 					`values ($1, $2, $3, $4, $5, current_timestamp, 'daily-ingestion', $6, $7)`;

// 				//console.log(insertStatement);

// 				const values = [
// 					metaData.BillTo,
// 					metaData.ExecutionDate,
// 					`${rootPath}${holdFolderPath}/${fileName}`,
// 					mf.finalM_Status,
// 					hash,
// 					fileSizeInBytes,
// 					fileName,
// 				];

// 				// db.query(insertStatement, values, (err, res) => {
// 				// 	if (err) {
// 				// 		//retry
// 				// 		log(logPrefix, `Insert failed, retrying for|${fileName}`, ERROR);
// 				db.query(insertStatement, values, (err, res) => {
// 					if (err) {
// 						log(
// 							logPrefix,
// 							`${err.message} insert record for|${fileName}`,
// 							ERROR
// 						);
// 						reject(`Error inserting to DB for file|${fileName}`);
// 					} else {
// 						log(logPrefix, `Inserted record in DB for|${fileName}`);
// 						//move filePath to holdfolder
// 						//
// 						moveToHold(filePath, holdFolderPath)
// 							.then((msg) => {
// 								log(logPrefix, `Moved to hold|${msg}`, SUCCESS);
// 								//upload to GCP renaming to hash
// 								const options = {
// 									filePath: `${msg}`, //use the filepath returned from moveToHold
// 									destFileName: `${hash}`,
// 									repository: mf.repository,
// 								};
// 								uploadFileToGCP(options);

// 								// //copy with rename to md5 folder
// 								// copyMd5(
// 								// 	`${rootPath}${holdFolderPath}/${fileName}`,
// 								// 	mf.rcloneFolder,
// 								// 	hash
// 								// )
// 								// 	.then((msg) => {
// 								// 		log(logPrefix, `Copied to rClone|${msg}`, SUCCESS);
// 								// 	})
// 								// 	.catch((err) => {
// 								// 		log(logPrefix, err.message, ERROR);
// 								// 		reject(`Error copying MD5|${fileName}`);
// 								// 	});
// 							})
// 							.catch((err) => {
// 								log(`${logPrefix}_Move`, err.message, ERROR);
// 								reject(`Error moving file: ${fileName}`);
// 							});
// 						resolve(`Processed ${logPrefix} Invoice File|${filePath}`);
// 					}
// 				});
// 				// 	}
// 				// });
// 			} else {
// 				reject(`File not found|${fileName}`);
// 			}
// 		});
// 	},
// };
