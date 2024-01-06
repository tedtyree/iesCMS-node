var http = require('http');
var url = require('url');
//var axios = require('axios');
const jwt = require('jsonwebtoken');
const { parse, stringify } = require('querystring');// form submission 
const { Console } = require('console');

//const querystring = require('querystring');
const { readdirSync, statSync, existsSync, createReadStream, appendFileSync } = require('fs');
const iesJSON = require('./require/iesJSON/iesJsonClass.js');
const jsonConstants = require('./require/iesJSON/iesJsonConstants.js');
const iesCommonLib = require('./require/iesCommon.js');
const iesUser = require('./require/iesUser.js');

var httpQueryId = 0;

var websiteEngines = {};
var debugLog = "";
var debugMode = 99;
var debugFile = "";
var debugHttpFile = "";
var forwardedHost = false;  // For PRODUCTION set this to true :: forces us to read x-forwarded-host instead

let vStatic = null;
let vDynamic = null;

const serverPort = 8118;
const serverSecretsFolder = "./secrets/";
const serverConfig = serverSecretsFolder + "server.cfg";
const websitePathTemplate = './websites/{{siteID}}/site.cfg';

function requireDynamically(path) {
      path = path.split('\\').join('/'); // Normalize windows slashes
      return eval(`require('${path}');`); // Ensure Webpack does not analyze the require statement
}

// =======================================================
// DEVELOPMENT ENVIRONMENT
const env_development = {
      serverBasePath: 'C:\\~Local\\github\\iesCMS-node'  // Local PC - Development Environment
      , pathSeperator: '\\'  // Local PC - Development Environment
}

// =======================================================
// PRODUCTION ENVIRONMENT
const env_production = {
      serverBasePath: '/var/www/s99.tedtyree.com/nodejs'  // Linux Server - Production Environment
      , pathSeperator: '/'  // Linux Server = Production Environment
}

function timestamp() {
      function pad(n) { return n < 10 ? "0" + n : n }
      let d = new Date();
      let dash = "-";
      return d.getFullYear() + dash +
            pad(d.getMonth() + 1) + dash +
            pad(d.getDate()) + dash +
            pad(d.getHours()) + dash +
            pad(d.getMinutes()) + dash +
            pad(d.getSeconds())
}

// =======================================================
// Select one environment - comment out the others...
const env = env_development;
// const env = env_production;

// Get list of websites
var path = './websites'
var dlist = readdirSync(path).filter(function (file) {
      return statSync(path + '/' + file).isDirectory();
});
var iesDomains = {};
var siteList = [];

// Load SERVER parameters
let serverCfg = new iesJSON();
serverCfg.DeserializeFlexFile(serverConfig); // Cannot log the error yet, log file has not been created.
if (serverCfg.Status == 0) {
      debugMode = serverCfg.getNum('debugMode', debugMode);
      forwardedHost = serverCfg.getBool('forwardedHost', forwardedHost);
} else {
      throw new Error('Error :failed to parse server config1 ' + serverCfg.statusMsg);
}



// Setup debug log
if (debugMode > 0) {
      var ts = timestamp();
      debugFile = "./log/app_log_" + ts + ".txt";
      appendFileSync(debugFile, "app.js Start: " + ts + "\n");
}

// Now that the log file is set, log the error that may have occurred when opening server.cfg above.
if (serverCfg.Status != 0 && debugMode > 0) {
      appendFileSync(debugFile, "ERROR: Failed to load server.cfg. [ERR9417]\n");
}

