/* parseJson.js
Parse a JSON file and display any errors.
usage: node parseJson.js ./filepath/filename.json [additional list of file paths]
*/
const FlexJson = require('../require/FlexJson/FlexJsonClass.js');

const myArgs = process.argv.slice(2);

for (var idx in myArgs) {
  const filepath = myArgs[idx];
  console.log("==========================================================");
  console.log("PARSING ", filepath);
  var json = new FlexJson();
  json.DeserializeFlexFile(filepath);
  console.log("json.Status=", json.Status);
  console.log("json.statusMsg=", json.statusMsg);
  console.log("json.jsonType=", json.jsonType);
  console.log(json.jsonString);
}
console.log("==========================================================");
console.log("done.");