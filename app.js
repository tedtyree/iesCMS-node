var http = require('http');
var url = require('url');
const querystring = require('querystring');
const { readdirSync, statSync, existsSync } = require('fs');
const iesJSON = require('./require/iesJSON/iesJsonClass.js');
const jsonConstants = require('./require/iesJSON/iesJsonConstants.js');

let vStatic = null;
let vDynamic = null;

const serverPort = 8118;
const serverConfig = ".\\secrets\\server.cfg";


// =======================================================
// DEVELOPMENT ENVIRONMENT
const env_development = {
	serverBasePath: 'C:\\~Local\\github\\iesCMS-node'  // Local PC - Development Environment
	,pathSeperator: '\\'  // Local PC - Development Environment
}

// =======================================================
// PRODUCTION ENVIRONMENT
const env_production = {
	serverBasePath: '/var/www/s99.tedtyree.com/nodejs'  // Linux Server - Production Environment
	,pathSeperator: '/'  // Linux Server = Production Environment
}

// =======================================================
// Select one environment - comment out the others...
const env = env_development;
// const env = env_production;

// Get list of websites
var path = './websites'
var dlist = readdirSync(path).filter(function (file) {
    return statSync(path+'/'+file).isDirectory();
  });
var iesDomains = {};
var siteList = [];
console.log('DIR List:' + JSON.stringify(dlist));
dlist.forEach(dDir => {
      var dPath='./websites/' + dDir + '/site.cfg';
      try {
            if (existsSync(dPath)) {
              //file exists
              let cfg = new iesJSON();
              cfg.DeserializeFlexFile(dPath);
              if (cfg.Status ==0 && cfg.jsonType=='object') {
                  let siteID = cfg.i("SITEID").toStr();
                  if (siteID != '' && siteID == dDir) {
                        console.log('>>> SITEID: ' + cfg.i("SITEID").toStr());
                        siteList.push(siteID);
                        // loop through 
                        let domainList = cfg.i('Domains');
                        domainList.toJsonArray().forEach(oneDomain => {
                              domainName = oneDomain.toStr().toLowerCase();
                              // FUTURE: Check for duplicates - raise error
                              if (iesDomains[domainName]) {
                                    console.log("ERROR: Duplicate Domain [" + domainName + "] ./websites/" + dDir);
                              } else {
                                    console.log("  +++ " + domainName + " [" + siteID + "]");
                                    iesDomains[domainName] = siteID;
                              }
                        });
                  } else {
                    // Problem with SITEID
                    console.log("ERROR: SiteID missmatch [" + siteID + "] ./websites/" + dDir);
                  }
              } else {
                  // Problem reading config...
                  console.log(">>> Failed to read site.cfg: /websites/" + dDir);
                  console.log("status=" + cfg.Status + ", StatusMsg=" + cfg.StatusMsg);
              }
            }
          } catch(err) {
            console.error(err)
          }
});

http.createServer(function (req, res) {
//const { method, url, headers } = req;
const q = 'z'; //url.parse(req.url,true).query;
const h = url.parse(req.url,true).host;
const p = 'z'; //url.parse(req.url,true).pathname;
const s = 'z'; //url.parse(req.url,true).search;
  if (!vStatic) {
        vStatic = Date.now();
}
        vDynamic = Date.now();

  // parse URL
  var urlPath = req.url;
  var urlParams = null;
  var urlBasePath = '';
  let urlSepPosition = urlPath.indexOf("?");
  try {
      if (urlSepPosition >=0) { 
            urlParams = urlPath.slice(urlSepPosition+1);
            urlPath = urlPath.slice(0,urlSepPosition);
      }
  } catch (errSepPosition) {}
  var urlPathList = urlPath.split("/");
  if (!urlPathList[0]) {urlPathList.shift();} // removed the initial /
  if (urlPathList.length == 0 || (!urlPathList[0])) {
        // no first item in path
        urlBasePath='';
  } else {
        urlBasePath=urlPathList[0].trim();
  }

  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('method=' + req.method + '\n'
         + 'url Path=' + urlPath + '\n'
         + 'url Params=' + urlParams + '\n'
         + 'host=' + req.headers.host + '\n'
         + 'protocol=' + req.headers.protocol + '\n'
        + 'x-forwarded-host=' + req.headers['x-forwarded-host'] + '\n'
        + 'x-forwarded-proto=' + req.headers['x-forwarded-proto'] + '\n'
        + querystring.stringify(req.headers) + '\n'
        //'query=' + q + '\n'
         +  'host=' + h + '\n'
		 //+ 'path=' + p + '\n'
         + 'search=' + s + '\n'
         + 'vStatic=' + vStatic + '\n'
         + 'vDynamic=' + vDynamic + '\n'
         + 'Hello s53 World! [from node.js]\n'
         + 'DIR List:' + JSON.stringify(siteList)
         + 'urlPathList:' + JSON.stringify(urlPathList)
         + 'urlBasePath:' + urlBasePath);
}).listen(8118);