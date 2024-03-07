const fse = require('fs-extra');

const JSON_WHITESPACE = 4;

const writeJson = (file, contents) =>
	new Promise((resolve, reject) => {
		fse.writeFile(
			file,
			JSON.stringify(contents, null, JSON_WHITESPACE),
			(err) => {
				if (err) {
					reject(err);
				}
				resolve(`${file} written`);
			}
		);
	});

module.exports = writeJson;
