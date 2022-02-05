const StringBuilder = require("string-builder");
const iesJSON = require('./iesJSON/iesJsonClass.js');
const iesDbClass = require('./iesDB/iesDbClass.js');

const { existsSync, readFileSync } = require('fs');
const _siteID = 'hostsite';
var assignedSiteID = '';

class webEngine {

    constructor(thisSiteID) {
        this.assignedSiteID = thisSiteID;
        this.errorMessage = '';
    	}
        

    invalidSiteID(cms) {
        if (assignedSiteID != _siteID) {
            cms.err = 517;
            cms.errMessage = 'ERROR: webEngine missmatch: ' + assignedSiteID + ' != ' + _siteID;
            return true;
        }
        return false;

    }

    CreateHtml(cms) { //async
        return new Promise(async (resolve,reject) => {
            try {
        // ================================================ BEGIN
        var fileType = '';
        let pageHead = new iesJSON();
        var pageErr = -1;
        var pageTemplate;
        var templatePath;
        this.errorMessage = "";

       // if (this.invalidSiteID(cms)) { return; }
        cms.Html = "hostsite HTML<br>";
        let filePath = decodeURI(cms.url.pathname).replace(/\\/g,'/');
        if (filePath && filePath.substr(0,1) == '/') { filePath = filePath.slice(1); }
        if (cms.pathExt == '' || cms.pathExt == 'htm' || cms.pathExt == 'html') {
            fileType = 'html';
            filePath = filePath.replace(/\//g,'_');
        }
        if (filePath == '') {
            filePath = cms.getParamStr("DefaultPageID","home");
            fileType=='html'
        }
        // debugger
        // cms.Html += 'File:[' + filePath + '][' + cms.pathExt + ']<br>';
        cms.pageId = filePath;

        // Setup DATABASE for connection (if needed) ... do not connect yet
        let dbConnectJson = cms.SERVER.i("dbConnect");
        // FUTURE: Find better way to convert from iesJSON to JavaScript object???
        let dbConnect = {
            host: dbConnectJson.i("host").toStr()
            ,user: dbConnectJson.i("user").toStr()
            ,password: dbConnectJson.i("password").toStr()
        };
        cms.db = new iesDbClass(dbConnect);

        //check for user logout
        if (cms.urlParam("logout","").trim().toLowerCase() == 'true') {
            cms.userSignedOut();
        }

        //check for user login  

        if (cms.pageId.toLowerCase() == 'login') {

            let username = cms.body.username;
            let password = cms.body.password;

            // if username is correct and password 
            // create a JWT and return it to frontend 
            // redirect to the landing page  
            // if invalid password display error message  
            if (username || password) {
                /*
                if (username == 'joe' && password == 'friendofFelix84') {

                    //this.errorMessage = 'login successful';

                    let user = { userName: 'Joe', userLogin: 'joe', userKey: 1, userLevel: 9, siteId: cms.siteId };
                    //var token = jwt.encode({user}, secretKey); 

                    cms.userSignedIn(user);
                    / *
                    const token = jwt.sign({ user }, cms.JWT_SECRET, {
                        expiresIn: cms.JWT_EXPIRES_IN,
                    });
                    cms.newToken = token;
                    * /

                } else {
                    */
                    await cms.SessionLogin(username,password,cms.siteId);

                    if (cms.user.userKey < 0) {
                        this.errorMessage = 'login not successful';
                        // Invalidate Token
                        cms.userSignedOut();
                    } else {
                        // login success
                        // FUTURE: check for deeplink and route if specified
                        cms.redirect = cms.SITE.getStr('MEMBER_DEFAULT_PAGE', 'admin');
                    }
                // } // else (username || password)
            }

        }

        // FUTURE: Determine if path is located in root (shared common folders) or in Websites/<siteid>
        
        if (fileType=='html') {
            cms.resultType = 'html';
            cms.mimeType = 'text/html';
            cms.fileFullPath = cms.FindFileInFolders(filePath + '.cfg',
                cms.getParamStr("PageFolder"),
                cms.getParamStr("CommonPageFolder")
                );
                
            if (!cms.fileFullPath) {
                // We didn't find the file - time to call it quits
                cms.Html += 'file not found.<br>';
                reject('ERROR: Page not found. [ERR1111]');
            }

            // FUTURE: Can we read and parse this using iesCommon.LoadHtmlFile?
            var contentHtml = readFileSync(cms.fileFullPath, 'utf8').toString();
            // look for [[{ header }]]
            var p1 = contentHtml.indexOf('[[{');
            if (p1 >=0) {
                var p2 = contentHtml.indexOf('}]]');
                if (p2>p1) {
                    cms.Html += 'w/ header<br>';
                    var headJson = contentHtml.substring(p1+2,p2+1);
                    contentHtml = contentHtml.slice(p2+3);
                    cms.Html += headJson + '<br>';
                    pageHead.DeserializeFlex(headJson);
                    if (pageHead.Status ==0 && pageHead.jsonType=='object') {
                        cms.HEADER = pageHead; // store for later access
                        cms.Html += "Header object has been parsed.<br>";
                        cms.Html += "Template=" + pageHead.getStr("Template") + "<br>";
                        pageErr = 0;
                    } else {
                        cms.Html += "Header parse error: " + pageHead.statusMsg;
                        pageErr = 1;
                    }
                } else {
                    cms.Html += 'no header end-tag<br>';
                    pageErr = 2;
                }
            } else {
                cms.Html += 'no header<br>';
                pageErr = 3;
            }
            if (pageErr != 0) {
                cms.Html += "Page ERROR " + pageErr + ": pageHead.Status = " + pageHead.Status + "<br>";
                reject('ERROR: Page status error. [ERR5353]');
            }

            // Determine page permissions
            cms.minViewLevel = cms.SITE.i("defaultMinViewLevel").toNum(999); // default value
            cms.minEditLevel = cms.SITE.i("defaultMinEditLevel").toNum(999); // default value
            if (cms.HEADER.contains("minViewLevel")) { cms.minViewLevel = cms.HEADER.i("minViewLevel").toNum(cms.minViewLevel); }
            if (cms.HEADER.contains("minEditLevel")) { cms.minEditLevel = cms.HEADER.i("minEditLevel").toNum(cms.minEditLevel); }
            if (cms.user.userLevel >= cms.minViewLevel) {
                if (cms.HEADER.contains("ResponseType")) {
                    cms.resultType = cms.HEADER.i("ResponseType").toStr("html").trim().toLowerCase();
                }
    
                // Lookup page template (if HTML response expected)
                pageTemplate = "layout_" + pageHead.getStr("Template") + ".cfg";
                templatePath = cms.FindFileInFolders(pageTemplate,
                    './websites/' + cms.siteId + '/templates/',
                    './cmsCommon/templates/'
                );
                if (!templatePath) {
                    cms.Html += "ERROR: Template not found: " + pageTemplate + "<br>";
                    reject('ERROR: Template not found. [ERR5449]');
                }
                //cms.Html += "Template found: " + templatePath + "<br>";
                var template = readFileSync(templatePath, 'utf8');
                cms.Html = await cms.ReplaceTags(template, pageHead, contentHtml, this, cms);
    
            } else {
                cms.Html += `ERROR: Permission denied. (${cms.user.level}/${cms.minViewLevel}) [ERR7571]<br>`;
                cms.redirect = cms.SITE.i("LOGIN_PAGE").toStr("login");
                resolve('Warning: permission denied. [WARN5111]');
            }

        } else {
            // NON-HTML/JSON RESOURCES
            // cms.Html += 'DEBUGGER: get non-html file<br>pathExt=' + cms.pathExt +'<br>cms.url.pathname=' + cms.url.pathname + '<br>urlBasePath=' + cms.urlBasePath + '<br>';
            if (cms.urlBasePath.toLowerCase() == 'cmscommon') {
                // look for file in cmsCommon
                cms.fileFullPath = cms.FindFileInFolders(cms.urlFileName,
                    './' + cms.urlPathList.join('/')
                );
            } else {
                // look for file in SITE folder
                cms.fileFullPath = cms.FindFileInFolders(cms.urlFileName,
                    './websites/' + cms.siteId + '/' + cms.urlPathList.join('/')
                );
            }
            cms.mimeType = cms.mime[cms.pathExt] || 'text/plain';
            cms.resultType = 'file';
            cms.Html += 'DEBUGGER: cms.fileFullPath=[' + cms.fileFullPath + ']<br>mimeType=' + cms.mimeType;
            resolve(''); // success
        }
        resolve(''); // success
        // ================================================ END
            } catch (err) {
                let errmsg = "ERROR: " + _siteID + ".CreateHtml(): " + err;
                console.log(errmsg);
                reject(errmsg);
            }
        });
    }

    CustomTags(ret, cms) { // async
        return new Promise(async (resolve,reject) => {
            try {
                // =========================================== BEGIN
                var content = new StringBuilder();
                ret.Processed = true;
                switch (ret.Tag.toLowerCase()) {
                    case "errmsg":
                        if (this.errorMessage) {
                            ret.ReturnContent = "<div style='background:red; padding: 20px; border:solid 3px #000;'>" + this.errorMessage + "</div>";
                        }

                        break;
                    case "tag2":
                        content.append("tag2_content");
                        break;
                    default:
                        ret.Processed = false;
                        break;
                }
                ret.ReturnContent += content.toString();
                resolve(true);
                // =========================================== END
            } catch (err) {
                let errmsg = "ERROR: " + _siteID + ".CustomTags(): " + err;
                console.log(errmsg);
                reject(errmsg);
            }
        });
    }
}

module.exports = webEngine;