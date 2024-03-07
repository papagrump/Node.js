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
					//<ReportName>_<VersionID>_<ReportDate>_<CompanyCode>_<Job#>_<ServerName>.csv
					//     R5503TR4_  EC0001_     06092023_   86701_     15508983_  GTX.      csv
					//
                                        //APR_MONTHLY_OPENAP_R550411S_GM0002_8224323_PDF.CSV
					const fileName = path.win32.basename(filePath);
					const ext = path.extname(filePath);
					const fname = path.basename(filePath, ext);
					const metadata = fname.split('_');

					const ReportName= metadata[0];
					const VersionId = metadata[1];
					const ReportFrequency = 'Monthly';
					const ReportDate = metadata[2];
					const CompanyCode = metadata[3];
					const JobNo = metadata[4];
					const ServerName = metadata[5];

					const fileSizeInBytes = md5size(filePath);
					const hash = md5hash(filePath);

					const holdFolderPath = `${mf.holdFolder}/${curDatePlusHr}`;
					//the final holding path + filename
					const holdFilePath = `${rootPath}${holdFolderPath}/${fileName}`;

					//insert metadata in db
					const insertStatement =
						`insert into "${mf.dbtablename}" (reportname, versionid, reportfrequency, reportdate, companycode, jobno, servername, holdpath, ` +
						`m_status, m_md5, m_lastupdated, m_lastupdatedby, m_filesize, m_filename) ` +
						`values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, current_timestamp, 'daily-ingestion', $11, $12)`;

					const values = [
						ReportName,
						VersionId,
						ReportFrequency,
                                                ReportDate,
						CompanyCode,
                                                JobNo,
                                                ServerName,
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