console.log('DIR List:' + JSON.stringify(dlist));
dlist.forEach(dDir => {
      var dPath = websitePathTemplate.replace('{{siteID}}', dDir);
      try {
            if (existsSync(dPath)) {
                  //file exists
                  let thiscfg = new iesJSON();
                  thiscfg.DeserializeFlexFile(dPath);
                  if (thiscfg.Status == 0 && thiscfg.jsonType == 'object') {
                        let siteID = thiscfg.i("SITEID").toStr();
                        if (siteID != '' && siteID == dDir) {
                              console.log('>>> SITEID: ' + thiscfg.i("SITEID").toStr());
                              siteList.push(siteID);
                              // loop through 
                              let domainList = thiscfg.i('Domains');
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
                        console.log("status=" + thiscfg.Status + ", StatusMsg=" + thiscfg.StatusMsg);
                  }
            }

            // Load/Reqiure website engine if it exists...
            var enginePath = './require/website_' + dDir + '.js';
            if (existsSync(enginePath)) {
                  //var newEngine = requireDynamically(enginePath);
                  try {
                        var newEngine = require(enginePath);
                  } catch (errWebEngine) {
                        console.log("!!! ERROR LOADING WEBSITE ENGINE: " + enginePath);
                        console.error(errWebEngine);
                  }
                  //websiteEngines[dDir] = newEngine; //new newEngine();
                  websiteEngines[dDir] = new newEngine(dDir);
                  console.log("LOAD/REQUIRE WEBSITE ENGINE: " + enginePath);
            }

      } catch (err) {
            console.error(err)
      }
});

function parseCookies(str) {
      let rx = /([^;=\s]*)=([^;]*)/g;
      let obj = {};
      for (let m; m = rx.exec(str);)
            obj[m[1]] = decodeURIComponent(m[2]);
      return obj;
}

function stringifyCookies(thesecookies) {
      return Object.entries(thesecookies)
            .map(([k, v]) => k + '=' + encodeURIComponent(v))
            .join('; ');
}


// **************************************************************************
// **************************************************************************
// **************************************************************************
// **************************************************************************
// **************************************************************************
// **************************************************************************
// **************************************************************************

http.createServer(async (req, res) => {

      let cms = new iesCommonLib(); // Primary CMS object to hold all things CMS
      let err = 0;
      let errMessage = "";

      //const { method, url, headers } = req;
      const q = 'z'; //url.parse(req.url,true).query;
      cms.url = url.parse(req.url, true);
      cms.SERVER = serverCfg;
      cms.secretsFolder = serverSecretsFolder;
      cms.req = req;
      cms.setHttpQueryId(httpQueryId++);

      debugLog = "app.js:http.createServer(): url=" + url.toString + "\n";

      
      cms.JWT_SECRET = cms.SERVER.getStr("JWT_SECRET"); 
      cms.JWT_EXPIRES_IN = cms.SERVER.getNum("JWT_EXPIRES_IN"); // seconds

      // Get post data using query string 
      try {

            if (cms.req.method === 'POST' || cms.req.method === 'PATCH') {

                  const buffers = [];
                  for await (const chunk of req) {
                        buffers.push(chunk);
                  }
                  cms.bodyText = Buffer.concat(buffers).toString();
				  
                  // Fake way to identify JSON payload vs. URL encoded payload
                  if (cms.bodyText.trim().substring(0,1) == '{') {
                        // JSON Payload
                        cms.body = JSON.parse(cms.bodyText);
                  } else {
                        // URL encoded payload
                        cms.body = parse(cms.bodyText);
                  }
                  // DEBUG
                  // console.log( cms.body );
            }
      } catch { }

      if (!cms.body) { cms.body = {}; }


      // EXPERIMENT TEST - FORWARD /api REQUESTS TO ANOTHER PORT OR SERVER
      // FUTURE - REMOVE THIS TEST SECTION - DEBUG DEBUG DEBUG
      //if (cms.url.pathname.substr(0,5).toLowerCase() == '/api_NOMATCH/') {
      //      try {
      //      let api = await axios({
      //            url: 'https://api.maddash2u.com' + cms.url.pathname,
      //            method: cms.req.method || 'GET',
      //            headers: {
      //                  'Content-Type': 'application/json'
      //                },
      //            data: cms.bodyText
      //          });
      //      } catch (e) { 
      //            let myHeadJ = [];
      //            myHeadJ.push(['Content-Type', 'application/json']);
      //            res.writeHead(500, myHeadJ);
      //            res.end(JSON.stringify({"error":e.message}));
      //            return; 
      //      }
      //
      //      let myHeadJ = [];
      //      myHeadJ.push(['Content-Type', 'application/json']);
      //      res.writeHead(200, myHeadJ);
      //      res.end(JSON.stringify(api.data));
      //      return; // exit and don't run any of the below
      //}

      cms.noUser();
      const p = 'z'; //url.parse(req.url,true).pathname;
      const s = 'z'; //url.parse(req.url,true).search;


      if (debugMode > 0) {
            var ts = timestamp();
            debugHttpFile = "./log/httpServer_log_" + ts + ".txt";
            appendFileSync(debugHttpFile, "httpServer Start: " + ts + "\n" +
                  "url: " + req.url + "\n");
      }


      cms.cookies = parseCookies(req.headers.cookie);
      if (!cms.cookies) { cms.cookies = {}; }

      if (!vStatic) {
            vStatic = Date.now();
      }
      vDynamic = Date.now();

      // parse URL
      /* var urlPath = req.url; ** use cms.url.pathname - includes path + file + extension (not query params)*/
      /* var urlParamString = null; */
      var pathExtPosition = cms.url.pathname.lastIndexOf('.');
      cms.pathExt = (pathExtPosition < 0) ? '' : cms.url.pathname.substr(pathExtPosition + 1).toLowerCase();
      cms.urlHost = null;
      if (!forwardedHost) { cms.urlHost = req.headers.host; }
      else { cms.urlHost = req.headers['x-forwarded-host']; }
      cms.urlBasePath = '';
      cms.urlFileName = '';
      cms.fileFullPath = ''; // This should get set by the website engine
      cms.resultType = '';
      cms.mimeType = '';
      cms.redirect = null; // note: if this is set to a url and fileType = HTML or REDIRECT then CMS attempts a redirect
      cms.newCookies = {};
      cms.abort = false; // set to TRUE to abort the request
      
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
      if (!cms.urlPathList[0]) { cms.urlPathList.shift(); } // removed the initial /
      if (cms.urlPathList.length <= 1 || (!cms.urlPathList[0])) {
            // no first item in path
            cms.urlBasePath = '';
      } else {
            cms.urlBasePath = cms.urlPathList[0].trim();
      }
      if (cms.urlPathList.length >= 1) {
            cms.urlFileName = cms.urlPathList.pop();
      }

      // Parse URL Parameters TODO
      // Already parsed... cms.url.query

      // Detemrine SiteID
      cms.siteId = null;
      try { cms.siteId = iesDomains[cms.urlHost.toLowerCase()]; } catch { }
      if (!cms.siteId) {
            err = 171; // ERR171
            errMessage = "Failed to find site for domain: " + cms.urlHost + " [ERR" + err + "]";
            if (debugMode > 0) {
                  appendFileSync(debugHttpFile, "ERROR: " + errMessage + "\n");
            }
            // We were getting peppered with odd URLs... so here we end the call rather than responding with the default hostsite
            cms.abort = true;  // this will skip other response types
            res.connection.destroy();
      }

      // NOTE: ALL .cfg files are forbidden within iesCMS because they may contain sensitive information
      if (cms.pathExt == 'cfg') {
            err = 993; // ERR993
            errMessage = "Invalid file extention: " + cms.pathExt + " [ERR" + err + "]";
            if (debugMode > 0) {
                  appendFileSync(debugHttpFile, "ERROR: " + errMessage + "\n");
            }
            cms.resultType = 'notfound';
            cms.abort = true;  // this will skip other response types
      }

      // GET USER TOKEN - FUTURE: Move this to other location?
      // FUTURE: Do we need to read the jwt if we are requesting a non-html file/img/resource?
      // FUTURE: Include 2 exp date/time stamps - one causes verification every 1 hour if user is still valid
      //   the other is a long-term exp that determines how often the user needs to repeat the login process.
      if (cms.cookies.token && !cms.abort) {
            let token = cms.cookies.token;
            try {
                  if (jwt.verify(token, cms.JWT_SECRET)) {
                        var decoded = jwt.decode(token, cms.JWT_SECRET);
                        if (decoded && decoded.user) {
                              // FUTURE: Expire token if it is pased due
                              let expDate = decoded.exp;
                              if (expDate && expDate < Date.now()) {
                                    cms.setUser(new iesUser(decoded.user));
                              } else {
                                    console.log("JWT EXPIRED: " + expDate);
                              }
                        }
                        // Later we verify user.siteid
                  }
            } catch (jwtErr) {
                  console.log("JWT ERROR: " + jwtErr.message);
            }

      }

      // This is already done above?
      //cms.SERVER = serverCfg; // FUTURE: CLONE THIS JSON SO A WEBSITE ENGINE CANNOT MESS UP THE ORIGINAL
      cms.mimic = '';
      if (cms.siteId && !cms.abort) {
            // Mimic (can only mimic on hostsite)
            // NOTE: Idea of enableMimic:true in site.cfg will not work because it is not loaded yet
            if (cms.siteId == 'hostsite') {
                  var override = '';
                  // check if mimic specified in URL
                  if (cms.url.query.mimic) {
                        override = cms.url.query.mimic;
                        // set mimic cookie
                        cms.newMimic = override;
                        cms.newCookies.mimic = override;
                  } else {
                        // check for mimic cookie
                        if (cms.cookies.mimic) {
                              override = cms.cookies.mimic;
                        }
                  }
                  if (override && override.toLowerCase() != 'none') {
                        cms.siteId = override;
                        cms.mimic = override;
                  }
            }

            // Verify user.siteid - if incorrect, null-out the user and related permissions
            if (cms.user.siteId != cms.siteId) { cms.noUser(); }

            // Read Site config (first check if config already loaded)
            var dPath = websitePathTemplate.replace('{{siteID}}', cms.siteId);
            let cfg = null;
            try {
                  if (existsSync(dPath)) {
                        let tmpCfg = new iesJSON();
                        tmpCfg.DeserializeFlexFile(dPath);
                        if (tmpCfg.Status == 0 && tmpCfg.jsonType == 'object') {
                              cfg = tmpCfg;
                        }
                  }
            } catch { }
            if (!cfg) {
                  err = 173;
                  errMessage = "Failed to load config file: " + dPath + " [ERR" + err + "]";
                  cfg = new iesJSON("{}");
            }
            cms.SITE = cfg;

            // Get a few key parameters from SITE
            cms.debugMode = cms.getParamNum("debugMode");

            // PROCESS REQUEST
            cms.hostsiteEngine = websiteEngines.hostsite;
            cms.thisEngine = websiteEngines[cms.siteId];
            cms.Html = "ERROR: nosite [ERR-14159]";
            
            try {
                  if (cms.thisEngine && typeof cms.thisEngine.CreateHtml == "function") {
                        debugLog += "thisEngine.CreateHtml(): " + cms.siteId + "\n";
                        cms.siteEngine = cms.siteId;
                        await cms.thisEngine.CreateHtml(cms);
                  } else {
                        if (cms.hostsiteEngine && typeof cms.hostsiteEngine.CreateHtml == "function") {
                              debugLog += "hostsiteEngine.CreateHtml(): hostsite\n";
                              cms.siteEngine = "hostsite";
                              // We leave a reference to thisEngine in case it has Custom Tags
                              await cms.hostsiteEngine.CreateHtml(cms);
                        }
                  }
            } catch (e) {
                  cms.Html = "SERVER ERROR [ERR-0001]: " + e + "<br>" + cms.Html;
                  cms.resultType = 'html';
            } finally {
                  if (cms.db) { cms.db.Close(); } // close DB connection if needed
            }
      } // end if(cmsSiteID)

      /* FUTURE: HOW TO HANDLE GET/POST/etc.
      if (req.method !== 'GET') {
            res.statusCode = 501;
            res.setHeader('Content-Type', 'text/plain');
            return res.end('Method not implemented');
        }
      */
      let responseBuilt = false;
      if (cms.abort && !cms.resultType) { cms.resultType = 'abort'; }
      if (cms.resultType == 'file') {
            if (!cms.fileFullPath) {
                  res.setHeader('Content-Type', 'text/plain');
                  res.statusCode = 404;
                  res.end('Not found');
                  responseBuilt = true;
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
                  responseBuilt = true;
            }
      }
      if (cms.resultType == 'html') {

            let myHead = [];
            if (cms.newMimic) {
                  myHead.push(['Set-Cookie', 'mimic=' + cms.newMimic]);
            }
            if (cms.newToken) {
                  myHead.push(['Set-Cookie', 'token=' + cms.newToken]);
            }
            // FUTURE: TODO: Add cms.newCookies to the cookie list!
            myHead.push(['Content-Type', 'text/html']);

            if (cms.redirect) {
                  // iesCMS supports 2 types of redirects
                  // For this one just set cms.redirect = destination page or URL
                  // This one shows an HTML page (in case redirect fails), sets cookies, and then redirects.
                  // (see below for alternate redirect)
                  myHead.push(['Location', cms.redirect]);
                  res.writeHead(302, myHead);
            } else {

                  res.writeHead(200, myHead);
            }

            let DebbugerMessage =
                  'method=' + req.method + '\n'
                  + 'url Path=' + cms.url.pathname + '\n'
                  + 'url PathExtension=' + cms.pathExt + '\n'
                  + 'url Params=' + JSON.stringify(cms.url.query) + '\n'
                  + 'host=' + cms.urlHost + '\n'
                  + 'protocol=' + req.headers.protocol + '\n'
                  + 'x-forwarded-host=' + req.headers['x-forwarded-host'] + '\n'
                  + 'x-forwarded-proto=' + req.headers['x-forwarded-proto'] + '\n'
                  + stringify(req.headers) + '\n'
                  + 'Header cookies=' + JSON.stringify(cms.cookies) + '\n'
                  //'query=' + q + '\n'
                  + 'host=' + cms.urlHost + '\n'
                  //+ 'path=' + p + '\n'
                  + 'search=' + s + '\n'
                  + 'vStatic=' + vStatic + '\n'
                  + 'vDynamic=' + vDynamic + '\n'
                  + 'siteID=' + cms.siteId + '\n'
                  + 'mimic=' + cms.mimic + '\n'
                  + 'newCookies=' + stringifyCookies(cms.newCookies) + '\n'
                  + 'Hello s53 World! [from node.js]\n'
                  + 'DIR List:' + JSON.stringify(siteList) + '\n'
                  + 'urlPathList:' + JSON.stringify(cms.urlPathList) + '\n'
                  + 'iesDomains:' + JSON.stringify(iesDomains) + '\n'
                  + 'urlBasePath:' + cms.urlBasePath + '\n'
                  + debugLog;

            if (debugMode > 0) {
                  appendFileSync(debugHttpFile, "err=" + err + ":" + errMessage + "\n" +
                        "============ DebbugerMessage =================\n" + DebbugerMessage + "\n");
            }
            if (err != 0) { cms.Html = "ERROR: " + errMessage; }
            res.end(cms.Html);
            responseBuilt = true;

      } // end if (cms.resultType=='html')
      if (cms.resultType == 'json') {

            let myHeadJ = [];
            myHeadJ.push(['Content-Type', 'application/json']);
            res.writeHead(200, myHeadJ);
            res.end(JSON.stringify(cms.ReturnJson));
            responseBuilt = true;

      } // end if (cms.resultType=='json')
      if (cms.resultType == "redirect") {
            // indicate resultType='redirect' to override HTML content with brief redirect message
            cms.Html = "<HTML><BODY>Redirecting to <a href='" + cms.redirect + "'>" + cms.redirect + "</a>.<br><br>If page redirect does not occur within 60 seconds, click the redirect link.</a></BODY></HTML>"
            try {
                  // iesCMS supports 2 types of redirects
                  // For this complete redirect, set cms.redirect = destination page or URL AND set cms.resultType = 'redirect'
                  // This one does notshow an HTML page, does not set cookies, but only redirects.
                  // (see above for alternate redirect that displays an HTML page and sets cookies)
                  let myHead = [];
                  myHead.push(['Location', cms.redirect]);
                  res.writeHead(302, myHead);

            } catch (err) {
                  console.log(err.message);
            }
            res.end();
            responseBuilt = true;
      }
      if (cms.resultType == 'notfound') {
            res.setHeader('Content-Type', 'text/plain');
            res.statusCode = 404;
            res.end('Not found');
            responseBuilt = true;
      }

      if (debugMode > 0) {
            appendFileSync(debugHttpFile, "httpServer processing complete: " + timestamp() + "\n");
      }

      if (!responseBuilt) { res.end(); } // if all else fails, end the response

}).listen(serverPort);

if (debugMode > 0) {
      appendFileSync(debugFile, "app.js Setup complete.\n");
}