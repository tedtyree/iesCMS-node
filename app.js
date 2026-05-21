const _startBanner = '========================================\n========================================\n#### iesCMS Startup Process\n';
process.stdout.write(_startBanner);
process.stderr.write(_startBanner);

var http = require('http');
//var axios = require('axios');
const jwt = require('jsonwebtoken');
const { parse, stringify } = require('querystring');// form submission 
const { Console } = require('console');

//const querystring = require('querystring');
const { readdirSync, statSync, existsSync, createReadStream, appendFileSync, readFileSync } = require('fs');
const path = require('path');
const FlexJson = require('./require/FlexJson/FlexJsonClass.js');
const jsonConstants = require('./require/FlexJson/FlexJsonConstants.js');
const iesCommonLib = require('./require/iesCommon.js');
const iesUser = require('./require/iesUser.js');
const initSiteDatabases = require('./require/iesDB/iesDbInit.js');
const { buildCmdRegistry } = require('./require/cmdRegistry.js');

var httpQueryId = 0;

var websiteEngines = {};
var debugLog = "";
var debugMode = 99;
var debugFile = "";
var debugHttpFile = "";
var forwardedHost = false;  // For PRODUCTION set this to true :: forces us to read x-forwarded-host instead

let vStatic = null;
let vDynamic = null;

var serverPort = 8118; // default port can be overridden in server.cfg
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
// FUTURE: TO-DO: IS THIS USED ANY MORE? server.cfg should be used instead
const env = env_development;
// const env = env_production;

// Get list of websites [#REQ-FOLDER-01-01]
var sitesPath = './websites'
var dlist = readdirSync(sitesPath).filter(function (file) {
      return statSync(sitesPath + '/' + file).isDirectory();
});
var iesDomains = {};
var siteList = [];

// Load SERVER parameters [#REQ-CONFIG-01-01]
let serverCfg = new FlexJson();
serverCfg.DeserializeFlexFile(serverConfig); // Cannot log the error yet, log file has not been created.
if (serverCfg.Status == 0) {
      serverPort = serverCfg.getNum('serverPort', serverPort);
      debugMode = serverCfg.getNum('debugMode', debugMode);
      forwardedHost = serverCfg.getBool('forwardedHost', forwardedHost);
} else {
      throw new Error('Error :failed to parse server config1 ' + serverCfg.statusMsg);
}


// This runs during startup. The debugMode is coming from server.cfg above
if (debugMode > 0) {
      var ts = timestamp();
      debugFile = "./log/app_log_" + ts + ".txt";
      appendFileSync(debugFile, "app.js Start: " + ts + "\n");
}

// Now that the log file is set, log the error that may have occurred when opening server.cfg above.
if (serverCfg.Status != 0 && debugMode > 0) {
      appendFileSync(debugFile, "ERROR: Failed to load server.cfg. [ERR9417]\n");
}

const commonDir = 'cmsCommon';
try {
      // Load/Reqiure Common engine - should always exist...
      var commonEnginePath = './' + commonDir + '/require/website_engine.js';
      if (existsSync(commonEnginePath)) {
            try {
                  var newCEngine = require(commonEnginePath);
            } catch (errWebCEngine) {
                  console.log("!!! ERROR LOADING COMMON ENGINE: " + commonEnginePath);
                  console.error(errWebCEngine);
            }
            websiteEngines[commonDir] = new newCEngine(commonDir);
            console.log("LOAD/REQUIRE COMMON ENGINE: " + commonEnginePath);
       } else {
            console.log("!!! ERROR COMMON ENGINE NOT FOUND: " + commonEnginePath);
       }

} catch (err) {
      console.error(err);
}

