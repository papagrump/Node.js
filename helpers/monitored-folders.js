const fse = require('fs-extra');
//define a variable to hold the folders to be monitored
var allMonitoredFolders = [];
var enabledMonitoredFolders = [];
var folderObjArray = [];
var enabledFolderObjArray = [];

function checkEnabled(fldr) {
	return fldr.enabled == true;
}
//get monitoredFolder list from config file
let mfData = fse.readFileSync('./config/monitored-folders.json');
folderObjarray = JSON.parse(mfData).monitoredfolders;
folderObjarray.forEach((folder) => {
	allMonitoredFolders.push(folder.monitorpath);
	if (folder.enabled) {
		enabledFolderObjArray.push(folder);
		enabledMonitoredFolders.push(folder.monitorpath);
	}
});

module.exports = {
	allMonitoredFolders,
	enabledMonitoredFolders,
	folderObjArray,
	enabledFolderObjArray,
};
