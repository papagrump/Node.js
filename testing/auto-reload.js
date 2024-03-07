var fs = require('fs');
var reload = require('auto-reload');
var data = reload('./data', 3000); // reload every 3 secs

// print data every sec
setInterval(function () {
	console.log(data);
}, 1000);

// update data.json every 3 secs
setInterval(function () {
	var data = '{ "name":"' + Math.random() + '" }';
	fs.writeFile('./data.json', data);
}, 3000);
