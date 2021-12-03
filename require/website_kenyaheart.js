const StringBuilder = require("string-builder");
const iesJSON = require('./iesJSON/iesJsonClass.js');
const iesCommonLib = require('./iesCommon.js');
const iesCommon = new iesCommonLib();
const iesDbClass = require('./iesDB/iesDbClass.js');
// const iesDB = new iesDbClass();  // use cms.db instead
const jwt = require('jsonwebtoken');


const { existsSync, readFileSync } = require('fs');
const { get } = require("http");
const { resolve } = require("path");

const _siteID = 'kenyaheart';
//var assignedSiteID = '';

class webEngine {

    constructor(thisSiteID) {
        this.assignedSiteID = thisSiteID;
        this.errorMessage = '';

    }

    invalidSiteID(cms) {
        if (this.assignedSiteID != _siteID) {
            cms.err = 517;
            cms.errMessage = 'ERROR: webEngine missmatch: ' + this.assignedSiteID + ' != ' + _siteID;
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
                    case "tablesearch":
                        let searchText = iesCommon.FormOrUrlParam(cms,"search","");
                        let page = iesCommon.FormOrUrlParam(cms,"page",1);
                        try { page = parseInt(page); }
                        catch { page = 1; }
                        if (page < 1) { page = 1; }
                        iesCommon.PrepForJsonReturn(ret);
                        await this.BuildTableSearch(cms, searchText, content, page, ret);
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

    CreateHtml(cms) { // async
        return new Promise(async (resolve,reject) => {
            try {
        // ================================================ BEGIN
        var fileType = '';
        let pageHead = new iesJSON();
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
            filePath = iesCommon.getParamStr(cms, "DefaultPageID", "home");
            fileType == 'html'
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

        //check for user login  

        if (cms.pageId.toLowerCase() == 'login') {

            let username = cms.body.Username;
            let password = cms.body.Password;

            // if username is correct and password 
            // create a JWT and return it to frontend 
            // redirect to the landing page  
            // if invalid password display error message  
            if (username || password) {
                if (username == 'joe' && password == 'friendofFelix84') {

                    this.errorMessage = 'login successful';

                    cms.redirect = cms.SITE.getStr('MEMBER_DEFAULT_PAGE', 'admin');

                    let user = { username: 'joe', userid: 1, userlevel: 9, siteid: cms.siteID };
                    //var token = jwt.encode({user}, secretKey); 

                    const token = jwt.sign({ user }, cms.JWT_SECRET, {
                        expiresIn: cms.JWT_EXPIRES_IN,
                    });
                    cms.newToken = token;

                } else {
                    this.errorMessage = 'login not successful';
                    // Invalidate Token
                    let user = { username: '', userid: -1, userlevel: 0, siteid: cms.siteID };
                    //var token = jwt.encode({user}, secretKey); 

                    const token = jwt.sign({ user }, cms.JWT_SECRET, {
                        expiresIn: -1,
                    });
                    cms.newToken = token;
                }
            }

        }

        // FUTURE: Determine if path is located in root (shared common folders) or in Websites/<siteid>

        if (fileType == 'html') {
            cms.resultType = 'html';
            cms.mimeType = 'text/html';
            cms.fileFullPath = iesCommon.FindFileInFolders(filePath + '.cfg',
                './websites/' + cms.siteID + '/pages/',
                './cmsCommon/pages/'
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
            if (cms.user.level < cms.minViewLevel) {
                cms.Html += `ERROR: Permission denied. (${cms.user.level}/${cms.minViewLevel}) [ERR7571]<br>`;
                cms.redirect = cms.SITE.i("LOGIN_PAGE").toStr("login");
                resolve('Warning: permission denied. [WARN5111]');
            }

            if (cms.HEADER.contains("ResponseType")) {
                cms.resultType = cms.HEADER.i("ResponseType").toStr("html").trim().toLowerCase();
            }

            // Lookup page template (if HTML response expected)
            pageTemplate = "layout_" + pageHead.getStr("Template") + ".cfg";
            templatePath = iesCommon.FindFileInFolders(pageTemplate,
                './websites/' + cms.siteID + '/templates/',
                './cmsCommon/templates/'
            );
            if (!templatePath) {
                cms.Html += "ERROR: Template not found: " + pageTemplate + "<br>";
                reject('ERROR: Template not found. [ERR5449]');
            }
            //cms.Html += "Template found: " + templatePath + "<br>";
            var template = readFileSync(templatePath, 'utf8');
            cms.Html = await iesCommon.ReplaceTags(template, pageHead, contentHtml, this, cms);

        } else {
            // NON-HTML/JSON RESOURCES
            // cms.Html += 'DEBUGGER: get non-html file<br>pathExt=' + cms.pathExt +'<br>cms.url.pathname=' + cms.url.pathname + '<br>urlBasePath=' + cms.urlBasePath + '<br>';
            if (cms.urlBasePath.toLowerCase() == 'cmscommon') {
                // look for file in cmsCommon
                cms.fileFullPath = iesCommon.FindFileInFolders(cms.urlFileName,
                    './' + cms.urlPathList.join('/')
                );
            } else {
                // look for file in SITE folder
                cms.fileFullPath = iesCommon.FindFileInFolders(cms.urlFileName,
                    './websites/' + cms.siteID + '/' + cms.urlPathList.join('/')
                );
            }
            cms.mimeType = iesCommon.mime[cms.pathExt] || 'text/plain';
            cms.resultType = 'file';
            cms.Html += 'DEBUGGER: cms.fileFullPath=[' + cms.fileFullPath + ']<br>mimeType=' + cms.mimeType;
            resolve(''); // success
        }
        resolve(''); // success
        // ================================================ END
            } catch (err) {
                let errmsg = "ERROR: " + _siteID + ".CustomTags(): " + err;
                console.log(errmsg);
                reject(errmsg);
            }
        });
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
        let languages = new iesJSON("{}");
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
            let configName = cms.db.dbStr(iesCommon.Sanitize(iesCommon.FormOrUrlParam(cms,"config","")), 40, false);
            let vocabFile = "table_" + configName + ".cfg";
            let vocabConfigPath = iesCommon.FindFileInFolders(vocabFile, iesCommon.getParamStr(cms, "ConfigFolder"));
            if (!vocabConfigPath)
            {

                const err1 = "ERROR: BuildVocabSearch: Vocab config not found: " + vocabFile + " [ERR37617]";
                console.log(err1);
                reject(err1);
            }
            let cfg = new iesJSON();
            cfg.DeserializeFlexFile(vocabConfigPath);
            if (cfg.Status != 0)
            {
                const err2 = "ERROR: BuildVocabSearch: Vocab config parse error [ERR37688]\n" + cfg.StatusMessage;
                console.log(err2);
                reject(err2);
            }

            // ADD Build parameters for query
            cfg.addToObjBase("siteid", cms.siteID);

            // Get SQL WHERE query from config WITH parameter replacement
            let table = cfg.i("table").toStr(); // debugger
            let vocabSearchFields = cfg.i("searchFields").toStr();
            let RecordsPerPage = cfg.i("RecordsPerPage").toNum(25);
            let offset = (page - 1) * RecordsPerPage;
            let orderby = cfg.i("orderby").toStr(""); // Includes tag replacement
            let searchWhere = "";

            if (searchText.trim() != "")
            {
                searchWhere = iesCommon.MakeSearch(vocabSearchFields, searchText, cms);
            }
            
            // let where = cfg.i("where").toStr(""); // FUTURE: NEEDS TO Include tag replacement
            let where = iesCommon.cfgParamStr(cfg, "where"); // Includes tag replacement
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
                    let matchList = iesCommon.FormOrUrlParam(cms,formField,"").trim();
                    if (matchList != "") {
                        let searchType = tagSearch.i("type").toStr().trim().toLowerCase();
                        switch (searchType) {
                            case "where-in":
                              // NOTE: If matchList is blank, then we select "ALL" rows
                              // If more than one item is specified, then WHERE-IN acts like an OR
                              let tableColumn = tagSearch.i("tableColumn").toStr().trim();
                              if (tableColumn != "") {
                                  let newWhere = tableColumn + " in " + iesCommon.ConvertListToWhereIn(cms,matchList);
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
                let tblHeader = iesCommon.cfgParamStr(cfg, "TableHeader");  // With tag replacement
                let tblRow = cfg.i("TableRow").toStr();  // NO TAG REPLACEMENT!!! (that comes later)
                let tblFooter = iesCommon.cfgParamStr(cfg, "TableFooter");  // With tag replacement
                Content.append(tblHeader + "\n");

                // Create TABLE ROWS
                recVocab.forEach (rec => {
                    Content.append(
                        iesCommon.tagReplaceString(tblRow, rec)
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
                let errmsg = "ERROR: " + _siteID + ".CustomTags(): " + err;
                console.log(errmsg);
                reject(errmsg);
            }
        });
    } // end BuildTableSearch()

}

module.exports = webEngine;