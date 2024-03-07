const config = require('config');
const path = require('path');
const fs = require('fs-extra');
const log = require('../../helpers/log');
const { ERROR, WARNING, SUCCESS } = require('../../constants/message-types');

//get config for move-dat
const mdConfig = config.get('dailyingestion.move-dat-manager');

setInterval(function () {
	// fse.readdir (new .dat file)
	let files = [];
	files = fse.readdir(mdConfig.fromLocation);

	// get .pdf filename - get basename and prepend with holdingfolder location
	// copy the pdfs to /ToWebCenter/PDFtemp from /ToNuxeo/Holding) - sync
	// move .dat to ToWebcenter/input - aysnc
	files.forEach((file) => {
		let toDataPath = path();
		let fromDatPath = path();
		fse.move(fromDatPath, toDataPath);
	});
}, mdConfig.runIntervalms);
