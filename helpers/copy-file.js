//
const fse = require('fs-extra');
const path = require('path');
const config = require('config');

const dmconfig = config.get('dailyingestion.directory-monitor');
const rootpath = dmconfig.rootpath;

const copyFile = (sourcePath, copyToPath, copyErrorPath) =>
	new Promise(async (resolve, reject) => {
		let fileName = path.basename(sourcePath);
		let copyPath = `${rootpath}${copyToPath}/${fileName}`;

		let ext = path.extname(sourcePath);
		let fname = path.basename(sourcePath, ext);

		let i = 0;
		let ready = false;
		do {
			const exists = await fse.pathExists(`${movePath}`);
			if (exists) {
				++i;
				copyPath = `${rootpath}${copyErrorPath}/${fname}_DUP${i}${ext}`;
			} else {
				ready = true;
			}
			//});
		} while (!ready);
		fse
			.copy(sourcePath, copyPath, {
				encoding: 'utf8',
				flag: 'w',
			})
			.then((result) => {
				copied = true;
				resolve(copyPath);
			})
			.catch((err) => {
				reject(err);
			});
	});

module.exports = copyFile;
