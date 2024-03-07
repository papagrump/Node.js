const path = require('path');
const { DateTime } = require('luxon');
const ZipFs = require('../../helpers/zip-fs');
const processPDF = require('./mpa-invoice');
const log = require('../../helpers/log');
const {
	ERROR,
	WARNING,
	SUCCESS,
	DEBUG,
} = require('../../constants/message-types');
const fse = require('fs-extra');
const DelimitedFileReader = require('delimited-file-reader');
const moveToHold = require('../../helpers/move-hold');
const Queue = require('promise-queue');
//const PQueue = require('p-queue');

//queueing
//const maxConcurrentRequests = 100;
//const queue = new PQueue({ concurrency: maxConcurrentRequests });
//let queue = new Queue(maxConcurrentRequests, Infinity);

const logPrefix = path.basename(module.filename, path.extname(module.filename));

function processFile(opts) {
	return new Promise((resolve, reject) => {
		opts.dLine.invoiceNumber = opts.dLine.invoiceNumber.substring(
			2,
			opts.dLine.invoiceNumber.length
		);
		let tmpStr = opts.dLine.invoiceAmount.charAt(
			opts.dLine.invoiceAmount.length - 1
		);
		if (tmpStr == '-') {
			opts.dLine.invoiceAmount = '-' + opts.dLine.invoiceAmount.slice(0, -1);
		}

		const holdFldrDate = DateTime.now().toFormat(
			`${opts.mf.holdfolderpattern}`
		);

		let pdfFilePath = `${opts.rPath}${
			opts.mf.holdFolder
		}/${holdFldrDate}/${path.basename(opts.zFilePath, '.zip')}`;

		let pdfReadStream;
		let zip = new ZipFs(`${opts.zFilePath}`);
		try {
			pdfReadStream = zip.createReadStream(
				`${opts.zipInternalPath}/${opts.dLine.pdfName}`,
				'utf8'
			);
		} catch (err) {
			log(logPrefix, err.message, ERROR);
			reject('rejected');
		}

		//fse.ensureDirSync(pdfFilePath);
		const pdfWriteStream = fse.createWriteStream(
			`${pdfFilePath}/${opts.dLine.pdfName}`
		);
		pdfReadStream.pipe(pdfWriteStream);

		pdfWriteStream.on('close', () => {
			log(logPrefix, `Moved to Hold|${pdfFilePath}/${opts.dLine.pdfName}`);
			zip.close((err) => {});
			processPDF(
				`${pdfFilePath}/${opts.dLine.pdfName}`,
				opts.mf,
				opts.rPath,
				opts.dLine
			)
				.then((response) => {
					log(logPrefix, `${response}`, SUCCESS);
				})
				.catch((error) => {
					log(logPrefix, `${error}`, ERROR);
				});
		});
		resolve('Finished');
	});
}

