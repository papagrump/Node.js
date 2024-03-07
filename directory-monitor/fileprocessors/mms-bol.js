const fse = require('fs-extra');
const db = require('../../db');
const path = require('path');
const { DateTime } = require('luxon');
const moveToHold = require('../../helpers/move-hold');
//const copyMd5 = require('../../helpers/copy-md5');
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

function process(filePath, mf, rootPath) {
	return new Promise((resolve, reject) => {
		fse
			.pathExists(filePath)
			.then((exists) => {
				if (exists) {
					log(logPrefix, `File to process exists|${filePath}`, DEBUG);
					// get current date and hr formatted by mf.holdfolderpattern
					const holdFldrDate = DateTime.now().toFormat(
						`${mf.holdfolderpattern}`
					);

					//parse metadata from filename, example:
					//Loftware Print Job - 631_01065001415741_BOL_2021-05-26-08.26.06.pdf
					const bolDate = filePath.substring(
						filePath.lastIndexOf('_') + 1,
						filePath.length - 13
					);
					const bolDatetime = bolDate + 'T08:00:00.000Z';

					const bolNumber = filePath.substring(
						filePath.indexOf('_') + 1,
						filePath.indexOf('_BOL')
					);
					const dcNumber = bolNumber.substring(2, 5);

					const fileSizeInBytes = md5size(filePath);
					const hash = md5hash(filePath);

					const filename = path.win32.basename(filePath);
					const holdFolderPath = `${mf.holdFolder}/${holdFldrDate}`;
					const holdFilePath = `${rootPath}${holdFolderPath}/${filename}`;

					const insertStatement =
						`insert into "${mf.dbtablename}" ( bolnumber, dcnumber, boldate, holdpath, m_status, ` +
						`m_md5, m_lastupdated, m_lastupdatedby, m_filesize, m_filename) ` +
						`values ($1, $2, $3, $4, $5, $6, current_timestamp, 'daily-ingestion', $7, $8)`;

					const values = [
						bolNumber,
						dcNumber,
						bolDatetime,
						holdFilePath,
						mf.finalM_Status,
						hash,
						fileSizeInBytes,
						filename,
					];

					db.query(insertStatement, values, (err, res) => {
						if (err) {
							log(logPrefix, err.message, ERROR);
							reject(`Error inserting to DB for file|${filename}`);
						} else {
							log(logPrefix, `Inserted record in DB for|${filename}`);
							//move filePath to holdfolder
							moveToHold(filePath, holdFolderPath)
								.then((msg) => {
									log(logPrefix, `Moved to hold|${msg}`, SUCCESS);

									//upload to GCP renaming to hash
									const options = {
										filePath: holdFilePath,
										destFileName: `${hash}`,
										repository: mf.repository,
									};
									uploadFileToGCP(options);
								})
								.catch((err) => {
									log(logPrefix, err.message, ERROR);
									reject(`Error moving file|${filename}`);
								});

							resolve(`Processed BOL File|${filePath}`);
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
