//
const fse = require('fs-extra');
const path = require('path');
const config = require('config');

const dmconfig = config.get('dailyingestion.directory-monitor');
const rootpath = dmconfig.rootpath;

const copyMd5 = (sourcePath, copyToPath, fileName) =>
	new Promise((resolve, reject) => {
		let copyPath = `${rootpath}${copyToPath}/${fileName}`;

		fse.pathExists(copyPath).then((exists) => {
			if (!exists) {
				fse
					.copy(sourcePath, copyPath, {
						encoding: 'utf8',
						flag: 'w',
					})
					.then((results) => {
						resolve(copyPath);
					})
					.catch((err) => {
						reject(err);
					});
			}
		});
	});

module.exports = copyMd5;
