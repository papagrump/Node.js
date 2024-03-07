//var http = require('http');
var os = require('os');
var url = require('url');

const express = require('express');
const path = require('path');

const app = new express();

//set view engine
app.set('view engine', 'pug');

app.listen(3000, () => {
	console.log('App listning on port 3000');
});

app.get('/server', (req, res) => {
	//res.writeHead();
	try {
		const serverinfo = {
			HostName: `${os['hostname']().toUpperCase()}`,
			OSType: `${os['type']()}`,
			OSVersion: `${os['version']()}`,
			HostUptime: `${os['uptime']()}`,
			HostLoadAvg: `${os['loadavg']()}`,
			HostTotalMemory: `${os['totalmem']() / (1024 * 1000000)} GB`,
			HostFreeMemory: `${os['freemem']() / (1024 * 1000000)} GB`,
		};
		res.render('server-info', { serverList: serverinfo });
	} catch (e) {
		console.log(e);
		res.end('try : ' + Object.keys(os).join(', '));
	}
});

// http
// 	.createServer(function (req, res) {
// 		res.writeHead(200, { 'Content-Type': 'text/plain' });
// 		var parse_url = url.parse(req.url).pathname.replace(/.*\/|\.[^.]*$/g, '');
// 		if (parse_url === 'all') {
// 			Object.keys(os).map(function (method) {
// 				res.write(method + ':' + JSON.stringify(os[method](), 2, true)) + ',';
// 			});
// 		} else {
// 			try {
// 				var result = os[parse_url]();
// 				res.write(JSON.stringify(result), 'utf8');
// 			} catch (e) {
// 				res.end('try : ' + Object.keys(os).join(', '));
// 			}
// 		}

// 		res.end();
// 	})
// 	.listen(3000, 'localhost');
// console.log('Server running at http://localhost:3000/');
