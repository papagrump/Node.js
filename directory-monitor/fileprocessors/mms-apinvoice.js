const fse = require('fs-extra');
const db = require('../../db');
const path = require('path');
//const { DateTime } = require('luxon');
const moveToHold = require('../../helpers/move-hold');
const { md5hash, md5size } = require('../../helpers/md5-calc');
const log = require('../../helpers/log');
const {
	ERROR,
	WARNING,
	SUCCESS,
	DEBUG,
} = require('../../constants/message-types');
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

					// API*.API
					//"metadatacolumnheaders": [
					// 'AppendPage',
					// 	'FilePath',
					// 	'Ani',
					// 	'CustomerName',
					// 	'AccountNumber',
					// 	'DNIS',
					// 	'FaxDate',
					// 	'Status';
					//to do
					const insertStatement =
						`insert into "${mf.dbtablename}" (batch, bu, doctype, invdate, invno, invtotal, ponum, vendno, ` +
						`holdpath, m_status, m_md5, m_filesize, m_filename, m_audit_uuid, m_lastupdatedby, m_lastupdated) ` +
						`values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, current_timestamp)`;
					// to do
					const values = [
						metaData.Batch,
						metaData.Bu,
						metaData.Doctype,
						metaData.Invdate,
						metaData.Invno,
						metaData.Invtotal,
						metaData.Ponum,
						metaData.Vendno,
						`${rootPath}${holdFolderPath}/${fileName}`,
						mf.finalM_Status,
						hash,
						fileSizeInBytes,
						fileName,
						metaData.job_uuid,
						'daily-ingestion',
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
