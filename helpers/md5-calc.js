//
const fse = require('fs-extra'); //Load the filesystem module
const md5File = require('md5-file');

module.exports = {
	md5hash: function (filePath) {
		// return md5File.sync(filePath);

		const hash = md5File.sync(filePath); //.then((hash) => {
		return hash;
		//});
	},
	md5size: function (filePath) {
		const stats = fse.statSync(filePath); //.then((stats) => {
		return stats.size;
		//});
	},
};
