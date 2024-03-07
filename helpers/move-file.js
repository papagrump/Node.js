//
const fse = require('fs-extra');
const fs = require('fs');
const path = require('path');
const config = require('config');
const moveToHold = require('./move-hold');

const dmconfig = config.get('dailyingestion.directory-monitor');
const rootpath = dmconfig.rootpath;

const moveFile = (sourcePath, moveToPath, moveErrorPath) =>
	new Promise(async (resolve, reject) => {
		let fileName = path.basename(sourcePath);
		let movePath = `${rootpath}${moveToPath}/${fileName}`;

		let ext = path.extname(sourcePath);
		let fname = path.basename(sourcePath, ext);

		let i = 1;
		let ready = new Boolean(false);
		do {
			const exists = await fse.pathExists(`${movePath}`);
			// .then((exists) => {
			if (exists) {
				++i;
				movePath = `${rootpath}${moveErrorPath}/${fname}_DUP${i}${ext}`;
			} else {
				ready = Boolean(true);
			}
			//}
			//);
			// .catch((err) => {
			// 	console.log(err);
			// });
		} while (ready !== true);
		fse
			.move(sourcePath, movePath, {
				encoding: 'utf8',
				flag: 'w',
			})
			.then(() => {
				resolve(`${movePath}`);
			})
			.catch((err) => {
				reject(err);
			});
	});
module.exports = moveFile;