function process(zipFilePath, mf, rootPath) {
	return new Promise((resolve, reject) => {
		fse
			.pathExists(zipFilePath)
			.then((exists) => {
				if (exists) {
					//queueing
					const maxConcurrentRequests = 50;
					//const queue = new PQueue({ concurrency: maxConcurrentRequests });
					let queue = new Queue(maxConcurrentRequests, Infinity);
					let results = [];
					let zip = new ZipFs(`${zipFilePath}`);
					let zipInternalPath = `usr/sap/PRD/SYS/interfaces/client300/GetPaid_Invoices/${path
						.basename(zipFilePath, '.zip')
						.replace('GETPAID_', 'TEMP_DIR_')}`;
					zip.readdir(zipInternalPath, (err, files) => {
						if (err) {
							log(logPrefix, err.message, ERROR);
						} else {
							//get control file from array
							const controlFile = files.find((file) => {
								let ext = path.extname(file.toUpperCase());
								return ext == '.TXT';
							});
							files.pop();
							log(logPrefix, `Control File = ${controlFile}`);
							log(logPrefix, `There are ${files.length} pdf files`);

							const controlReadStream = zip.createReadStream(
								`${zipInternalPath}/${controlFile}`,
								'utf8'
							);

							controlReadStream.on('error', (err) => {
								if (err) {
									log(logPrefix, `error: ${err.message}`, ERROR);
								}
							});

							const holdFldrDate = DateTime.now().toFormat(
								`${mf.holdfolderpattern}`
							);
							let controlFilePath = `${rootPath}${
								mf.holdFolder
							}/${holdFldrDate}/${path.basename(zipFilePath, '.zip')}`;

							//makes sure hold folder path exists
							fse.ensureDirSync(`${controlFilePath}`);
							const controlWriteStream = fse.createWriteStream(
								`${controlFilePath}/${controlFile}`
							);

							controlWriteStream.on('error', (err) => {
								if (err) {
									log(logPrefix, `error: ${err.message}`, ERROR);
								}
							});

							//set up control file csv parser
							let controlFileParser = new DelimitedFileReader(
								'|',
								mf.metadatacolumnheaders
							);

							//pipe to hold location and parse control file
							controlReadStream.pipe(controlWriteStream);
							controlFileParser.parse(controlReadStream);

							controlFileParser.on('invalid', (data) => {
								let prefix = data.substring(0, 2);
								if (prefix == '01') {
									log(logPrefix, 'Ignore first line of control file', DEBUG);
								} else if (prefix == '99') {
									log(logPrefix, 'Ignore last line of control file', DEBUG);
								} else {
									log(logPrefix, `Bad control file data|${data}`, ERROR);
								}
							});

							controlFileParser.on('error', (err) => {
								log(logPrefix, `controlFileReader|${err.message}`, ERROR);
							});

							controlFileParser.on('data', (dataLine) => {
								log(
									logPrefix,
									`Found record in DAT file|${dataLine.pdfName}`,
									DEBUG
								);
								try {
									if (mf.validcompanycodes.indexOf(dataLine.companyCode) + 1) {
										if (files.includes(`${dataLine.pdfName}`)) {
											results.push(dataLine);
										} else {
											log(
												logPrefix,
												`PDF File not found in file list|${dataLine.pdfName}`,
												ERROR
											);
										}
									} else {
										log(
											logPrefix,
											`Ignored invalid companyCode|${JSON.stringify(dataLine)}`,
											WARNING
										);
									}
								} catch (err) {
									console.log(err.message);
									log(
										logPrefix,
										`Failed to process control file record|${dataLine.pdfName}`,
										ERROR
									);
								}
							});

							controlReadStream.on('end', () => {
								log(
									logPrefix,
									`Found ${results.length} records in control file ${controlFilePath}`,
									DEBUG
								);

								zip.close((err) => {
									if (err) {
										log(logPrefix, err.message, ERROR);
									} else {
										//successfully closed
										log(logPrefix, `Closing zip file|${zipFilePath}`);
										moveToHold(zipFilePath, `${mf.holdFolder}/ProcessedZips`)
											.then((msg) => {
												log(
													logPrefix,
													`Copied control file to hold|${msg}`,
													DEBUG
												);
											})
											.catch((err) => {
												log(
													logPrefix,
													`Failed to copy control file to hold|${err.msg}`,
													DEBUG
												);
											});
									}
								});

								//process pdfs
								for (let i = 0; i < results.length; i++) {
									log(
										logPrefix,
										`Adding record: ${i + 1} to processing queue`,
										DEBUG
									);

									// processFile.bind(this, {
									// 	zipInternalPath: zipInternalPath,
									// 	zFilePath: zipFilePath,
									// 	dLine: results[i],
									// 	rPath: rootPath,
									// 	mf: mf,
									// })
									queue.add(() => {
										processFile({
											zipInternalPath: zipInternalPath,
											zFilePath: zipFilePath,
											dLine: results[i],
											rPath: rootPath,
											mf: mf,
										});
									});
								}
							});
						}
					});
					resolve(`Processed MTS Invoices Zip File|${zipFilePath}`);
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
