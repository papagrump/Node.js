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
					//PACKLIST_0030074911_3078542_25129583_052721_1234567.pdf
					const fileName = path.win32.basename(filePath);
					const ext = path.extname(filePath);
					const fname = path.basename(filePath, ext);
                                        var   billTo = '';
					const metadata = fname.split('_');
                                        if (metadata.length == 6)
                                           {
					      billTo= metadata[5];
                                           }
                
					const printDate = metadata[4];
					const invoiceNumber = metadata[3];
					const orderNumber = metadata[2];
					const containerId = metadata[1];

					const fileSizeInBytes = md5size(filePath);
					const hash = md5hash(filePath);

					const holdFolderPath = `${mf.holdFolder}/${curDatePlusHr}`;
					//the final holding path + filename
					const holdFilePath = `${rootPath}${holdFolderPath}/${fileName}`;

					//insert metadata in db
					const insertStatement =
						`insert into "${mf.dbtablename}" ( containerid, ordernumber, invoicenumber, printdate, billto, holdpath, ` +
						`m_status, m_md5, m_lastupdated, m_lastupdatedby, m_filesize, m_filename) ` +
						`values ($1, $2, $3, $4, $5, $6, $7, $8, current_timestamp, 'daily-ingestion', $9, $10)`;

					const values = [
						containerId,
						orderNumber,
						invoiceNumber,
						printDate,
                                                billTo,
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
									if (mf.copytopath != null && mf.copytopath != undefined) {
										copyToWebCenter(holdFilePath, mf.copypdfpath)
											.then((pdfPath) => {
												log(
													logPrefix,
													`Copied to WebCenter PDFTemp|${pdfPath}`,
													SUCCESS
												);
												//***** output .dat file line */
												let timeStamp =
													DateTime.now().toFormat('y-LL-dd_HH_mm');
												fse.ensureDirSync(`${rootPath}${mf.copydatpath}`); //copydatpath folder
												let datPath = `${rootPath}${mf.copydatpath}/PACKLIST_${timeStamp}.DAT`;
												// const pdfPath = path
												// 	.dirname(`${rootPath}${mf.copypdfpath}`)
												// 	.split(path.posix.sep)
												// 	.join(path.win32.sep); //make the path windows format
												let datLine = `APPEND PAGE|${pdfPath}|${containerId}|${orderNumber}|${invoiceNumber}||${printDate}|\r\n`;
												fse
													.appendFile(datPath, datLine)
													.then((msg) => {
														log(
															logPrefix,
															`Appended .DAT file in DATTemp|${datPath}`,
															SUCCESS
														);
													})
													.catch((err) => {
														log(`${logPrefix}_append.DAT`, err.message, ERROR);
														//reject(`Error moving file to WebCenter: ${filename}`);
													});
											})
											.catch((err) => {
												log(`${logPrefix}_copyToWebCenter`, err.message, ERROR);
												//reject(`Error moving file to WebCenter: ${filename}`);
											});
									}
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
