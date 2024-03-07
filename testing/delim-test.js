const DelimitedFileReader = require('delimited-file-reader');

let fileReader = new DelimitedFileReader('|', [
	'ignore',
	'filePath',
	'jobNumber',
	'reportName',
	'customerName',
	'statementDate',
	'statementDate2',
	'statementDate3',
	'customerNumber',
	'accountType',
	'unknown1',
	'unknown2',
	'unknown3',
	'unknown4',
	'unknown5',
]);

fileReader.on('comment', (comment) => {
	console.log(`comment: ${comment}`);
});

fileReader.on('data', (data) => {
	//console.log(`data: ${JSON.stringify(data)}`);
	console.log(data.filePath);
});

fileReader.on('close', () => {
	console.log('Elvis has left the building!');
});

// The parse method takes a string filename or a read stream as an argument.
fileReader.parse('./ARCust_R5503VAC_GM0001_5096666_GTX.DAT');

// comment: # Example file using comma delimited format with comments
// data: {"field_0":"value1-1","field_1":"value2-2"}
// data: {"field_0":"value2-1","field_1":"value2-2"}
// Elvis has left the building!
