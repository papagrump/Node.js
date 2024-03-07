const path = require('path');
const util = require('util');
const { DateTime } = require('luxon');
const db = require('../../db');
const moveToHold = require('../../helpers/move-hold');
const copyToWebCenter = require('../../helpers/copy-towebcenter');
const log = require('../../helpers/log');
const {
	ERROR,
	WARNING,
	SUCCESS,
	DEBUG,
} = require('../../constants/message-types');
const fse = require('fs-extra');
const DelimitedFileReader = require('delimited-file-reader');
//const PQueue = require('p-queue');
const {
	asyncParallelForEach,
	BACK_OFF_RETRY,
} = require('async-parallel-foreach');
const pathExists = util.promisify(fse.pathExists);
const copyFile = util.promisify(fse.copyFile);
const { v1: uuidv1, v4: uuidv4 } = require('uuid');
const logPrefix = path.basename(module.filename, path.extname(module.filename));

// queueing :
// const Queue = require('promise-queue');
// const maxConcurrentRequests = 10;
// let queue = new Queue(maxConcurrentRequests, Infinity); //new PQueue({ concurrency: 50 });
// let results = [];

// async function processFile(opts) {
// 	try {
// 		//get the handler
// 		var process = require(`./${opts.dType.handler}`);
// 		process(
// 			`${opts.dLine.FilePath}`,
// 			opts.dType,
// 			opts.rPath,
// 			opts.dLine,
// 			opts.hFilePath
// 		)
// 			.then((response) => {
// 				log(logPrefix, `${response}`, SUCCESS);
// 			})
// 			.catch((error) => {
// 				log(logPrefix, `${error}`, ERROR);
// 			});
// 	} catch (error) {
// 		log(logPrefix, `Unable to load handler|${opts.dType.handler}`, ERROR);
// 	}
// }

async function processALine(dataLine, index, rootPath, docType, holdFilePath) {
	const exists = await pathExists(dataLine.FilePath);
	if (!exists) {
		log(
			logPrefix,
			`Missing PDF file, skipping record ${index}|${dataLine}`,
			WARNING
		);
		return;
	}

	let toPath = `${rootPath}${docType.pdfpath}/${path.basename(
		dataLine.FilePath
	)}`;

	// copy pdf to ToNuxeo
	try {
		await copyFile(dataLine.FilePath, toPath);
	} catch (err) {
		log(logPrefix, `Failed to process record ${index}|${dataLine}`, DEBUG);
		return;
	}

	log(logPrefix, `Copied PDF to hold|${dataLine.FilePath}`, DEBUG);
	dataLine.FilePath = toPath; // set filepath to new location

	// Queue transactions
	//queue.add(() => {
	// processFile({
	// 	dType: docType,
	// 	dLine: dataLine,
	// 	rPath: rootPath,
	// 	hFilePath: holdFilePath,
	// });
	//});
	try {
		//get the handler
		const processA = require(`./${docType.handler}`);
		const response = await processA(
			`${dataLine.FilePath}`,
			docType,
			rootPath,
			dataLine,
			holdFilePath
		);
		log(logPrefix, `${response}`, SUCCESS);
		return response;
	} catch (error) {
		log(logPrefix, `Unable to load handler|${docType.handler}`, ERROR);
	}
	//log(logPrefix, `Added record: ${index + 1} to processing queue`, DEBUG);
}

const chunkItems = (items, size) =>
	items.reduce((chunks, item, index) => {
		const chunk = Math.floor(index / size);
		chunks[chunk] = [].concat(chunks[chunk] || [], item);
		return chunks;
	}, []);

/**
 *
 * @param lines
 * @param rootPath
 * @param docType
 * @param holdFilePath
 * @returns {Promise<*>}
 */
async function processLines(lines, rootPath, docType, holdFilePath) {
	const parallelLimit = 25; // process at most 5 lines simultaneously
	const chunks = chunkItems(lines, 25);
	let processedResults = [];
	let i = 0;
	for (const chunk of chunks) {
		i += 1;
		log(logPrefix, `Processing chunk: ${i}`, DEBUG);
		const results = await asyncParallelForEach(
			chunk,
			parallelLimit,
			async (dataLine, lIndex) => {
				const result = await processALine(
					dataLine,
					lIndex,
					rootPath,
					docType,
					holdFilePath
				);
				return result;
			}
		);
		processedResults = processedResults.concat(results);
	}
	return processedResults;
}

/**
 *
 * @param datFilePath
 * @param mf
 * @param rootPath
 * @returns {Promise<unknown>}
 */
