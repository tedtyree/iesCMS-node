/*  
Copyright 2022 Ted Tyree - ieSimplified.com

Permission is hereby granted, free of charge, to any person obtaining a copy of this 
software and associated documentation files (the "Software"), to deal in the Software
without restriction, including without limitation the rights to use, copy, modify, 
merge, publish, distribute, sublicense, and/or sell copies of the Software, and to 
permit persons to whom the Software is furnished to do so, subject to the 
following conditions:

The above copyright notice and this permission notice shall be included in all copies 
or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, 
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A 
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT 
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION 
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE 
OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

// ****************************************************
// Utility: makeTruffle.js

const { writeFileSync } = require('fs');
const FlexJson = require('../require/FlexJson/FlexJsonClass.js');
const jsonConstants = require('../require/FlexJson/FlexJsonConstants.js');
const iesCommonLib = require('../require/iesCommon.js');
const { Console } = require('console');

const serverConfig = "../secrets/server.cfg";
const trufflePath = "../secrets/trufflebd.cfg";
let cms = new iesCommonLib(); // Primary CMS object to hold all things CMS

// Load SERVER parameters
let serverCfg = new FlexJson();
serverCfg.DeserializeFlexFile(serverConfig); // Cannot log the error yet, log file has not been created.
if (serverCfg.Status == 0) {
} else {
      throw new Error('Error :failed to parse server config1 ' + serverCfg.statusMsg);
}
cms.SERVER = serverCfg;

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Enter truffle user id: ', function (id) {
  rl.question('Enter truffle pwd: ', function (pwd) {
    console.log(`writing truffle to /server folder`);
    let newTruffle = cms.MakeTruffle(id + "|" + pwd + "|" + cms.TruffleID());
    writeFileSync(trufflePath, newTruffle);
    rl.close();
  });
});

rl.on('close', function () {
  console.log('\n done.');
  process.exit(0);
});