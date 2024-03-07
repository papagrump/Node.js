const fse = require('fs-extra');
const db = require('../../db');
const path = require('path');
//const { DateTime } = require('luxon');
const moveToHold = require('../../helpers/move-hold');
const copyToWebCenter = require('../../helpers/copy-towebcenter');
//const copyMd5 = require('../../helpers/copy-md5');
// const { md5hash, md5size } = require('../../helpers/md5-calc');
// const log = require('../../helpers/log');
// const { ERROR, WARNING, SUCCESS, DEBUG} = require('../../constants/message-types');
// const { uploadFileToGCP } = require('../../helpers/gcp-file-upload');

const logPrefix = path.basename(module.filename, path.extname(module.filename));
module.exports = {
	process: function (filePath, mf, rootPath, metaData, holdFolderPath) {
		new Promise((resolve, reject) => {
			if (fse.existsSync(filePath)) {
				if (mf.copytopath != null && mf.copytopath != undefined) {
					copyToWebCenter(filePath, mf.copytopath).then((msg) => {
						log(logPrefix, `Copied DAT/API to WebCenter|${msg}`, SUCCESS);
						resolve(`Copied .DAT/.API File to WebCenter|${filePath}`);
						// moveToHold(datFilePath, `${holdFilePath}`)
						// 	.then((msg) => {
						// 		log(logPrefix, `Moved DAT file to hold|${msg}`);
						// 	})
						// 	.catch((err) => {
						// 		log(
						// 			logPrefix,
						// 			`Moving DAT file to hold|${error.message}`,
						// 			ERROR
						// 		);
						// 	});
					});
				}
				// 	const fileSizeInBytes = md5size(filePath);
				// 	const hash = md5hash(filePath);
				// 	const fileName = path.basename(filePath);

				// 	const insertStatement =
				// 		`insert into "${mf.dbtablename}" (accountnumber, customername, statementdate, statementnumber, ` +
				// 		`holdpath, m_status, m_md5, m_lastupdated, m_lastupdatedby, m_filesize, m_filename) ` +
				// 		`values ('${metaData.AccountNumber}', '${metaData.CustomerName}', '${metaData.StatementDate}', '${metaData.StatementNumber}', ` +
				// 		`'${rootPath}${holdFolderPath}/${fileName}', '${mf.finalM_Status}', '${hash}', current_timestamp, 'daily-ingestion', '${fileSizeInBytes}', '${fileName}')`;

				// 	//console.log(insertStatement);
				// 	db.query(insertStatement, (err, res) => {
				// 		if (err) {
				// 			log(logPrefix, err.message, ERROR);
				// 			reject(`Error inserting to DB for file|${fileName}`);
				// 		} else {
				// 			log(logPrefix, `Inserted record in DB for|${fileName}`);
				// 			//move filePath to holdfolder
				// 			moveToHold(filePath, holdFolderPath)
				// 				.then((msg) => {
				// 					log(logPrefix, `Moved to hold|${msg}`, SUCCESS);
				// 					//upload to GCP renaming to hash
				// 					const options = {
				// 						filePath: holdFilePath,
				// 						destFileName: `${hash}`,
				// 						repository: mf.repository,
				// 					};
				// 					uploadFileToGCP(options);

				// 					// //copy with rename to md5 folder
				// 					// copyMd5(
				// 					// 	`${rootPath}${holdFolderPath}/${fileName}`,
				// 					// 	mf.rcloneFolder,
				// 					// 	hash
				// 					// )
				// 					// 	.then((msg) => {
				// 					// 		log(logPrefix, `Copied to rClone|${msg}`, SUCCESS);
				// 					// 	})
				// 					// 	.catch((err) => {
				// 					// 		log(logPrefix, err.message, ERROR);
				// 					// 		reject(`Error copying MD5|${fileName}`);
				// 					// 	});
				// 				})
				// 				.catch((err) => {
				// 					log(`${logPrefix}_Move`, err.message, ERROR);
				// 					reject(`Error moving file: ${fileName}`);
				// 				});
				// 			resolve(`Processed ARSCO Invoice File|${filePath}`);
				// 		}
				// 	});
				// } else {
				// 	reject(`File not found|${fileName}`);
				//
			}
		});
	},
};
