var http = require('http');
var url = require('url');
const querystring = require('querystring');
const { readdirSync, statSync, existsSync } = require('fs');
const iesJSON = require('./require/iesJSON/iesJsonClass.js');
const jsonConstants = require('./require/iesJSON/iesJsonConstants.js');
const iesCommon = require('./require/iesCommon.js');
const { Console } = require('console');

var websiteEngines = {};
var debugLog = "";

let vStatic = null;
let vDynamic = null;
let mimic = null;

const serverPort = 8118;
const serverConfig = ".\\secrets\\server.cfg";
const websitePathTemplate='./websites/{{siteID}}/site.cfg';

function requireDynamically(path)
{
    path = path.split('\\').join('/'); // Normalize windows slashes
    return eval(`require('${path}');`); // Ensure Webpack does not analyze the require statement
}

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
      var dPath=websitePathTemplate.replace('{{siteID}}',dDir);
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

            // Load/Reqiure website engine if it exists...
            var enginePath = './require/website_' + dDir + '.js';
            if (existsSync(enginePath)) {
                  //var newEngine = requireDynamically(enginePath);
                  var newEngine = require(enginePath);
                  //websiteEngines[dDir] = newEngine; //new newEngine();
                  websiteEngines[dDir] = new newEngine(dDir);
                  console.log("LOAD/REQUIRE WEBSITE ENGINE: " + enginePath);
            }

          } catch(err) {
            console.error(err)
          }
});

function parseCookies(str) {
      let rx = /([^;=\s]*)=([^;]*)/g;
      let obj = { };
      for ( let m ; m = rx.exec(str) ; )
        obj[ m[1] ] = decodeURIComponent( m[2] );
      return obj;
    }

    function stringifyCookies(thesecookies) {
      return Object.entries( thesecookies )
        .map( ([k,v]) => k + '=' + encodeURIComponent(v) )
        .join( '; ');
    }

http.createServer(function (req, res) {

let cms = {}; // Primary CMS object to hold all things CMS
let err = 0;
let errMessage = "";

//const { method, url, headers } = req;
const q = 'z'; //url.parse(req.url,true).query;
cms.url = url.parse(req.url,true);
const p = 'z'; //url.parse(req.url,true).pathname;
const s = 'z'; //url.parse(req.url,true).search;

let cookies = parseCookies( req.headers.cookie );

  if (!vStatic) {
        vStatic = Date.now();
}
        vDynamic = Date.now();

  // parse URL
  var urlPath = req.url;
  var urlParamString = null;
  cms.urlHost = req.headers.host;
  var urlBasePath = '';
  let urlSepPosition = urlPath.indexOf("?");
  try {
      if (urlSepPosition >=0) { 
            urlParamString = urlPath.slice(urlSepPosition+1);
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
  
  // Parse URL Parameters TODO
  // Already parsed... cms.url.query

  // Detemrine SiteID
  cms.siteID = null;
  try { cms.siteID = iesDomains[cms.urlHost.toLowerCase()]; } catch {}
  if (!cms.siteID) {
        err = 171;
        errMessage = "Failed to find site for domain: " + cms.siteID + " [ERR" + err + "]";
  }

  
  // Mimic (can only mimic on hostsite)
  if (cms.siteID == 'hostsite') {
        // check if mimic specified in URL
        if (cms.url.query.mimic) {
              cms.siteID = cms.url.query.mimic;
              // set mimic cookie TODO
              // newCookies.add('mimic',cms.siteID);
        } else {
            // check for mimic cookie
            if (cookies.mimic) {
              cms.siteID = cookies.mimic;
            }
        }
  }

  // Read Site config (first check if config already loaded)
  var dPath=websitePathTemplate.replace('{{siteID}}',cms.siteID);
  let cfg = null;
  try {
        if (existsSync(dPath)) {
              let tmpCfg = new iesJSON();
              tmpCfg.DeserializeFlexFile(dPath);
              if (tmpCfg.Status ==0 && tmpCfg.jsonType=='object') {
                    cfg = tmpCfg;
              }
        } 
      } catch {}
  if (!cfg) { 
      err = 173;
      errMessage = "Failed to load config file: " + dPath + " [ERR" + err + "]";
      }

  // PROCESS REQUEST
  cms.hostsiteEngine = websiteEngines.hostsite;
  cms.thisEngine = websiteEngines[cms.siteID];
  cms.Html = "ERROR: nosite [ERR-14159]";
  //cms.iesCommon = new iesCommon();
  if (cms.thisEngine && typeof cms.thisEngine.CreateHtml == "function") {
      debugLog += "thisEngine.CreateHtml()\n";
      cms.thisEngine.CreateHtml(cms);
  } else {
        if (cms.hostsiteEngine && typeof cms.hostsiteEngine.CreateHtml == "function") {
            debugLog += "hostsiteEngine.CreateHtml()\n";
              cms.hostsiteEngine.CreateHtml(cms);
        }
      }

  mimic = cookies.mimic;
  newCookies = {};
  newCookies.mimic = mimic?mimic:'';
  newCookies.random = 'green toad';
  /*
  res.writeHead(200, [
        ['Set-Cookie', 'mycookie4=test5'],
        ['Set-Cookie', 'mycookie5=test6'],
        ['Set-Cookie', 'mimic='],
        ['Content-Type', 'text/plain']
  ]);
*/
  let myHead = [];
  myHead.push(['Set-Cookie', 'mycookie4=test4']);
  myHead.push(['Set-Cookie', 'mycookie5=test5']);
  if (cms.url.query.mimic) {
      myHead.push(['Set-Cookie', 'mimic=' + cms.url.query.mimic]);
  }
  myHead.push(['Content-Type', 'text/plain']);
  res.writeHead(200, myHead);

  let DebbugerMessage = 
  'method=' + req.method + '\n'
  + 'url Path=' + urlPath + '\n'
  + 'url Params=' + urlParamString + '\n'
  + 'url Params=' + JSON.stringify(cms.url.query) + '\n'
  + 'host=' + cms.urlHost + '\n'
  + 'protocol=' + req.headers.protocol + '\n'
 + 'x-forwarded-host=' + req.headers['x-forwarded-host'] + '\n'
 + 'x-forwarded-proto=' + req.headers['x-forwarded-proto'] + '\n'
 + querystring.stringify(req.headers) + '\n'
 + 'Header cookies=' + JSON.stringify(cookies) + '\n'
 //'query=' + q + '\n'
  +  'host=' + cms.urlHost + '\n'
      //+ 'path=' + p + '\n'
  + 'search=' + s + '\n'
  + 'vStatic=' + vStatic + '\n'
  + 'vDynamic=' + vDynamic + '\n'
  + 'siteID=' + cms.siteID + '\n'
  + 'mimic=' + mimic + '\n'
  + 'newCookies=' + stringifyCookies(newCookies) + '\n'
  + 'Hello s53 World! [from node.js]\n'
  + 'DIR List:' + JSON.stringify(siteList) + '\n'
  + 'urlPathList:' + JSON.stringify(urlPathList) + '\n'
  + 'iesDomains:' + JSON.stringify(iesDomains) + '\n'
  + 'urlBasePath:' + urlBasePath + '\n'
  + debugLog;

  if (err==0) {
      res.end(cms.Html + '\n\n' + DebbugerMessage);
  } else {
      res.end("ERROR: " + errMessage + '\n\n' + DebbugerMessage);
  } 
}).listen(serverPort);