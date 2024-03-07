//Main program for Daily Ingest
const express = require('express');
const path = require('path');
var os = require('os');
var url = require('url');
var {
	allMonitoredFolders,
	enabledMonitoredFolders,
} = require('./helpers/monitored-folders');

function checkEnabled(fldr) {
	return fldr.enabled == true;
}

const app = new express();

//set view engine
app.set('view engine', 'pug');

app.listen(3000, () => {
	console.log('App listning on port 3000');
});

app.get('/', (req, res) => {
	res.render('index');
});

app.get('/about', (req, res) => {
	res.render('about');
});

app.get('/contact', (req, res) => {
	res.render('contact');
});

app.get('/monitoredfolders', (req, res) => {
	try {
		myList = allMonitoredFolders.filter(checkEnabled);
		res.render('monitored-folders', { folderList: enabledMonitoredFolders });
	} catch (e) {
		console.log(e);
		res.end('Problem fetching folder list');
	}
});

//try : arch, cpus, endianness, freemem, getPriority, homedir, hostname, loadavg, networkInterfaces,
// platform, release, setPriority, tmpdir, totalmem, type, userInfo, uptime, version, constants, EOL
app.get('/server', (req, res) => {
	try {
		const serverinfo = {
			HostName: `${os.hostname().toUpperCase()}`,
			CPUInfo: `${os.cpus()[0].model} with ${os.cpus().length} cores`,
			HostTotalMemory: `${os.totalmem() / (1024 * 1000000)} GB`,
			HostFreeMemory: `${os.freemem() / (1024 * 1000000)} GB`,
			HostUptime: `${os.uptime()}`,
			HostLoadAvg: `${os.loadavg()}`,
			OSType: `${os.type()}`,
			OSVersion: `${os.version()}`,
			NodeVersion: `${process.version}`,
		};
		res.render('server-info', { serverList: serverinfo });
	} catch (e) {
		console.log(e);
		res.end('try : ' + Object.keys(os).join(', '));
	}
});