console.log('DIR List:' + JSON.stringify(dlist));
dlist.forEach(dDir => {
      var dPath = websitePathTemplate.replace('{{siteID}}', dDir);
      try {
            if (existsSync(dPath)) {
                  //file exists
                  let thiscfg = new FlexJson();
                  thiscfg.DeserializeFlexFile(dPath);
                  if (thiscfg.Status == 0 && thiscfg.jsonType == 'object') {
                        let siteID = thiscfg.i("SITEID").toStr();
                        if (siteID != '' && siteID == dDir) {
                              console.log('>>> SITEID: ' + thiscfg.i("SITEID").toStr());
                              siteList.push(siteID);
                              // loop through 
                              let domainList = thiscfg.i('Domains');
                              for (const oneDomain of domainList) {
                                    domainName = oneDomain.toStr().toLowerCase();
                                    // FUTURE: Check for duplicates - raise error
                                    if (iesDomains[domainName]) {
                                          console.log("ERROR: Duplicate Domain [" + domainName + "] ./websites/" + dDir);
                                    } else {
                                          console.log("  +++ " + domainName + " [" + siteID + "]");
                                          iesDomains[domainName] = siteID;
                                    }
                              }
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
            var enginePath = './websites/' + dDir + '/require/website_engine.js';
            if (!existsSync(enginePath)) {
                  enginePath = './require/website_' + dDir + '.js'; // Old location - backwards compatible
            }
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

// Build cmd API handler registry for all sites [#REQ-API-06]
const cmdRegistry = buildCmdRegistry(siteList);

// Initialize site databases after the site list has been built.
// Runs async in the background during startup — fires and doesn't block the HTTP server.
initSiteDatabases(siteList, serverCfg, debugFile).catch(err => {
      console.error('[DB-INIT] Unhandled error:', err);
      if (debugFile) { appendFileSync(debugFile, '[DB-INIT] Unhandled error: ' + err.message + '\n'); }
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
      cms.url = new URL(req.url, 'http://localhost');
      cms.SERVER = serverCfg;
      cms.secretsFolder = serverSecretsFolder;
      cms.req = req;
      cms.setHttpQueryId(httpQueryId++);

      debugLog = "app.js:http.createServer(): url=" + req.url + "\n";

      
      cms.JWT_SECRET = cms.SERVER.getStr("JWT_SECRET");
      cms.JWT_EXPIRES_IN = cms.SERVER.getNum("JWT_EXPIRES_IN"); // seconds
      cms.GOOGLE_CLIENT_ID = cms.SERVER.getStr("GOOGLE_CLIENT_ID"); // Google Identity Services client ID

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


      cms.noUser();
      const p = 'z'; //url.parse(req.url,true).pathname;
      const s = 'z'; //url.parse(req.url,true).search;

      // This runs for every HTTP request
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
      if (debugMode > 20) {
            appendFileSync(debugHttpFile, "requested siteId: [" + cms.siteId + "]\n");
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
                  const decoded = jwt.verify(token, cms.JWT_SECRET); // throws if expired or invalid
                  if (decoded && decoded.user) {
                        cms.setUser(new iesUser(decoded.user));
                  }
                  // Later we verify user.siteid
            } catch (jwtErr) {
                  console.log("cms.cookies.token=[" + cms.cookies.token + "]");
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
                  if (cms.url.searchParams.get('mimic')) {
                        override = cms.url.searchParams.get('mimic');
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
            if (debugMode > 20) {
            appendFileSync(debugHttpFile, "effective siteId: [" + cms.siteId + "]\n");
      }
            // Verify user.siteid - if incorrect, null-out the user and related permissions
            if (cms.user.siteId != cms.siteId) { cms.noUser(); }

            // Read Site config (first check if config already loaded)
            var dPath = websitePathTemplate.replace('{{siteID}}', cms.siteId);
            let cfg = null;
            try {
                  if (existsSync(dPath)) {
                        let tmpCfg = new FlexJson();
                        tmpCfg.DeserializeFlexFile(dPath);
                        if (tmpCfg.Status == 0 && tmpCfg.jsonType == 'object') {
                              cfg = tmpCfg;
                        }
                  }
            } catch { }
            if (!cfg) {
                  err = 173;
                  errMessage = "Failed to load config file: " + dPath + " [ERR" + err + "]";
                  cfg = new FlexJson("{}");
            }
            cms.SITE = cfg;
            cms.cmdRegistry = cmdRegistry[cms.siteId] || {}; // attach per-site cmd registry [#REQ-API-06-06]

            // Get a few key parameters from SITE
            cms.debugMode = cms.getParamNum("debugMode");

            // /orig folder gatekeeper [#REQ-ORIG-01]
            // cms.url.pathname and cms.pathExt are already parsed above — no re-splitting needed.
            const _origPathNorm = cms.url.pathname.toLowerCase();
            if (!cms.abort && (_origPathNorm === '/orig' || _origPathNorm.startsWith('/orig/'))) {
                  const origMinViewLevel = cms.SITE.getNum('origMinViewLevel', 1);
                  if (cms.user.userLevel >= origMinViewLevel) {
                        // Authorized — resolve and serve the file directly [#REQ-ORIG-01-05,06]
                        const siteOrigBase = path.resolve('./websites/' + cms.siteId + '/orig');
                        let origRelPath = decodeURI(cms.url.pathname);
                        // Default to index.html when no specific file requested [#REQ-ORIG-01-08]
                        if (origRelPath === '/orig' || origRelPath === '/orig/') { origRelPath = '/orig/index.html'; }
                        const origFileFull = path.resolve('./websites/' + cms.siteId + origRelPath);
                        // Derive extension from the actual file path (origRelPath may have been defaulted to index.html)
                        const origExt = path.extname(origFileFull).slice(1).toLowerCase();
                        // Block path traversal outside the orig/ folder [#REQ-ORIG-01-09]
                        if (!origFileFull.startsWith(siteOrigBase + path.sep) && origFileFull !== siteOrigBase) {
                              cms.resultType = 'notfound';
                        } else if (origExt === 'html' || origExt === 'htm') {
                              // Serve HTML files through the html response handler so the browser renders them
                              if (existsSync(origFileFull)) {
                                    cms.Html = readFileSync(origFileFull, 'utf8');
                                    cms.resultType = 'html';
                              } else {
                                    cms.resultType = 'notfound';
                              }
                        } else {
                              cms.fileFullPath = existsSync(origFileFull) ? origFileFull : '';
                              cms.mimeType = cms.mime[origExt] || 'application/octet-stream';
                              cms.resultType = 'file';
                        }
                  } else {
                        // Not authorized — redirect to login, store return path as session cookie [#REQ-ORIG-01-07]
                        const loginPage = cms.SITE.getStr('LOGIN_PAGE', 'login');
                        if (!cms.newCookies) { cms.newCookies = {}; }
                        cms.newCookies.redirect_after_login = cms.url.pathname + (cms.url.search || '');
                        cms.redirect = '/' + loginPage;
                        cms.resultType = 'redirect';
                  }
            }

            // PROCESS REQUEST
            cms.commonEngine = websiteEngines.cmsCommon;
            cms.thisEngine = websiteEngines[cms.siteId];
            if (!cms.resultType) { cms.Html = "ERROR: nosite [ERR-14159]"; }

            try {
                  if (!cms.resultType) { // skip engine if /orig gatekeeper already handled the request
                  if (cms.thisEngine && typeof cms.thisEngine.CreateHtml == "function") {
                        debugLog += "thisEngine.CreateHtml(): " + cms.siteId + "\n";
                        cms.siteEngine = cms.siteId;
                        await cms.thisEngine.CreateHtml(cms);
                  } else {
                        if (cms.commonEngine && typeof cms.commonEngine.CreateHtml == "function") {
                              debugLog += "commonEngine.CreateHtml(): cmsCommon\n";
                              cms.siteEngine = "cmsCommon";
                              // We leave a reference to thisEngine in case it has Custom Tags
                              await cms.commonEngine.CreateHtml(cms);
                        }
                  }
                  } // end if (!cms.resultType)
            } catch (e) {
                  cms.Html = "SERVER ERROR [ERR-0001]: " + e + "<br>" + cms.Html;
                  cms.resultType = 'html';
            } finally {
                  if (cms.db) { await cms.db.Close(); } // close DB connection if needed
            }
      } // end if(cmsSiteID)

      let responseBuilt = false;
      if (cms.abort && !cms.resultType) { cms.resultType = 'abort'; }
      if (debugMode > 20) {
            appendFileSync(debugHttpFile, "resultType: [" + cms.resultType + "]\n");
      }
      if (cms.resultType == 'file') {
            if (!cms.fileFullPath) {
                  res.setHeader('Content-Type', 'text/plain');
                  res.statusCode = 404;
                  res.end('Not found');
                  responseBuilt = true;
            } else {
                  // JS/CSS tag replacement: process [[...]] tags for .js and .css files [#REQ-TAG-02]
                  const tagExts = ['js', 'css'];
                  if (tagExts.includes(cms.pathExt) && cms.commonEngine) {
                        try {
                              const rawText = readFileSync(cms.fileFullPath, 'utf8');
                              if (rawText.includes('[[')) {
                                    const processed = await cms.commonEngine.ReplaceTags(
                                          rawText, cms.SITE, '', cms.thisEngine, cms
                                    );
                                    res.setHeader('Content-Type', cms.mimeType);
                                    res.statusCode = 200;
                                    res.end(processed);
                              } else {
                                    var streamFile = createReadStream(cms.fileFullPath);
                                    streamFile.on('open', function () {
                                          res.setHeader('Content-Type', cms.mimeType);
                                          streamFile.pipe(res);
                                    });
                                    streamFile.on('error', function () {
                                          res.setHeader('Content-Type', 'text/plain');
                                          res.statusCode = 404;
                                          res.end('Not found');
                                    });
                              }
                        } catch {
                              res.statusCode = 500;
                              res.end('Server error');
                        }
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
                  responseBuilt = true;
            }
      }
      if (cms.resultType == 'html') {

            let myHead = [];
            if (cms.newMimic) {
                  myHead.push(['Set-Cookie', 'mimic=' + cms.newMimic]);
            }
            if (cms.newToken) {
                  if (cms.newToken === '-') {
                        // Logout: clear the cookie immediately
                        myHead.push(['Set-Cookie', 'token=; Max-Age=0; Path=/; SameSite=Lax']);
                  } else {
                        // 7-day persistent cookie so closing the browser doesn't log the user out
                        const maxAge = cms.JWT_EXPIRES_IN || 604800;
                        myHead.push(['Set-Cookie', `token=${cms.newToken}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax`]);
                  }
            }
            for (const [_ck, _cv] of Object.entries(cms.newCookies || {})) {
                  if (_cv === '') {
                        myHead.push(['Set-Cookie', _ck + '=; Max-Age=0; Path=/']);
                  } else {
                        myHead.push(['Set-Cookie', _ck + '=' + encodeURIComponent(_cv) + '; Path=/']);
                  }
            }
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
                  + 'url Params=' + JSON.stringify(Object.fromEntries(cms.url.searchParams)) + '\n'
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
            if (cms.ReturnJson) {
                  if (typeof cms.ReturnJson === 'object') {
                        if (cms.ReturnJson.constructor.name === 'FlexJson') {
                              res.end(cms.ReturnJson.Stringify());
                        } else {
                              res.end(JSON.stringify(cms.ReturnJson));
                        }
                  } else { res.end(JSON.stringify(cms.ReturnJson)); }
            } else { res.end(""); }
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
                  for (const [_ck, _cv] of Object.entries(cms.newCookies || {})) {
                        if (_cv === '') {
                              myHead.push(['Set-Cookie', _ck + '=; Max-Age=0; Path=/']);
                        } else {
                              myHead.push(['Set-Cookie', _ck + '=' + encodeURIComponent(_cv) + '; Path=/']);
                        }
                  }
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

}).listen(serverPort, '0.0.0.0');

console.log(`iesCMS server listening on port ${serverPort}`);
if (debugMode > 0) {
      appendFileSync(debugFile, "app.js Setup complete.\n");
      appendFileSync(debugFile,`iesCMS server listening on port ${serverPort}\n`);
}