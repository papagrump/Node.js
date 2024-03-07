//const gulp = require('gulp');
const fse = require('fs-extra');
const klaw = require('klaw');
const through2 = require('through2');
//load helpers
const moveFile = require('../helpers/move-file');
const copyFile = require('../helpers/copy-file');
const log = require('../helpers/log');
const config = require('config').get('dailyingestion.directory-monitor');
const path = require('path');

//define a variable to hold the folders to be monitored
//var monitoredFolders = [];
var folderObjList = [];

var moveto = '';
var movefrom = '//icp-001/DailyIngest/FromBOL/save';

//get monitoredFolder list from config file
let mfData = fse.readFileSync(config.monitoredfoldersconfig);
folderObjList = JSON.parse(mfData).monitoredfolders;
folderObjList.forEach((folder) => {
	if (folder.description == 'Bill Of Lading') {
		moveto = folder.monitorpath;
	}
});

console.log(`moveto: ${moveto}`);
console.log(`movefrom: ${movefrom}`);

const fileFilter = (el) => {
	//x = path.extname(el).toUpperCase();
	return path.extname(el).toUpperCase() === `.PDF`;
};

let options = {
	depthLimit: 0,
	filter: fileFilter,
};

const excludeDirFilter = through2.obj(function (item, enc, next) {
	if (!item.stats.isDirectory()) this.push(item);
	next();
});

const items = []; // files, directories, symlinks, etc
klaw(movefrom, options)
	.pipe(excludeDirFilter)
	//.on('data', file => console.log(`moveFile('${file.path}', '${moveto}').then();`))
	.on('data', (file) =>
		copyFile(file.path, moveto).then(() =>
			console.log(`moveFile('${file.path}', '${moveto}').then();`)
		)
	)
	.on('end', () => console.log('done'));

//(async () => {
//	for await (const file of klaw(movefrom, options)
//  .pipe(excludeDirFilter)) {
//		//console.log(file.path);
//		//put move here
//		console.log(`moveFile('${file.path}', '${moveto}').then();`);
//		//moveFile(file.path, moveto).then();
//	}
//})();

//copybol();
//var moveto = '/var/www/demo/wp-content/themes/demo/';

// const src = config.gulp.task('default', ['bol'], function () {});

// gulp.task('bol', function () {
// 	gulp.src(movefrom).pipe(gulp.dest(moveto));
// });

// gulp.task('scripts', function () {
// 	gulp.src('./js/*.js', { base: './' }).pipe(gulp.dest(moveto));
// });

// const moveFiles = require('@cloudcmd/move-files');
// const cwd = process.cwd();
// const from = cwd + '/pipe-io';
// const to = cwd + '/example';
// const abortOnError = false;

// const mv = moveFiles(movefrom, moveto, ['*.pdf']);

// mv.on('file', (from, to) => {
// 	console.log(`${from} -> ${to}`);
// });

// mv.on('directory', (from, to) => {
// 	console.log(`${from} -> ${to}`);
// });

// // mv.on('progress', (percent) => {
// // 	console.log(percent);

// // 	if (percent >= 50) {
// // 		//mv.pause();
// // 		//mv.continue();
// // 	}
// // });

// // mv.on('pause', () => {
// // 	console.log('paused');
// // 	//mv.continue();
// // });
// // move
// // 	.on('file', console.log)
// // 	.on('error', console.log)
// // 	.on('end', wraptile(console.log, 'done'));
// mv.on('error', (error) => {
// 	console.error(`${error.message}`);

// 	if (abortOnError) return mv.abort();

// 	mv.continue();
// });

// // mv.on('end', () => {
// // 	console.log('Moving ended up');
// // });

// //mv.pause();
