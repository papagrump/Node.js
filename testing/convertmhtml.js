// var mhtml = require('mhtml');

// console.log('starting.');
// mhtml.extract(
// 	'//icp-001/CSMP/HMTL_Test_Data/IRP_Test.mhtml',
// 	'//icp-001/CSMP/HMTL_Test_Data',
// 	function (err) {
// 		console.log('done.');
// 	}
// );

// const { Parser } = require('fast-mhtml');
// const p = new Parser({
// 	rewriteFn: filenamify, // default, urls are rewritten with this function
// });
// const result = p
// 	.parse(mhtmlFileContents) // parse file
// 	.rewrite() // rewrite all links
// 	.spit(); // return all contents

// // result is an array of { contents: string, filename: string }

// const { Processor } = require('fast-mhtml');
// Processor.convert('//icp-001/CSMP/HMTL_Test_Data/IRP_Test.mhtml'); // returns a promise that fulfills when the conversion is done

const { JSDOM } = require('jsdom');
mhtml2html = require('mhtml2html');
parseDOM = (html) => new JSDOM(html);
//chai = require('chai');
fs = require('fs');

readMHTML = function (file, callback) {
	fs.readFile(
		`//icp-001/CSMP/HMTL_Test_Data/${file}`,
		'utf8',
		function (err, data) {
			if (err) {
				throw err;
			}
			callback(data);
		}
	);
};

readMHTML('IRP_Test.mhtml', (data) => {
	let doc;

	doc = mhtml2html.convert(data, { parseDOM });
	console.log(doc);
});
