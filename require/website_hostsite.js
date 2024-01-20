const StringBuilder = require("string-builder");
const iesJSON = require('./iesJSON/iesJsonClass.js');
const iesDbClass = require('./iesDB/iesDbClass.js');
const axios = require('axios');
const { existsSync, readFileSync } = require('fs');
const { formatWithOptions } = require("util");
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
            cms.logError(cms.errMessage);
            return true;
        }
        return false;

    }

    CreateHtml(cms) { //async
        return new Promise(async (resolve,reject) => {
            try {
        // API Passthrough (if enabled - ie. only if api_passthrough_path and api_passthrough_url are defined)
        let api_passthrough_path = cms.getParamStr("api_passthrough_path","").trim().toLowerCase();
        if (api_passthrough_path) {
            if (cms.url.pathname.substr(0,api_passthrough_path.length).toLowerCase() == api_passthrough_path) {
              cms.PrepForJsonReturn();
              cms.ReturnJson = {"error":"error-001"}; // default error if we do not process the api call

              let api_passthrough_url = cms.getParamStr("api_passthrough_url","").trim();
              if (api_passthrough_url) {
                
                // FORWARD /api REQUESTS TO ANOTHER PORT OR SERVER
                try {
                    let api = await axios({
                        url: api_passthrough_url + cms.url.pathname,
                        method: cms.req.method || 'GET',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        data: cms.bodyText
                    });
                    cms.ReturnJson = api.data;
                } catch (e) { 
                    cms.ReturnJson = {"error":e.message, "data": (e.response)?e.response.data:'', "status":(e.response)?e.response.status:''};
                    resolve('error-message: ' + e.message); // this is not an actual error condition but a failed attempt. return error message as json.
                    return; 
                } // end try
              } // end if (api_passthrough_url)
              resolve(''); // success
              return; // exit and don't run any of the below
            }// end if
        }// end if (api_passthrough_path)
         

        // ================================================ BEGIN
        var fileType = '';
        let pageHead = new iesJSON();
        var pageErr = -1;
        var pageTemplate;
        var templatePath;
        this.errorMessage = "";

        cms.debugMode = cms.getParamNum("debugMode",0);
        cms.setLogFolder();

       // if (this.invalidSiteID(cms)) { reject('invalidSiteID'); return; } // Commented out because "Hostsite" handles processing for other sites
        cms.Html = _siteID + " HTML<br>";
        cms.logMessage(1, _siteID + ".CreateHTML(): for siteId=" + cms.siteId);
        cms.logMessage(4, "URL: [" + cms.completeUrl() + "]");

        let filePath = decodeURI(cms.url.pathname).replace(/\\/g,'/');
        if (filePath && filePath.substr(0,1) == '/') { filePath = filePath.slice(1); }
        if (cms.pathExt == '' || cms.pathExt == 'htm' || cms.pathExt == 'html') {
            fileType = 'html';
            filePath = filePath.replace(/\//g,'_');
        }
        if (filePath == '') {
            filePath = cms.getParamStr("DefaultPageID","home");
            fileType = 'html'
        }
        // debugger
        // cms.Html += 'Page file:[' + filePath + '][' + cms.pathExt + '] fileType=' + fileType + '<br>';
        cms.logMessage(5,"Page file:[" + filePath + "][" + cms.pathExt + "] fileType=" + fileType);
        cms.pageId = filePath;

        // Setup DATABASE for connection (if needed) ... do not connect yet
        let dbConnectJson = cms.SERVER.i("dbConnect");
        // FUTURE: Find better way to convert from iesJSON to JavaScript object???
        let dbConnect = {
            host: dbConnectJson.i("host").toStr()
            ,db: dbConnectJson.i("db").toStr()
            ,user: dbConnectJson.i("user").toStr()
            ,password: dbConnectJson.i("password").toStr()
        };
        cms.db = new iesDbClass(dbConnect);

        //check for user logout
        if (cms.urlParam("logout","").trim().toLowerCase() == 'true') {
            cms.userSignedOut();
        }

        if (!cms.form) { cms.form = {}; } // Future this is not needed if main cms engine creates cms.form
        cms.form.formid = cms.body.form_id; // get the form_id from the form (if any)

        //check for user login  

        if (cms.pageId.toLowerCase() == 'login') {

            let username = cms.body.username;
            let password = cms.body.password;
            cms.logMessage(3,"Login for user [" + username + "]");

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
                        cms.logMessage(3,"LOGIN ERROR for user [" + username + "]");
                        // Invalidate Token
                        cms.userSignedOut();
                    } else {
                        // login success
                        cms.logMessage(3,"Login successful for user [" + username + "]");
                        // FUTURE: check for deeplink and route if specified
                        cms.redirect = cms.SITE.getStr('MEMBER_DEFAULT_PAGE', 'admin');
                    }
                // } // else (username || password)
            }

        }

        // ******************************* PROCESS FORMS...

        else if (cms.form.formid) { // Check for form_id (not login page)
            // Form is specified. lets process the form using a generic engine

            // We need to replace tags in the emailSubject and Body...
            //var emailTags = new iesJSON("{}");
            //emailTags["World"].Value = cms.World;

            // SET DEFAULT VALUES
            cms.emailInfo = {};
            cms.emailInfo.subject = cms.getParamStr("FORM_Subject_DEFAULT", "");  // Performs tag replacement
            cms.emailInfo.sendto = cms.getParamStr("FORM_SendTo_DEFAULT", "");
            cms.emailInfo.sendfrom = cms.getParamStr("FORM_SendFrom_DEFAULT", "");
            cms.emailInfo.cc = cms.getParamStr("FORM_CC", "");
            cms.emailInfo.bcc = cms.getParamStr("FORM_BCC", "");
            cms.emailInfo.includeotherfields = "true";

            // Get data fields from the Form
            cms.readFormFields(cms.form,cms.body,cms.emailInfo);

            // CheckForSpam
            // FUTURE: Do we need to clip the FormFields? or just the message?  MaxMessageLength
            // FUTURE: Where do we check if setup indicates spam filtering yes/no
            cms.configureSpamFilter(cms.getParamStr("SpamFolder","",true,false)||cms.getParamStr("SpamFolderCommon","",true,false));
            var SpamObj = cms.spamFilter.newSpamObj(cms.emailInfo.body);
            cms.spamFilter.debugLevel = 9; // DEBUG
            cms.spamFilter.debugMsg = ""; // DEBUG - need to clear the message because this is GLOBAL STATIC

            cms.spamFilter.CheckMessage(SpamObj);

            // Indicate SPAM level in the email message			   
            SpamObj.FullMessage += "SPAM LEVEL=" + SpamObj.SpamLevel + "<br>";
            if (SpamObj.SpamReason)
            {
                SpamObj.FullMessage += "DEBUG: SPAM REASON=" + SpamObj.SpamReason + "<br>";
            }

            // Store email Body text into JSON object						 
            cms.emailInfo.body = SpamObj.FullMessage; // Just in case message got clipped (also includes Spam Level)

            // Check for Captcha...
            var cpStatus = "";
            var cpID = (cms.form.captchaid) ? cms.form.captchaid.trim() : '';
            if (cpID)
            {
                var cpPWD = cms.form.captcha.trim();
                // cpStatus = Admin.CheckCaptcha(cpID, cpPWD, world);  // FUTURE: Add captcha check
                cms.form.captchaStatus = cpStatus;
            }

            var FormProcessedFlag = false;
            var LogFormFlag = true;
            var EmailFormFlag = true;
            var CheckSpamLevel = true;
            var FormError = "";

            // Store parameters in FormFields so they will be available to CustomForms
            //cms.form.FormID = FormID; // alread set above
            cms.form.SpamLevel = SpamObj.SpamLevel;
            cms.form.SpamReason = SpamObj.SpamReason;
            cms.form.SubmitDate = cms.datetimeNormal();

            // Custom Forms Processing (if specified)
            if (cms.thisEngine && cms.thisEngine.CustomForms) {
                FormError = cms.thisEngine.CustomForms(cms.form, cms.form.formid, FormProcessedFlag, LogFormFlag, EmailFormFlag, CheckSpamLevel, cms);
            } else if (cms.hostsiteEngine && cms.hostsiteEngine.CustomForms) {
                FormError = cms.thisEngine.CustomForms(cms.form, cms.form.formid, FormProcessedFlag, LogFormFlag, EmailFormFlag, CheckSpamLevel, cms);
            }
            if (FormError)
            {
                //strDefMsg+=vbNewLine + FormError + vbNewLine; // FUTURE: What is this for? Email the error to the admin?
                this.errorMessage = FormError;
            } // end if

            // Log Form (if needed)
            if (FormProcessedFlag == false && cms.pageId == "form_submit")
            {
                // Nothing to 'process' for form_submit.  Just log it and email it.
                FormProcessedFlag = true;
                LogFormFlag = true;
                EmailFormFlag = true;
            } // end if

            // If this is SPAM don't send the email
            if (SpamObj.SpamLevel > 0) { EmailFormFlag = false; }

            // LOG/EMAIL form...
            // If request was for runcmd then we don't do any of this because the CustomForm() routine already generated a response.
            if (FormProcessedFlag == true && cms.pageId != "runcmd")
            {

                if (LogFormFlag == true)
                {
                    //cms.form.FormID = FormID; // alread set above
                    //cms.form.SpamLevel = SpamLevel; // alread set above
                    //cms.form.SpamReason = SpamReason; // alread set above
                    //cms.form.SubmitDate = iesDB.dbDateTime(DateTime.Now, "DT", "", false); // already set above
                    await cms.saveFormToLog(cms.form.formid, cms.form, 2000, SpamObj.SpamLevel, SpamObj.SpamReason);
                }

                // Send Email Notification to website owner (if needed)
                // Use default for FORM_Subject, FORM_SendTo
                if (EmailFormFlag == true && (cpStatus == "" || cpStatus == "OK"))
                {
                    var eRet = cms.goSendEmail(cms.emailInfo);
                    //Response.Write("DEBUG: eRet=" + eRet.jsonString + "<br>");  //DEBUG
                }

                // Check for errors/Display results
                if (cpStatus && cpStatus != "OK")
                {
                    this.errorMessage = "Invalid verification code.";

                    cms.pageId = cms.FormOrUrlParam("OnCaptchaGoTo","").trim();
                    if (cms.pageId == "") { cms.pageId = "form_submit_captcha"; }
                }
                else
                {
                    if (this.errorMessage == "")
                    {
                        cms.pageId = cms.FormOrUrlParam("OnSuccessGoTo","").trim();
                        if (cms.pageId == "") { cms.pageId = "form_submit_ok"; }
                    }
                    else
                    {
                        cms.pageId = cms.FormOrUrlParam("OnErrorGoTo","").trim();
                        if (cms.pageId == "") { cms.pageId = "form_submit_error"; }
                        // Leave errorMessage to be included in the HTML of form_submit_error
                    } // end if (this.errorMessage=="")
                } // end if (cpStatus && cpStatus!="OK")	

            } // end if (FormProcessedFlag==true && cms.pageId != "runcmd")
   
        }

        // ***************************************** END CODE FOR PROCESSING FORMS

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
                return;
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
                cms.logError("Page Status Error: pageErr[" + pageErr + "], pageHead.Status[" + pageHead.Status + "] [ERR5353]");
                reject('ERROR: Page status error. [ERR5353]');
                return;
            }

            // Determine page permissions
            //cms.minViewLevel = cms.SITE.i("defaultMinViewLevel").toNum(999); // default value
            //cms.minEditLevel = cms.SITE.i("defaultMinEditLevel").toNum(999); // default value
            //cms.minAdminLevel = cms.SITE.i("defaultMinAdminLevel").toNum(999);
            cms.setPermissionLevels();
            
            if (cms.HEADER.contains("minViewLevel")) { cms.minViewLevel = cms.HEADER.i("minViewLevel").toNum(cms.minViewLevel); }
            if (cms.HEADER.contains("minEditLevel")) { cms.minEditLevel = cms.HEADER.i("minEditLevel").toNum(cms.minEditLevel); }
            if (cms.user.userLevel >= cms.minViewLevel) {
                if (cms.HEADER.contains("ResponseType")) {
                    cms.resultType = cms.HEADER.i("ResponseType").toStr("html").trim().toLowerCase();
                }
                var template = '';
                if (cms.urlParam("contentonly","").trim().toLowerCase() == "true") {
                    template  = "[[content_area]]";
                } else {
                    // Lookup page template (if HTML response expected)
                    pageTemplate = "layout_" + pageHead.getStr("Template") + ".cfg";
                    templatePath = cms.FindFileInFolders(pageTemplate,
                        './websites/' + cms.siteId + '/templates/',
                        './cmsCommon/templates/'
                    );
                    if (!templatePath) {
                        cms.Html += "ERROR: Template not found: " + pageTemplate + "<br>";
                        cms.logError("Template not found: pageTemplate[" + pageTemplate + "] [ERR5449]");
                        reject('ERROR: Template not found. [ERR5449]');
                        return;
                    }
                    //cms.Html += "Template found: " + templatePath + "<br>";
                    template = readFileSync(templatePath, 'utf8');
                }
                //Check to see if thisEngine has CustomTags defined. (may or may not be the same as 'this')
                var thisCustom = (cms.thisEngine && cms.thisEngine.CustomTags) ? cms.thisEngine : cms.hostsiteEngine;
                cms.Html = await cms.ReplaceTags(template, pageHead, contentHtml, thisCustom, cms);
    
            } else {
                cms.Html += `ERROR: Permission denied. (${cms.user.level}/${cms.minViewLevel}) [ERR7571]<br>`;
                cms.redirect = cms.SITE.i("LOGIN_PAGE").toStr("login");
                cms.logMessage(1,`Warning: permission denied: (${cms.user.level}/${cms.minViewLevel}) [WARN5111]`);
                resolve('Warning: permission denied. [WARN5111]');
                return;
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
            cms.logMessage(5,"Success: resultType[" + cms.resultType + "] [MSG5121]");
            resolve(''); // success
            return;
        }
        cms.logMessage(5,"Success: resultType[" + cms.resultType + "] [MSG5131]");
        resolve(''); // success
        return;
        // ================================================ END
            } catch (err) {
                let errmsg = "ERROR: " + _siteID + ".CreateHtml(): " + err;
                console.log(errmsg);
                cms.logError(errmsg + " [ERR5141]");
                reject(errmsg);
                return;
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
                return;
                // =========================================== END
            } catch (err) {
                let errmsg = "ERROR: " + _siteID + ".CustomTags(): " + err;
                cms.logError(errmsg + " [ERR5211]");
                reject("ERROR: [ERR5211]");
                return;
            }
        });
    }
}

module.exports = webEngine;