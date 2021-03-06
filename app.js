var http = require('http');
var url = require('url');
const querystring = require('querystring');
const { readdirSync, statSync, existsSync, createReadStream, appendFileSync } = require('fs');
const iesJSON = require('./require/iesJSON/iesJsonClass.js');
const jsonConstants = require('./require/iesJSON/iesJsonConstants.js');
const iesCommon = require('./require/iesCommon.js');
const { Console } = require('console');

var websiteEngines = {};
var debugLog = "";
var debugMode = 99;
var debugFile = "";
var debugHttpFile = "";
var forwardedHost = false;  // For PRODUCTION set this to true :: forces us to read x-forwarded-host instead

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

function timestamp(){
      function pad(n) {return n<10 ? "0"+n : n}
      d=new Date();
      dash="-";
      return d.getFullYear()+dash+
      pad(d.getMonth()+1)+dash+
      pad(d.getDate())+dash+
      pad(d.getHours())+dash+
      pad(d.getMinutes())+dash+
      pad(d.getSeconds())
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

// Load SERVER parameters
let serverCfg = new iesJSON();
serverCfg.DeserializeFlexFile('./server.cfg'); // Cannot log the error yet, log file has not been created.
if (serverCfg.Status == 0) {
      debugMode = serverCfg.getNum('debugMode',debugMode);
      forwardedHost = serverCfg.getBool('forwardedHost',forwardedHost);
}

// Setup debug log
if (debugMode>0) {
      var ts = timestamp();
      debugFile = "./log/app_log_" + ts + ".txt";
      appendFileSync(debugFile,"app.js Start: " + ts + "\n");
} 

// Now that the log file is set, log the error that may have occurred when opening server.cfg above.
if (serverCfg.Status != 0 && debugMode > 0) {
      appendFileSync(debugFile,"ERROR: Failed to load server.cfg. [ERR9417]\n");
} 

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

// **************************************************************************
// **************************************************************************
// **************************************************************************
// **************************************************************************
// **************************************************************************
// **************************************************************************
// **************************************************************************

http.createServer(function (req, res) {

let cms = {}; // Primary CMS object to hold all things CMS
let err = 0;
let errMessage = "";

//const { method, url, headers } = req;
const q = 'z'; //url.parse(req.url,true).query;
cms.url = url.parse(req.url,true);
cms.server = serverCfg;
const p = 'z'; //url.parse(req.url,true).pathname;
const s = 'z'; //url.parse(req.url,true).search;

 
if (debugMode>0) {
      var ts = timestamp();
      debugHttpFile = "./log/httpServer_log_" + ts + ".txt";
      appendFileSync(debugHttpFile,"httpServer Start: " + ts + "\n" +
            "url: " + req.url + "\n");
}


let cookies = parseCookies( req.headers.cookie );

  if (!vStatic) {
        vStatic = Date.now();
}
        vDynamic = Date.now();

  // parse URL
  /* var urlPath = req.url; ** use cms.url.pathname - includes path + file + extension (not query params)*/
  /* var urlParamString = null; */
  var pathExtPosition = cms.url.pathname.lastIndexOf('.');
  cms.pathExt = (pathExtPosition < 0) ? '' : cms.url.pathname.substr(pathExtPosition+1).toLowerCase();
  cms.urlHost = null;
  if (!forwardedHost) { cms.urlHost = req.headers.host; }
  else { cms.urlHost = req.headers['x-forwarded-host']; }
  cms.urlBasePath = '';
  cms.urlFileName = '';
  cms.fileFullPath = ''; // This should get set by the website engine
  cms.resultType = '';
  cms.mimeType = '';

  /*
  let urlSepPosition = urlPath.indexOf("?"); ** use cms.url.pathname
  try {
      if (urlSepPosition >=0) { 
            // urlParamString = urlPath.slice(urlSepPosition+1); ** use cms.url.query 
            urlPath = urlPath.slice(0,urlSepPosition);
      }
  } catch (errSepPosition) {}
  */
  cms.urlPathList = decodeURI(cms.url.pathname).split("/");  // FUTURE: Not sure this is needed
  if (!cms.urlPathList[0]) {cms.urlPathList.shift();} // removed the initial /
  if (cms.urlPathList.length <= 1 || (!cms.urlPathList[0])) {
        // no first item in path
        cms.urlBasePath='';
  } else {
        cms.urlBasePath=cms.urlPathList[0].trim();
  }
  if (cms.urlPathList.length >= 1) {
        cms.urlFileName=cms.urlPathList.pop();
  }
  
  // Parse URL Parameters TODO
  // Already parsed... cms.url.query

  // Detemrine SiteID
  cms.siteID = null;
  try { cms.siteID = iesDomains[cms.urlHost.toLowerCase()]; } catch {}
  if (!cms.siteID) {
        err = 171; // ERR171
        errMessage = "Failed to find site for domain: " + cms.urlHost + " [ERR" + err + "]";
        if (debugMode > 0) {
            appendFileSync(debugHttpFile,"ERROR: " + errMessage + "\n");
        }
        // We were getting peppered with odd URLs... so here we end the call rather than responding with the default hostsite
        cms.resultType = 'abort';  // this will skip other response types
        res.connection.destroy();
  }

  cms.SERVER = serverCfg; // FUTURE: CLONE THIS JSON SO A WEBSITE ENGINE CANNOT MESS UP THE ORIGINAL
  
  if (cms.siteID) {
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
            cfg = new iesJSON("{}");
            }
      cms.SITE = cfg;

      // PROCESS REQUEST
      cms.hostsiteEngine = websiteEngines.hostsite;
      cms.thisEngine = websiteEngines[cms.siteID];
      cms.Html = "ERROR: nosite [ERR-14159]";
      //cms.iesCommon = new iesCommon();
      try {
            if (cms.thisEngine && typeof cms.thisEngine.CreateHtml == "function") {
                  debugLog += "thisEngine.CreateHtml()\n";
                  cms.thisEngine.CreateHtml(cms);
            } else {
                  if (cms.hostsiteEngine && typeof cms.hostsiteEngine.CreateHtml == "function") {
                        debugLog += "hostsiteEngine.CreateHtml()\n";
                        // We leave a reference to thisEngine in case it has Custom Tags
                        cms.hostsiteEngine.CreateHtml(cms);
                  }
            }
      } catch (e) {
            cms.Html = "SERVER ERROR [ERR-0001]: " + e + "<br>" + cms.Html;
            cms.resultType='html';
      }
  } // end if(cmsSiteID)

  mimic = cookies.mimic;
  newCookies = {};
  newCookies.mimic = mimic?mimic:'';
  newCookies.random = 'green toad';

  /* FUTURE: HOW TO HANDLE GET/POST/etc.
  if (req.method !== 'GET') {
        res.statusCode = 501;
        res.setHeader('Content-Type', 'text/plain');
        return res.end('Method not implemented');
    }
  */

  if (cms.resultType=='file') {
        if (!cms.fileFullPath) {
            res.setHeader('Content-Type', 'text/plain');
            res.statusCode = 404;
            res.end('Not found');
        } else {
            var streamFile = createReadStream(cms.fileFullPath);
            streamFile.on('open', function () {
                res.setHeader('Content-Type', cms.mimeType);
                streamFile.pipe(res);
            });
            streamFile.on('error', function () {
                // FUTURE: may want to indicate or log other types of errors here?
                res.setHeader('Content-Type', 'text/plain');
                res.statusCode = 404;
                res.end('Not found');
            });
      }
  }
  if (cms.resultType=='html') {
  
      let myHead = [];
      myHead.push(['Set-Cookie', 'mycookie4=test4']);
      myHead.push(['Set-Cookie', 'mycookie5=test5']);
      if (cms.url.query.mimic) {
            myHead.push(['Set-Cookie', 'mimic=' + cms.url.query.mimic]);
      }
      //myHead.push(['Content-Type', 'text/plain']);
      myHead.push(['Content-Type', 'text/html']);
      res.writeHead(200, myHead);

      let DebbugerMessage = 
      'method=' + req.method + '\n'
      + 'url Path=' + cms.url.pathname + '\n'
      + 'url PathExtension=' + cms.pathExt + '\n' 
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
      + 'urlPathList:' + JSON.stringify(cms.urlPathList) + '\n'
      + 'iesDomains:' + JSON.stringify(iesDomains) + '\n'
      + 'urlBasePath:' + cms.urlBasePath + '\n'
      + debugLog;

      if (debugMode>0) {
            appendFileSync(debugHttpFile,"err=" + err + ":" + errMessage + "\n" +
                  "============ DebbugerMessage =================\n" + DebbugerMessage + "\n");
      } 
      if (err !=0) { cms.Html = "ERROR: " + errMessage; }
      // if (debugMode > 5) { cms.Html += '\n\n' + DebbugerMessage; }
      res.end(cms.Html);
      
  } // end if (cms.resultType=='html')

  if (debugMode>0) {
      appendFileSync(debugHttpFile,"httpServer processing complete: " + timestamp() + "\n");
      } 

}).listen(serverPort);

if (debugMode>0) {
      appendFileSync(debugFile,"app.js Setup complete.\n");
} 