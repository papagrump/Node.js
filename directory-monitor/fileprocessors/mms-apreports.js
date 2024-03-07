const fse = require('fs-extra');
const db = require('../../db');
const path = require('path');
const { DateTime } = require('luxon');
const moveToHold = require('../../helpers/move-hold');
const copyToWebCenter = require('../../helpers/copy-towebcenter');
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
					// get current date and hr formatted by mf.holdfolderpattern
					const curDatePlusHr = DateTime.now().toFormat(
						`${mf.holdfolderpattern}`
					);

					//parse metadata from filename, example:
                                        //APR_MONTHLY_OPENAP_R550411S_GM0002_8224323_PDF.CSV
					//PACKLIST_0030074911_3078542_25129583_052721.pdf
					const fileName = path.win32.basename(filePath);
					const ext = path.extname(filePath);
					const fname = path.basename(filePath, ext);
					const metadata = fname.split('_');

					const Versionid = metadata[4];
					const ReportFrequency2 = metadata[2];
					const ReportFrequency1 = metadata[1];
					const ReportName= metadata[3];

					const fileSizeInBytes = md5size(filePath);
					const hash = md5hash(filePath);

					const holdFolderPath = `${mf.holdFolder}/${curDatePlusHr}`;
					//the final holding path + filename
					const holdFilePath = `${rootPath}${holdFolderPath}/${fileName}`;

					//insert metadata in db
					const insertStatement =
						`insert into "${mf.dbtablename}" (reportname, reportfrequency1, reportfrequency2,versionid, createddate, holdpath, ` +
						`m_status, m_md5, m_lastupdated, m_lastupdatedby, m_filesize, m_filename) ` +
						`values ($1, $2, $3, $4, current_timestamp, $5, $6, $7, current_timestamp, 'daily-ingestion', $8, $9)`;

					const values = [
						ReportName,
						ReportFrequency1,
						ReportFrequency2,
						Versionid,
						holdFilePath,
						mf.finalM_Status,
						hash,
						fileSizeInBytes,
						fileName,
					];

					db.query(insertStatement, values, (err, res) => {
						if (err) {
							log(logPrefix, err.message, ERROR);
							reject(`Error inserting to DB for file|${fileName}`);
						} else {
							log(logPrefix, `Inserted record in DB for|${fileName}`);
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

									//make a copy for WebCenter dual filing

								})
								.catch((err) => {
									log(`${logPrefix}_Move`, err.message, ERROR);
									reject(`Error moving file|${fileName}`);
								});

							resolve(`Processed MMS PackSlip File|${filePath}`);
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
