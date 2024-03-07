const Chokidar = require('chokidar');
const path = require('path');
const util = require('util');
const fs = require('fs-extra');
const Queue = require('promise-queue');
const waitFor = util.promisify(setTimeout);

const config = require('config').get('dailyingestion.directory-monitor');
const moveFile = require('../helpers/move-file');
const log = require('../helpers/log');
const {
	ERROR,
	WARNING,
	SUCCESS,
	DEBUG,
} = require('../constants/message-types');
const logPrefix = path.basename(module.filename, path.extname(module.filename));
const maxConcurrentRequests = 300;

class DirectoryMonitor {
	static async init(onlyOneTime) {
		DirectoryMonitor._queue = new Queue(maxConcurrentRequests, Infinity);
		DirectoryMonitor._monitoredFolders = [];
		DirectoryMonitor._folderObjList = [];
		DirectoryMonitor._watcher = Chokidar.watch([]);

		// shutdown gracefully, needs more testing, not sure it is really working
		const shutdown = (code) => {
			DirectoryMonitor._watcher.close();
			setTimeout(() => {
				process.exit(code === 0 ? 0 : 1);
			}, 1000);
		};

		process.on('SIGINT', () => {
			log(logPrefix, 'Received CTRL-C Signal');
			shutdown(1);
		});

		// Apply configuration
		DirectoryMonitor._watcher = await DirectoryMonitor._applyConfiguration(
			DirectoryMonitor._watcher
		);

		if (onlyOneTime) {
			setTimeout(() => {
				shutdown(0);
			}, 2000);
		}

		// TODO ask if it makes sense ? -> relaunch FS scanning from the beginning :
		//  log(logPrefix, `SetInterval ${config.reloadIntervalms}...`, DEBUG);
		//  setInterval(async () => {
		//       //Reset configuration
		//      DirectoryMonitor._watcher = await DirectoryMonitor._applyConfiguration(DirectoryMonitor._watcher);
		//  }, config.reloadIntervalms);
	}

	/**
	 *
	 * @param watcher
	 * @returns {Promise<FSWatcher>}
	 * @private
	 */
	static async _applyConfiguration(watcher) {
		log(logPrefix, `Apply configuration`, DEBUG);

		await watcher.close();
		DirectoryMonitor._monitoredFolders = [];
		let folderObjList = [];

		// get monitoredFolder list from config file
		log(logPrefix, `Getting watched folders...`, DEBUG);
		let mfData = fs.readFileSync(config.monitoredfoldersconfig);
		folderObjList = JSON.parse(mfData).monitoredfolders;
		folderObjList.forEach((folder) => {
			if (folder.enabled) {
				DirectoryMonitor._monitoredFolders.push(folder.monitorpath);
			}
		});

		const newWatcher = Chokidar.watch(DirectoryMonitor._monitoredFolders, {
			ignored: /(^|[\/\\])\../, // ignore dotfiles
			awaitWriteFinish: true, //don't pick up file until write is done
			persistent: true,
			usePolling: true, //needed for network folders to process correctly
			depth: 0, //only monitor root folders, not subfolders
		})
			.on('add', async (thePath) => {
				//process the file that was received
				log(logPrefix, `Found file to process: ${thePath}`, DEBUG);

				await DirectoryMonitor._processFiles(thePath, folderObjList);
			})
			.on('error', (error) => {
				log(logPrefix, `Watcher error|${error}`, ERROR);
			})
			.on('ready', () =>
				log(logPrefix, 'directory-monitor-single Initial folder scan complete. Started monitoring...')
			);

		// add the updated monitored folders
		newWatcher.add(DirectoryMonitor._monitoredFolders);

		log(
			logPrefix,
			`Loaded Monitored Folders|${JSON.stringify(
				DirectoryMonitor._monitoredFolders
			)}`,
			SUCCESS
		);
		return newWatcher;
	}

	/**
	 *
	 * @param filePath
	 * @param folderObjList
	 * @returns {Promise<void>}
	 * @private
	 */
	static async _processFiles(filePath, folderObjList) {
		log(logPrefix, `Processing file: ${filePath}`, DEBUG);

		for (const folder of folderObjList) {
			try {
				DirectoryMonitor._queue.add(async () => {
					await DirectoryMonitor._processFile(filePath, folder);
				});
			} catch (err) {
				log(logPrefix, err, ERROR);
			}
		}
	}

	/**
	 *
	 * @param filePath
	 * @param folder
	 * @returns {Promise<void>}
	 * @private
	 */
	static async _processFile(filePath, folder) {
		const fileIsInThisParticularFolder = path
			.resolve(folder.monitorpath)
			.endsWith(path.dirname(filePath));

		if (!folder.enabled || !fileIsInThisParticularFolder) {
			return; // not handled
		}

		if (folder.inTestMode) {
			const testTime = 5000 * Math.random();
			log(logPrefix, `Test File | ${filePath} ${testTime}`, SUCCESS);
			return waitFor(testTime);
		}

		//move if movetopath defined and enabled
		if (folder.movetopath) {
			const newPath = await moveFile(
				filePath,
				folder.movetopath,
				folder.moveerrorpath
			);
			log(logPrefix, `Staged File|${newPath}`, SUCCESS);

			// TODO use path.resolve ?
			const curPath = path
				.dirname(newPath)
				.split(path.sep)
				.join(path.posix.sep); //make the path unix format

			if (curPath === config.rootpath + folder.movetopath) {
				try {
					// get the handler and process it
					log(logPrefix, `Calling Handler: ${folder.handler}`, DEBUG);
					const processPath = path.resolve(
						path.join(__dirname, config.fileprocessorspath, folder.handler)
					);
					const process = require(processPath);
					const response = await process(newPath, folder, config.rootpath); // send the new location after move
					log(logPrefix, response, SUCCESS);
				} catch (error) {
					log(
						logPrefix,
						`Unable to process handler|${folder.handler} ${JSON.stringify(
							error
						)}`,
						ERROR
					);
				}
			}
		} else {
			log(
				logPrefix,
				`No movetopath defined for ${folder.description} monitored folder`,
				WARNING
			);
		}
	}
}

const workOnce = process.env.WORK_ONCE === 'true';
log(
	logPrefix,
	'Starting' + (workOnce ? ' and will work only one time' : ''),
	DEBUG
);
DirectoryMonitor.init(workOnce)
	.then(() => {
		log(logPrefix, 'directory-monitor-single Initialized', SUCCESS);
	})
	.catch((err) => {
		log('Error: ' + JSON.stringify(err), ERROR);
	});
