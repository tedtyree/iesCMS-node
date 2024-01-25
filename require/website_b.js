const StringBuilder = require("string-builder");
const FlexJson = require('./FlexJson/FlexJsonClass.js');
const iesDbClass = require('./iesDB/iesDbClass.js');
// const iesDB = new iesDbClass();  // use cms.db instead
// const jwt = require('jsonwebtoken');


const { existsSync, readFileSync } = require('fs');
const { get } = require("http");
const { resolve } = require("path");

const _siteID = 'b';
//var assignedSiteID = '';

class webEngine {

    constructor(thisSiteID) {
        this.assignedSiteID = thisSiteID;
        this.errorMessage = '';

    }

    invalidSiteID(cms) {
        if (this.assignedSiteID != _siteID || cms.siteId != _siteID ) {
            cms.err = 517;
            cms.errMessage = 'ERROR: webEngine missmatch: ' + this.assignedSiteID + ' != ' + cms.siteId + ' != ' + _siteID ;
            return true;
        }
        return false;
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
                    case "lang":
                        this.ProcessLangTag(ret.Param1, content, cms);
                        break;
                    case "getlang": // [[getlang]]
                        var lang1 = this.GetLanguage(cms);
                        content.append(lang1);
                        break;
                    case "getlangname": // [[getlang]]
                        var langName1 = this.GetLanguageName(cms);
                        content.append(langName1);
                        break;
                    case "iflangequals": // [[iflangequals:<compare_value>:<text_to_append>]]
                        var lang2 = this.GetLanguage(cms);
                        if (lang2 == ret.Param1.trim())
                        {
                            content.append(ret.Param2);
                        } else {
                            content.append(ret.Param3);
                        }
                        break;
                    case "tablesearch":
                        var searchText = cms.FormOrUrlParam("search","");
                        var page = cms.FormOrUrlParam("page",1);
                        try { page = parseInt(page); }
                        catch { page = 1; }
                        if (page < 1) { page = 1; }
                        cms.PrepForJsonReturn(ret);
                        await this.BuildTableSearch(cms, searchText, content, page, ret);
                        break;
                    default:
                        // LOGIC COPIED FROM AdminTags BUT SLIGHTLY MODIFIED TO HANDLE LANGUAGES [[lang:@@...]]
                        // First check to see if the parameter is found in the wiki object
                        // ... if not, then check the header object within the wiki
                        // ... if still not found then we did not 'process' the tag
                        if (cms.HEADER.contains(ret.Tag)) {
                            // here we process HEADER fields
                            var langTag = cms.HEADER.i(ret.Tag).toStr();
                            if (langTag.indexOf("@@")>=0) {
                                content.append("[[lang|" + langTag + "]]"); // Will get processed as a [[lang|@@]] tag.
                            }
                            else if (langTag.length > 0) {
                                content.append(langTag); // Was not a language tag... append to content as usual
                            }
                            ret.Processed = true;
                        }
                        else { ret.Processed = false; }
                        break;



                        /* FROM PRODUCTION VB.NET iesCMS for iHeartKenya...
                        case "date":
                    Content.Append(System.DateTime.Now.ToString("d"));
                    break;
                case "debug-output":
                    thisUserNo = Admin.GetUserNo();
                    if ((cms.UserLevel >= 7) && (cms.SITE.DebugMode >= 1))
                    {
                        Content.Append("<br><br><br><span style='color:#C0C0C0'>DEBUG OUTPUT:<br>User ID=" + thisUserNo + ", Level=" + cms.UserLevel + "<br>");
                        Content.Append(cms.DebugOutput.ToString() + "<br>");
                        Content.Append("</span><br><br>");
                    }
                    break;
                case "tablesearch":
                    string searchText = cms.FormOrUrlParam("search");
                    int page = Util.ToInt(cms.FormOrUrlParam("page"), 1);
                    
                    if (page < 1) { page = 1; }
                    BuildTableSearch(searchText, Content, page, ret);
                    break;
                case "getrecord":
                    string id = cms.FormOrUrlParam("id");
                    string config = cms.FormOrUrlParam("config");
                    GetRecord(config,id,ret);
                    break;
                case "getmulti":
                    string idList = cms.FormOrUrlParam("idlist");
                    string config2 = cms.FormOrUrlParam("config");
                    GetMultiRecords(config2,idList,ret);
                    break;
                case "saverecord":
                    string configSR = cms.FormOrUrlParam("config");
                    string result2 = SaveRecord(configSR,ret);
                    if (ret.ReturnJson != null) {
                        ret.ReturnJson.Add("status",result2);
                    }
                    else {
                        Content.Append(result2);
                    }
                    break;
                

                 case "isadmin":
                        // similar to ifUserIsAdmin, but is specifically designed to
                        // identify admin users even if they are no longer logged in
                        // by looking for the "isadmin" cookie flag
                        bool admFlag = false;
                        if (cms.UserLevel >= cms.SITE.MinAdminLevel) { admFlag = true; }
                        if (!admFlag) {
                            // lets check the cookie value
                            string cookieval3 = null;
                            try {
                                cookieval3 = cms.Request.Cookies["isadmin"].ToString().Trim().ToLower();
                            } catch {}
                            if (cookieval3 == "true") { admFlag = true; }
                        }
                        if (admFlag) { Content.Append(ret.Param1); }
                        else { Content.Append(ret.Param2); }
                        break;
                case "lovekenya": // OLD APPROACH
                    FlexJson webBlockHeader = null;
                    ret.AllowRecursiveCall = false;  // Do not replace tags or process web parts
                    string fullPath = cms.SITE.TemplateFolder + @"\webpart_" + ret.Tag + @".cfg";
                    int status = 0;
                    string errMsg = "";
                    // As you load the file, place the HTML in the record as "wikihtml"
                    string entireHTML = Util.LoadHtmlFile(fullPath, out webBlockHeader, out status, out errMsg, "wikihtml");
                    webBlockHeader.AddToObjBase("Tag", ret.Tag);
                    webBlockHeader.AddToObjBase("Param1", ret.Param1);
                    webBlockHeader.AddToObjBase("Param2", ret.Param2);
                    webBlockHeader.AddToObjBase("Param3", ret.Param3);
                    webBlockHeader.AddToObjBase("Param4", ret.Param4);
                    entireHTML = Util.ReplaceTags(entireHTML, webBlockHeader, false);
                    Content.Append(entireHTML);
                    break;

                case "incrementwelovekenya":
                    string likeTag = cms.FormOrUrlParam("likeTag");
                    likeTag = iesDB.dbStr(likeTag, 150, true); // this adds quotes to the string
                    string sqlLikeInc = "UPDATE likes SET likeCount=likeCount+1 WHERE WorldID='kenyaheart' AND likeTag=" + likeTag;
                    cms.db.ExecuteSQL(sqlLikeInc);
                    Content.Append("successful");
                    break;

                case "gallery":
                    // Param1 = AccountID (to identify the customer account/folder)
                    // Param2 = name/id of the gallery (folder name)
                    string galleryUrl = @"/assets/" + ret.Param1.Trim() + @"/gallery/" + ret.Param2.Trim();
                    string galleryPath = cms.SITE.WebRootPath + @"\websites\" + cms.SITE.SiteID + @"\assets\" + ret.Param1 + @"\gallery\" + ret.Param2;
                    string galleryFile = "gallery";
                    if (! cms.isNullOrWhiteSpace(ret.Param3)) { galleryFile = ret.Param3.Trim(); }
                    string galleryConfig = galleryPath + @"\" + galleryFile + @".json";
                    
                    FlexJson gCfg = new FlexJson();
                    gCfg.DeserializeFlexFile(galleryConfig);

                    if (gCfg.Status == 0) { // success?
                        // read template
                        string templatePath = galleryPath + @"\" + gCfg["template"].ToStr();

                        string templateText = "";
                        Util.ReadFile(templatePath,ref templateText);
                        
                        // Loop through photos and generate output
                        foreach (FlexJson rec in gCfg["photos"]) {
                            if (rec["status"].ToStr("active").ToLower() == "active") {
                                // convert TITLE/COMMENT to either a single STRING or 3 LANGUAGES
                                ReplaceWithLanguages(rec,"title");
                                ReplaceWithLanguages(rec,"comment");

                                // convert IMAGE to proper HTML
                                ReplaceWithImagePath(rec,"image",galleryUrl);

                                // replace tags
                                // Content.Append("<!-- DEBUG: " + rec.jsonString.Replace("[[","[ [") + " -->");
                                string row=Util.ReplaceTags(templateText, rec, false);
                                Content.Append(row);
                            }
                        }
                    }
                    break;

                case "like-icon":
                    // Future: way to read all the likeTag values needed for the page from the DB at one time rather than one at a time.
                    // param1=ListID, param2=likeTag, param3=(optional)Icon URL
                    string thisListID = Util.Sanitize(ret.Param1,40);
                    string thisLikeTag = Util.Sanitize(ret.Param2,40);
                    int likeCount = 0;
                    string likeSql = "SELECT likeCount FROM likes WHERE WorldID='" + cms.World + "' AND ListID='" + thisListID + "' AND likeTag='" + thisLikeTag + "' AND Status='Active' ";
                    FlexJson likeRec = cms.db.GetFirstRow(likeSql);
                    if (likeRec.Status == 0) {
                        likeCount = likeRec["likeCount"].ToInt(0);
                    }
                    Double ddiv = 1;
                    string likeSuffix = "";
                    string likeShort = "";
                    if (likeCount>=1000000) {
                        ddiv = 1000000;
                        likeSuffix = "M";
                    } else if (likeCount>=1000) {
                        ddiv = 1000;
                        likeSuffix = "k";
                    }
                    likeShort = Math.Floor((double)likeCount / ddiv).ToString() + likeSuffix;
                    string likeTooltip = "title='" + likeCount + " likes' ";
                    string likeBlock = "<div id='like-" + thisLikeTag + "' " 
                            + "data-liketag='" + thisLikeTag + "' "
                            + "data-listid='" + thisListID + "' "
                            + "data-likecount='" + likeCount + "' "
                            + "data-toggle=\"tooltip\" "
                            + "class='likes' " + likeTooltip + " >" + likeShort + "</div>";
                    if (!cms.isNullOrWhiteSpace(ret.Param3)) {
                        likeBlock = "<div class='iconWrapper' " + likeTooltip + ">" 
                            + "<img src='" + ret.Param3 + "'>" 
                            + likeBlock + "</div>";
                    }
                    Content.Append(likeBlock);
                    break;
                case "public-edit-save":
                    FlexJson j = new FlexJson("{}");
                    j["worldID"].Value = cms.SITE.World;
                    j["userEmail"].Value = "-";  // ERROR - DEBUG - FUTURE - CHANGE THESE TO QUOTES! PUT ACTUAL EMAIL HERE!
                    FlexJson formFields = Admin.GetFormFields();
                    j.AddToObjBase("after_json", formFields);
                    cms.db.SaveRecord(j, "publicedit", "editID", 1, true, false);
                    Content.Append("DEBUG:" + cms.db.status + ": " + cms.db.statusMessage + ", cmd=" + cms.db.CmdStatus + ": " + cms.db.CmdStatusMessage + "<br>\n");
                    Content.Append("(public-save command2):" + j.jsonString + "<br>\n");
                    break;
               
                    
            } // End switch
            ret.Processed = processed;
            if (ret.Processed == true) { ret.ReturnContent = Content.ToString(); }

            END OF VB.NET CODE */
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

    // Exec() is used to run pre-process/post-process functions 
    // when specific system events occur
    Exec(cms, cmd, options=null) {
        switch(cmd) {
            case "SessionLogin":
                console.log("KenyaHeart: Login post process.");
                break;
        }
    }

    // disabled this function - we should be able to run the HOSTSITE > CreateHTML and still use the CustomTags from this file???
    old_Create_Html_ (cms) { // async
        return new Promise(async (resolve,reject) => {
            try {
        // ================================================ BEGIN
        var fileType = '';
        let pageHead = new FlexJson();
        var pageErr = -1;
        var pageTemplate;
        var templatePath;
        this.errorMessage = "";

        if (this.invalidSiteID(cms)) { reject('ERROR: Incorrect SiteID. [ERR5157]'); }
        cms.Html = "website:[" + _siteID + "] HTML<br>";
        // let filePath = cms.url.pathname.replace(/\\/g,'/');
        let filePath = decodeURI(cms.url.pathname).replace(/\\/g, '/');
        if (filePath && filePath.substr(0, 1) == '/') { filePath = filePath.slice(1); }
        if (cms.pathExt == '' || cms.pathExt == 'htm' || cms.pathExt == 'html') {
            fileType = 'html';
            filePath = filePath.replace(/\//g, '_');
        }
        if (filePath == '') {
            filePath = cms.getParamStr("DefaultPageID", "home");
            fileType == 'html'
        }
        // debugger
        // cms.Html += 'File:[' + filePath + '][' + cms.pathExt + ']<br>';
        cms.pageId = filePath;

        // Setup DATABASE for connection (if needed) ... do not connect yet
        let dbConnectJson = cms.SERVER.i("dbConnect");
        // FUTURE: Find better way to convert from FlexJson to JavaScript object???
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
                if (username == 'joe' && password == 'friendofFelix84') {

                    this.errorMessage = 'login successful';

                    cms.redirect = cms.SITE.getStr('MEMBER_DEFAULT_PAGE', 'admin');

                    let user = { userName: 'Joe', userLogin: 'joe', userKey: 1, userLevel: 9, siteId: cms.siteId };
                    //var token = jwt.encode({user}, secretKey); 

                    cms.userSignedIn(user);
                    /*
                    const token = jwt.sign({ user }, cms.JWT_SECRET, {
                        expiresIn: cms.JWT_EXPIRES_IN,
                    });
                    cms.newToken = token;
                    */

                } else {
                    await cms.SessionLogin(username,password,cms.siteId);

                    if (cms.user.userKey < 0) {
                        this.errorMessage = 'login not successful';
                        // Invalidate Token
                        cms.userSignedOut();
                    }
                }
            }

        }

        // FUTURE: Determine if path is located in root (shared common folders) or in Websites/<siteid>

        if (fileType == 'html') {
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

            var contentHtml = readFileSync(cms.fileFullPath, 'utf8').toString();
            // look for [[{ header }]]
            var p1 = contentHtml.indexOf('[[{');
            if (p1 >= 0) {
                var p2 = contentHtml.indexOf('}]]');
                if (p2 > p1) {
                    cms.Html += 'w/ header<br>';
                    var headJson = contentHtml.substring(p1 + 2, p2 + 1);
                    contentHtml = contentHtml.slice(p2 + 3);
                    cms.Html += headJson + '<br>';
                    pageHead.DeserializeFlex(headJson);
                    if (pageHead.Status == 0 && pageHead.jsonType == 'object') {
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

    GetLanguage(cms) {
        var lang = null;
        // First we look to see if the URL has overridden the language
        try {
            lang = cms.urlParam("lang").toLowerCase().trim();
        } catch {}
        if (!lang) {
            // Next we look for the language specified as a cookie
            try {
                lang = cms.cookies.lang.toString().toLowerCase().trim();
            } catch {}
        }
        if (!lang) {
            // Next we look for the language as DefaultLanguage specified in the config file
            lang = cms.SITE.i("DefaultLanguage").toStr().toLowerCase().trim();
        }
        if (!lang) {
            // As a last resort, assume English
            lang = "en";
        }
        return lang;
    }

    GetLanguageName(cms) {
        var lang = this.GetLanguage(cms);
        var langName = null;
        try {
            langName = cms.SITE.Languages.lang.toStr().trim();
        } catch {}
        if ((!langName) && lang=="en") {
            // Next we check if the language is English
            langName = "English";
        }
        if (!langName) {
            // As a last resort, specify Unkown
            langName = "Unknown";
        }
        return langName;
    }

    /**
     *  Add the language switcher 
     */

    ProcessLangTag(langText, content, cms) {

        let langPieces = {};
        let textPieces = langText.split("@@");

        for (const piece of textPieces) {

            let firstWord = this.GetFirstWord(piece).trim();
            let remainder = piece.substring(firstWord.length).trim();
            // content.Append("|||DEBUGGER:piece=[" + piece + "],firstword=[" + firstWord + "],remainder=[" + remainder + "]|||");
            if (firstWord == "") { firstWord = "default"; }
            if (remainder != "") { langPieces[firstWord] = remainder; }
        }

        // Use the list of languages for this PAGE (ie. in HEADER) first... and only for the SITE if not found for PAGE
        let languages = new FlexJson("{}");
        if (cms.HEADER.contains("languages")) {

            for (const lng of cms.HEADER.getStr("languages").split(",")) {
                let l = lng.trim();
                if (l != "") { languages.add(l, l); }
            }

        } else {
            languages = cms.SITE.i("Languages");
        }
        let cnt = 0;
        // FUTURE: TODO: find a way to iterate iesSON without tapping into _value
        for (const lang of languages._value) {
            if (cnt > 0) { content.append("<span class='lang-none'> / </span>"); }
            let k1 = lang.key.trim();
            let v1 = "";
            if (langPieces[k1]) {
                v1 = langPieces[k1].trim();
            } else {
                v1 = langPieces["default"].trim();
            }
            content.append("<span class='lang-" + k1 + "'>" + v1 + "</span>");
            cnt++;
        }

    }


    GetFirstWord(phrase) {
        let pos = phrase.indexOf(" ");
        if (pos > 0) {
            return phrase.substring(0, pos + 1);
        }
        return "";
    }

    async BuildTableSearch(cms, searchText, Content, page, ret)
    {
        return new Promise(async (resolve,reject) => {
            try {
        // ================================================ BEGIN

        /* FUTURE: Log event
            if (cms.SITE.DebugMode > 0)
            {
                cms.WriteLog("custom", "========================================================================= BuildTableSearch\n");
            }
        */
            // Load vocabsearch config file
            let configName = cms.db.dbStr(cms.Sanitize(cms.FormOrUrlParam("config","")), 40, false);
            let vocabFile = "table_" + configName + ".cfg";
            let vocabConfigPath = cms.FindFileInFolders(vocabFile, cms.getParamStr("ConfigFolder"));
            if (!vocabConfigPath)
            {

                const err1 = "ERROR: BuildVocabSearch: Vocab config not found: " + vocabFile + " [ERR37617]";
                console.log(err1);
                reject(err1);
            }
            let cfg = new FlexJson();
            cfg.DeserializeFlexFile(vocabConfigPath);
            if (cfg.Status != 0)
            {
                const err2 = "ERROR: BuildVocabSearch: Vocab config parse error [ERR37688]\n" + cfg.StatusMessage;
                console.log(err2);
                reject(err2);
            }

            // ADD Build parameters for query
            cfg.addToObjBase("siteid", cms.siteId);

            // Get SQL WHERE query from config WITH parameter replacement
            let table = cfg.i("table").toStr(); // debugger
            let vocabSearchFields = cfg.i("searchFields").toStr();
            let RecordsPerPage = cfg.i("RecordsPerPage").toNum(25);
            let offset = (page - 1) * RecordsPerPage;
            let orderby = cfg.i("orderby").toStr(""); // Includes tag replacement
            let searchWhere = "";

            if (searchText.trim() != "")
            {
                searchWhere = cms.MakeSearch(vocabSearchFields, searchText, cms);
            }
            
            // let where = cfg.i("where").toStr(""); // FUTURE: NEEDS TO Include tag replacement
            let where = cms.cfgParamStr(cfg, "where"); // Includes tag replacement
            if (searchWhere != "")
            {
                where += " AND " + searchWhere;
            }

            // Optional search of specific columns/tags
            let searchTags = cfg.i("searchTags");
            searchTags.forEach (function(tagSearch) {
                console.log("tagSearch=" + tagSearch.toStr());
                /*
                let formField = tagSearch.i("formField").toStr().trim();
                if (formField != "") {
                    let matchList = cms.FormOrUrlParam(formField,"").trim();
                    if (matchList != "") {
                        let searchType = tagSearch.i("type").toStr().trim().toLowerCase();
                        switch (searchType) {
                            case "where-in":
                              // NOTE: If matchList is blank, then we select "ALL" rows
                              // If more than one item is specified, then WHERE-IN acts like an OR
                              let tableColumn = tagSearch.i("tableColumn").toStr().trim();
                              if (tableColumn != "") {
                                  let newWhere = tableColumn + " in " + cms.ConvertListToWhereIn(cms,matchList);
                                  where += " AND " + newWhere;
                              }
                            break;
                        }
                    }
                }
                */
            }); // end forEach

            //if (cms.SITE.DebugMode >= 5) { cms.WriteLog("custom", "DEBUG-03: sql where=" + where + "\n"); } // FUTURE DEBUG

            // Get COUNT of records (so we can do paging)
            let countRecords = await cms.db.GetCount(table, where);
            console.log("countRecords=" + countRecords);
/* FUTURE: RECOGNIZE ERROR CONDITIONS
            if (((cms.db.status != 0) || (countRecords < 0)) && cms.SITE.DebugMode > 0)
            {
                cms.WriteLog("custom", "BuildTableSearch-01: ERROR: GetCount=" + countRecords + "\n");
                cms.WriteLog("custom", "BuildTableSearch-02: ERROR: DB Status=" + cms.db.status + ", StatusMsg=" + cms.db.statusMessage + "\n");
            }
*/

            let fieldList = "*";
            if (cfg.i("format").toStr().toLowerCase() == "json") {
                // Here we only want to get the fields listed in the "Get Fields" list (cannot be packed in _json - FUTURE: Maybe allow ability to extract from _json ?)
                fieldList="";
                cfg.i("GetFields").forEach( f => {
                    fieldList += ((fieldList=="")?"":",") + f.toStr();
                });
            }

            let sqlVocab = "SELECT " + fieldList + " FROM " + table + " " + where + " " + orderby + " LIMIT " + offset + ", " + RecordsPerPage + " ";
            //if (cms.SITE.DebugMode > 6) { cms.WriteLog("custom", "BuildTableSearch-09: Debug: SQL=" + sqlVocab + "\n"); }
            //if (cms.SITE.DebugMode > 6) { cms.WriteLog("custom", "BuildTableSearch-10: COUNT-A=" + countRecords + "\n"); }

            // Get data records
            let recVocab = await cms.db.GetDataReader(sqlVocab); // returns array
/* FUTURE: RECOGNIZE ERROR CONDITIONS
            if (((cms.db.status != 0) || (recVocab.Status != 0)) && cms.SITE.DebugMode > 0)
            {
                cms.WriteLog("custom", "BuildTableSearch-11: ERROR: DB Status=" + cms.db.status + ", StatusMsg=" + cms.db.statusMessage + "\n");
                cms.WriteLog("custom", "BuildTableSearch-12: ERROR: Recordset Status=" + recVocab.Status + "\n");
            }
            if (cms.SITE.DebugMode > 6) { cms.WriteLog("custom", "BuildTableSearch-13: COUNT-B=" + recVocab.Length + "\n"); }
*/
            if (cfg.i("format").toStr().toLowerCase() != "json") { // format=html

                // Create TABLE HEADER
                let tblHeader = cms.cfgParamStr(cfg, "TableHeader");  // With tag replacement
                let tblRow = cfg.i("TableRow").toStr();  // NO TAG REPLACEMENT!!! (that comes later)
                let tblFooter = cms.cfgParamStr(cfg, "TableFooter");  // With tag replacement
                Content.append(tblHeader + "\n");

                // Create TABLE ROWS
                recVocab.forEach (rec => {
                    Content.append(
                        cms.tagReplaceString(tblRow, rec)
                    );
                });

                // TABLE FOOTER
                Content.append(tblFooter + "\n");
            } // end if (cfg["format"] != "json")

            // Add PAGING INFO at bottom of table - hidden for jQuery to read and use
            Content.append("<input type='hidden' id='rowcount' ref='rowcount' value='" + countRecords + "'>");
            Content.append("<input type='hidden' id='recordsperpage' ref='recordsperpage' value='" + RecordsPerPage + "'>\n");

            // Count at bottom of page (the js script adds this on the front-end)
            // Content.Append("<br>Total Records: " + countRecords + "<br>\n");

            // FUTURE: TODO-NOW: EXTRACT _json fields! OR maybe iesDB should have done that for us already? Then we SCREEN for wanted fields?

            // Create JSON if this is a JSON request
            // FUTURE: TODO: Better way to flag JSON vs HTML (rather than checking if JSON object exists)
            if (ret.ReturnJson != null) {
                ret.ReturnJson.rowcount=countRecords;
                ret.ReturnJson.recordsperpage=RecordsPerPage;
                if (cfg.i("format").toStr().toLowerCase() == "json") {
                    ret.ReturnJson.data=recVocab;
                } else { // format=html
                    ret.ReturnJson.content=Content.toString();
                }
            }
        
            resolve(''); // success
           // ================================================ END
            } catch (err) {
                let errmsg = "ERROR: " + _siteID + ".BuildTableSearch(): " + err;
                console.log(errmsg);
                reject(errmsg);
            }
        });
    } // end BuildTableSearch()

}

module.exports = webEngine;