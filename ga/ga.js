const request = require('request');

const username = 'eso4263';
const password = 'Lionel$5';
const host = 'http://dev-mftweb.mckesson.com:8001/goanywhere/rest/gacmd/v1/projects';

auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
//auth = "Basic ZXNvNDI2MzpMaW9uZWwkNQ==";
console.log(auth);

var jsonDataObj = {
	"runParameters" :
{
		"project":"/Nuxeo/System Monitoring/Nuxeo Regression Test",
		"domain":"domain-ecm",
		"jobName" : "test",
		"jobQueue" : "jobs-queue-ecm",
		"mode" : "batch",
		"priority" : "10"
		
	}
};

request.post({
    url: host,
    body: jsonDataObj,
    json: true,
	headers : {
		"Authorization" : auth
	}
  }, (err, res, body) => {
	if (err) { return console.log(err); }
	console.log(body.url);
	console.log(body.explanation);
  });

/* request.post({
    url: host,
    body: jsonDataObj,
    json: true
  }, function(error, response, body){
  console.log(body);
}); */
/* request('https://dev-mftweb.mckesson.com:8001/goanywhere/rest/gacmd/v1/projects', { json: true }, (err, res, body) => {
  if (err) { return console.log(err); }
  console.log(body.url);
  console.log(body.explanation);
}); */

/* POST http://example-server:8000/goanywhere/rest/gacmd/v1/projects
{
	"runParameters" :
{
		"project":"Data Translation",
		"domain":"Chicago Campus",
		"jobName" : "Script Transfer",
		"jobQueue" : "SFTP",
		"mode" : "batch",
		"priority" : "10",
		"variables" :
		[
			{
				"key" : "Customer Name",
				"value" : "example"
			},
			{
				"key" : "Customer Location",
				"value" : "Chicago"
			}
		]
	}
} */