const path = require('path');
const { DateTime } = require('luxon');
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
const Queue = require('promise-queue');
//const PQueue = require('p-queue');
const {
	asyncParallelForEach,
	BACK_OFF_RETRY,
} = require('async-parallel-foreach');

//queueing
const maxConcurrentRequests = 10;
let queue = new Queue(maxConcurrentRequests, Infinity); //new PQueue({ concurrency: 50 });
//let results = [];

const logPrefix = path.basename(module.filename, path.extname(module.filename));

function processFile(opts) {
	try {
		//get the handler
		var process = require(`./${opts.dType.handler}`);
	} catch (error) {
		log(logPrefix, `Unable to load handler|${opts.dType.handler}`, ERROR);
	}
	process(
		`${opts.dLine.FilePath}`,
		opts.dType,
		opts.rPath,
		opts.dLine,
		opts.hFilePath
	)
		.then((response) => {
			log(logPrefix, `${response}`, SUCCESS);
		})
		.catch((error) => {
			log(logPrefix, `${error}`, ERROR);
		});
}

async function processALine(dataLine, index, rootPath, docType, holdFilePath) {
	fse
		.pathExists(dataLine.FilePath)
		.then((exists) => {
			if (exists) {
				//if (fse.existsSync(results[i].FilePath)) {
				let toPath = `${rootPath}${docType.pdfpath}/${path.basename(
					dataLine.FilePath
				)}`;

				// copy pdf to ToNuxeo
				fse
					.copyFile(dataLine.FilePath, toPath)
					.then(() => {
						log(logPrefix, `Copied PDF to hold|${dataLine.FilePath}`, DEBUG);

						dataLine.FilePath = toPath; // set filepath to new location

						// Queue transactions
						//queue.add(() => {
							processFile({
								dType: docType,
								dLine: dataLine,
								rPath: rootPath,
								hFilePath: holdFilePath,
							});
						//});
						// queue.add(
						// 	processFile.bind(this, {
						// 		dType: docType,
						// 		dLine: dataLine,
						// 		rPath: rootPath,
						// 		hFilePath: holdFilePath,
						// 	})
						// );
						log(
							logPrefix,
							`Added record: ${index + 1} to processing queue`,
							DEBUG
						);
					})
					.catch((err) => {
						log(
							logPrefix,
							`Failed to process record ${index}|${dataLine}`,
							DEBUG
						);
					});
			} else {
				//PDF doesn't exist
				log(
					logPrefix,
					`Missing PDF file, skipping record ${index}|${dataLine}`,
					WARNING
				);
			}
		})
		.catch((error) => {
			reject(`${error.message}`);
		});
}

async function processLines(lines, rootPath, docType, holdFilePath) {
	const parallelLimit = 5//50; // process at most 5 lines simultaneously

	const theResults = await asyncParallelForEach(
		lines,
		parallelLimit,
		async (dataLine, index) => {
			processALine(dataLine, index, rootPath, docType, holdFilePath);
		}
	);
	return theResults;
}

function process(datFilePath, mf, rootPath) {
	return new Promise((resolve, reject) => {
		fse
			.pathExists(datFilePath)
			.then((exists) => {
				if (exists) {
					let results = [];
					log(logPrefix, `Started Processing DAT file: ${datFilePath}`, DEBUG);
					const fileName = path.win32.basename(datFilePath);
					const ext = path.extname(datFilePath);
					const controlFileName = path.basename(datFilePath, ext);
					const thePrefix = controlFileName.split('_')[0];
					const docType = mf.documenttypes.find(
						({ filenameprefix }) => filenameprefix === thePrefix
					);
					if (docType == undefined) {
						throw err;
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
							log(logPrefix, `Bad control file data|${data}`, ERROR);
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

							results.push(dataLine);
						});

						controlFileParser.on('close', () => {
							//process pdfs

							log(
								logPrefix,
								`Found ${results.length} records in control file ${datFilePath}`,
								DEBUG
							);

							processLines(results, rootPath, docType, holdFilePath)
								.then((theResults) => {
									//copy to webcenter for dual filing and then move dat file to hold after pdfs are processed
									if (
										docType.copytopath != null &&
										docType.copytopath != undefined
									) {
										copyToWebCenter(datFilePath, docType.copytopath).then(
											(msg) => {
												log(
													logPrefix,
													`Copied DAT to WebCenter|${msg}`,
													SUCCESS
												);
												moveToHold(datFilePath, `${holdFilePath}`)
													.then((msg) => {
														log(logPrefix, `Moved DAT file to hold|${msg}`);
													})
													.catch((err) => {
														log(
															logPrefix,
															`Moving DAT file to hold|${err.message}`,
															ERROR
														);
													});
											}
										);
									}
								})
								.catch();

							resolve(`Processed MMS DAT File|${datFilePath}`);
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
