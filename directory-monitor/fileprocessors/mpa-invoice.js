const fse = require('fs-extra');
const db = require('../../db');
const path = require('path');
//const { DateTime } = require('luxon');
//const moveToHold = require('../../helpers/move-hold');
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

function processPDF(filePath, mf, rootPath, metaData) {
	return new Promise((resolve, reject) => {
		fse
			.pathExists(filePath)
			.then((exists) => {
				if (exists) {
					log(logPrefix, `File to process exists|${filePath}`, DEBUG);
					const fileSizeInBytes = md5size(filePath);
					const hash = md5hash(filePath);
					let customerNumber = metaData.custncompcode.split('-')[0];

					const insertStatement =
						`insert into "${mf.dbtablename}" ( invoicenumber, customernumber, createdate, companycode, ` +
						`grossamount, invoicetype, custncompcode, ` +
						`holdpath, m_status, m_md5, m_lastupdated, m_lastupdatedby, m_filesize, m_filename) ` +
						`values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, current_timestamp, 'daily-ingestion', $11, $12)`;

					const values = [
						metaData.invoiceNumber,
						customerNumber,
						metaData.invoiceDate,
						metaData.companyCode,
						metaData.invoiceAmount,
						metaData.invoiceType,
						metaData.custncompcode,
						filePath,
						mf.finalM_Status,
						hash,
						fileSizeInBytes,
						metaData.pdfName,
					];

					db.query(insertStatement, values, (err, res) => {
						if (err) {
							log(logPrefix, err.message, ERROR);
							reject(`Error inserting into DB for file|${metaData.pdfName}`);
						} else {
							log(logPrefix, `Inserted record into DB for|${metaData.pdfName}`);
							//upload to GCP renaming to hash
							const options = {
								filePath: filePath,
								destFileName: `${hash}`,
								repository: mf.repository,
							};
							uploadFileToGCP(options);

							resolve(`Processed MPA Invoice File|${filePath}`);
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

module.exports = processPDF;
