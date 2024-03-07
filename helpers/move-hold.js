//
const fse = require('fs-extra');
const path = require('path');
const config = require('config');

const dmconfig = config.get('dailyingestion.directory-monitor');
const rootpath = dmconfig.rootpath;

const moveToHold = (sourcePath, moveToPath) =>
	new Promise(async (resolve, reject) => {
		let fileName = path.basename(sourcePath);
		let movePath = `${rootpath}${moveToPath}/${fileName}`;

		let i = 1;
		let ready = false;
		do {
			const exists = await fse.pathExists(`${movePath}`);
			if (exists) {
				++i;
				ext = path.extname(sourcePath);
				fname = path.basename(sourcePath, ext);
				movePath = `${rootpath}${moveToPath}/${fname}_DUP${i}${ext}`;
			} else {
				ready = true;
			}
			//});
		} while (ready !== true);
		fse
			.move(sourcePath, movePath, {
				encoding: 'utf8',
				flag: 'w',
			})
			.then((results) => {
				moved = true;
				resolve(movePath);
			})
			.catch((err) => {
				reject(err);
			});
	});

module.exports = moveToHold;