function process(datFilePath, mf, rootPath) {
	return new Promise((resolve, reject) => {
		fse
			.pathExists(datFilePath)
			.then((exists) => {
				if (exists) {
					let results = [];
					log(logPrefix, `Started Processing DAT file: ${datFilePath}`, DEBUG);
					const datFileName = path.win32.basename(datFilePath);
					const ext = path.extname(datFilePath);
					const controlFileName = path.basename(datFilePath, ext);
					const thePrefix = controlFileName.split('_')[0];
					const docType = mf.documenttypes.find(
						({ filenameprefix }) => filenameprefix === thePrefix
					);
					let job_uuid = uuidv4();
					if (!docType) {
						throw new Error('docType is undefined');
					}

					//check for enabled
					if (docType.enabled) {
						const holdFldrDate = DateTime.now().toFormat(
							`${docType.holdfolderpattern}`
						);
						let holdFilePath = `${docType.holdFolder}/${holdFldrDate}/${controlFileName}`;
						//makes sure folder paths exist
						fse.ensureDirSync(`${rootPath}${holdFilePath}`); //holdfolder path
						fse.ensureDirSync(`${rootPath}${docType.pdfpath}`); //pdftemp path

						//set up control file csv parser
						let controlFileParser = new DelimitedFileReader(
							'|',
							docType.metadatacolumnheaders
						);
						//
						log(logPrefix, `Starting to parse control file|${datFilePath}`);
						//parse the dat file
						controlFileParser.parse(`${datFilePath}`);

						controlFileParser.on('invalid', (data) => {
							log(logPrefix, `Bad control file data|${data}`, WARNING);
						});

						controlFileParser.on('error', (err) => {
							log(logPrefix, `controlFileReader error|${err.message}`, ERROR);
						});

						controlFileParser.on('data', (dataLine) => {
							log(
								logPrefix,
								`Found record in DAT file|${dataLine.FilePath}`,
								DEBUG
							);
							// add the job_id to the dataLine
							dataLine.job_uuid = job_uuid;
							results.push(dataLine);
						});

						controlFileParser.on('close', async () => {
							//process pdfs
							try {
								log(
									logPrefix,
									`Found ${results.length} records in control file ${datFilePath}`,
									DEBUG
								);
								//
								// write audit record to DB
								//
								const insertStatement =
									`insert into "dailyctrl_job_auditing" (uuid, pre_record_count, input_filename)` +
									`values ($1, $2, $3)`;

								const values = [job_uuid, results.length, datFileName];

								db.query(insertStatement, values, (err, res) => {
									if (err) {
										log(
											logPrefix,
											`Got ${err.message} inserting record in dailyctrl_job_tracking`,
											DEBUG
										);
									} else {
										log(logPrefix, `Inserted record in dailyctrl_job_tracking`);
									}
								});

								const theResults = await processLines(
									results,
									rootPath,
									docType,
									holdFilePath
								);
								//
								//do something with results?? check for errors??
								//
								//copy to webcenter for dual filing and then move dat file to hold after pdfs are processed
								if (docType.copytopath) {
									const msgFromWebCenter = await copyToWebCenter(
										datFilePath,
										docType.copytopath
									);
									log(
										logPrefix,
										`Copied DAT to WebCenter|${msgFromWebCenter}`,
										SUCCESS
									);
									const msgFromMoving = await moveToHold(
										datFilePath,
										`${holdFilePath}`
									);
									log(
										logPrefix,
										`Moved DAT file to hold|${msgFromMoving}`,
										SUCCESS
									);
								}
								resolve(`Processed MMS DAT File|${datFilePath}`);
							} catch (err) {
								reject(`File processing error |${err.toString()}`);
							}
						});
					} else {
						reject(
							`Control file ignored document type not enabled|${datFilePath}`
						);
					}
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

// for (let i = 0; i < results.length; i++) {
// 	fse
// 		.pathExists(results[i].FilePath)
// 		.then((exists) => {
// 			if (exists) {
// 				//if (fse.existsSync(results[i].FilePath)) {
// 				let toPath = `${rootPath}${
// 					docType.pdfpath
// 				}/${path.basename(results[i].FilePath)}`;

// 				// copy pdf to ToNuxeo
// 				fse
// 					.copyFile(results[i].FilePath, toPath)
// 					.then(() => {
// 						log(
// 							logPrefix,
// 							`Copied PDF to hold|${results[i].FilePath}`,
// 							DEBUG
// 						);

// 						results[i].FilePath = toPath; // set filepath to new location

// 						// Queue transactions
// 						queue.add(
// 							processFile.bind(this, {
// 								dType: docType,
// 								dLine: results[i],
// 								rPath: rootPath,
// 								hFilePath: holdFilePath,
// 							})
// 						);
// 						log(
// 							logPrefix,
// 							`Added record: ${i + 1} to processing queue`,
// 							DEBUG
// 						);
// 					})
// 					.catch((err) => {
// 						log(
// 							logPrefix,
// 							`Failed to process record ${i}|${results[i]}`,
// 							DEBUG
// 						);
// 					});
// 			} else {
// 				//PDF doesn't exist
// 				log(
// 					logPrefix,
// 					`Missing PDF file, skipping record ${i}|${results[i]}`,
// 					WARNING
// 				);
// 			}
// 		})
// 		.catch((error) => {
// 			reject(`${error.message}`);
// 		});
// }
