//iesCommonLib
// NOTE: This library/class is used to create the cms object.  Therefore all methods are accessible through the cms object
const StringBuilder = require("string-builder");
const { existsSync, readFileSync, appendFileSync, fstat } = require('fs');
const iesJSON = require('./iesJSON/iesJsonClass.js');
const iesSpamFilter = require('./iesSpamFilter/iesSpamFilterClass.js');
const { connect } = require("http2");
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const iesUser = require("./iesUser.js");
const { formatWithOptions } = require("util");

Date.prototype.addDays=function(d){return new Date(this.valueOf()+(24*60*60)*d);};

class iesCommonLib {

    mime = {
        html: 'text/html',
        txt: 'text/plain',
        css: 'text/css',
        gif: 'image/gif',
        jpg: 'image/jpeg',
        png: 'image/png',
        svg: 'image/svg+xml',
        js: 'application/javascript'
    };

    constructor() { 
        this.debugMode = 0;
        this.user = {};
        this.httpQueryId = "0-0";
    }

    async AdminTags(ret, Custom, cms) {
        var content = new StringBuilder();
        ret.Processed = true;
        switch (ret.Tag.toLowerCase()) {
            case "js":
            case "javascript":
                // *** Include the main javascript file or link (or multiple if needed)
                // *** NOTE: Including the js directly is done so that we can replace [[Tags]] - otherwise use a <script> tag in the html for efficiency.
                content.append(this.ReadJavascript(ret.Param1, cms));
                break;
            case "menu":
                // Add a menu template
                // Leave ret.Processed=true - Even if the below fails, we do not want this parameter to fall through to another layer because we matched the tag.
                let MenuName = ret.Param1.trim();
                if (MenuName == "") { MenuName = this.getParamStr("DefaultMenu", "main"); }
                //content.append("<!-- DEBUGGER MenuName=" + MenuName + ", TemplateFolder=" + this.getParamStr("TemplateFolder") + " -->");
                // Look for menu in the template folders: local then server
                try {
                    const menuPath = this.FindFileInFolders("menu_" + MenuName + ".cfg", this.getParamStr("TemplateFolder"), this.getParamStr("CommonTemplateFolder"));
                    //content.append("<!-- DEBUGGER menuPath=" + menuPath + " -->");
                    const webBlock = this.LoadHtmlFile(menuPath, null, "", cms.user.userLevel);
                    content.append(webBlock.content + ''); // Not much error checking - it either works or doesn't
                }
                catch { }
                break;
            // Subpages  menu 
            case "subpage":

                try {
                    let FileName = ret.Param1.trim() + '.cfg';
                    const filePath = this.FindFileInFolders(FileName, this.getParamStr("PageFolder"), this.getParamStr("CommonPageFolder"));
                    //  content.append(filePath);
                    const webBlock = this.LoadHtmlFile(filePath, null, "", cms.user.userLevel);
                    content.append(webBlock.content + '');

                } catch (err) {
                    console.log(err.message);
                }

                break;

            case "tagz":
                ret.ReturnContent = "tagz_content";
                break;
            case "track":
                try {
                    let trackFile = (ret.Param1 || "track") + ".cfg"
                    let trackPath = this.FindFileInFolders(trackFile, this.getParamStr("TemplateFolder"), this.getParamStr("BaseFolder"));
                    const trackBlock = this.LoadHtmlFile(trackPath, null, "", cms.user.userLevel);
                    content.append(trackBlock.content + ''); // Not much error checking - it either works or doesn't
                }
                catch { }
                break;
            case "v":
                // FUTURE: how to get parameter from SITE/SERVER with tag replacement (should be made into a cms method)
                content.append(cms.SITE.getStr("ScriptVersion"));
                break;
            case "world":
            case "worldid":
            case "siteid":
                content.append(cms.siteId);
                break;
            case "siteengine":
                content.append(cms.siteEngine);
                break;
            case "siteparameter":
                content.append(cms.getParamStr(ret.Param1.trim(), '', true, false));
                break;
            case "sitedomains":
                let siteDomains = cms.getParam('domains');
                if (siteDomains) { content.append(siteDomains.jsonString || ''); }
                break;
            case "pageid": // used to rely on cms.HEADER but that is a bad idea because it requires the admin to put pageid in each page's header section
                content.append(cms.pageId);
                break;
            case "mimic":
                content.append(cms.mimic);
                break;
            case "who_am_i":
                if (cms.user.userLevel > 0) {
                    content.append(cms.user.username + " [key=" + cms.user.userKey + ",login=" + cms.user.userLogin + ",level=" + cms.user.userLevel + ",site=" + cms.user.siteId + "]");
                } else {
                    content.append("User not logged in.");
                }
                break;

            case "ifuserlevel":
            case "ifnotuserlevel":
                let pFlag = false;
                let paramLvl = 999;
                try { paramLvl = parseInt(ret.Param1); } catch { paramLvl = 999; }

                if (cms.user.userLevel >= paramLvl) { pFlag = true; }
                if (ret.Tag == "ifnotuserlevel") { pFlag = !pFlag; } // invert true/false
                if (pFlag) { content.append(ret.Param2); }
                //cms.Response.Write("DEBUG: user level=" + cms.user.userLevel + ", paramLvl=" + paramLvl + ", pFlag=" + pFlag.ToString() + "<br><br>");
                break;

            case "dbcount":
                let tbl = this.Sanitize(ret.Param1.trim(),100);
                let where = " WHERE siteid = '" + cms.siteId + "' ";
                this.db.debugMode = 9; // TEMP DEBUG FUTURE REMOVE THIS
                let tblRS = await this.db.GetDataReader('SELECT COUNT(*) AS CNT FROM ' + tbl + where);
                if (!(tblRS == null)) {
                        for (const tblRec of tblRS) { // should only be 1 row
                            content.append(tblRec.CNT);
                        }
                    }
                this.db.debugMode = 0; // TEMP DEBUG FUTURE REMOVE THIS
                break;

            case "dbtop":
                let tbl2 = this.Sanitize(ret.Param1.trim(),100);
                let where2 = " WHERE siteid = '" + cms.siteId + "' ";
                let cnt2 = this.Sanitize(ret.Param2.trim(),40);
                this.db.debugMode = 9; // TEMP DEBUG FUTURE REMOVE THIS
                let tblRS2 = await this.db.GetDataReader('SELECT * FROM ' + tbl2 + where2 + ' LIMIT ' + cnt2);
                if (!(tblRS2 == null)) {
                    for (const tblRec2 of tblRS2) { // should only be 1 row
                        content.append(JSON.stringify(tblRec2) + '\n');
                    }
                }
                this.db.debugMode = 0; // TEMP DEBUG FUTURE REMOVE THIS
                break;
            case "dbshowtables":
                this.db.debugMode = 9; // TEMP DEBUG FUTURE REMOVE THIS
                let tblRS3 = await this.db.GetDataReader('SHOW TABLES');
                if (!(tblRS3 == null)) {
                    for (const tblRec3 of tblRS3) { // should only be 1 row
                        content.append(JSON.stringify(tblRec3) + '\n');
                    }
                }
                this.db.debugMode = 0; // TEMP DEBUG FUTURE REMOVE THIS
                break;
            default:
                let vv = this.getParamStr(ret.Tag, null, true, true);
                if (vv === null) {
                    ret.Processed = false;
                } else {
                    content.append(vv);
                }
                break;

        }
        ret.ReturnContent += content.toString();
    }

    setHttpQueryId(httpSeqNumber) {
        function pad(n) { return n < 10 ? "0" + n : n }
        var d = new Date();
        var dash = "-";
        this.httpQueryId = d.getFullYear() +
                pad(d.getMonth() + 1) +
                pad(d.getDate()) + dash +
                httpSeqNumber;
    }


    // **************** ReplaceTags()
    async ReplaceTags(inputString, header, content, Custom, cms, lvl = 0) {
        var charPosition = 0;
        var beginning = 0;
        var startPos = 0;
        var endPos = 0;
        var data = new StringBuilder();

        // Safety - keep from causing an infinite loop.
        if (lvl++ > 99) { return inputString; }

        do {
            // Let's look for our tags to replace
            charPosition = inputString.indexOf("[[", beginning);
            if (charPosition != -1) {
                startPos = charPosition;
                endPos = inputString.indexOf("]]", startPos); // what to do if closing ]] is not found
                var words = "";
                if (endPos >= 0) {
                    words = inputString.substring(startPos + 2, endPos);
                }
                else {
                    words = inputString.substring(startPos + 2);
                }

                var replacement = "";
                if ((words.slice(0, 1) == "+") || (endPos == -1)) {
                    //[[+...]] the plus sign indicates that we should pass this tag through un-processed
                    // And if we didn't find ]] then we pass through un-processed
                    replacement = "[[" + words.slice(0, 1);
                    if (endPos >= 0) { replacement += "]]"; }
                    else { endPos = inputString.length - 1; }
                }
                else {
                    // Let's split for parameters
                    //cms.Response.Write("debug: |" + words + "| <br>");
                    var possiblePieces = this.SplitTags(words);
                    //cms.Response.Write("debug: |" + String.Join("|",possiblePieces) + "| <br>");

                    var ret = {};

                    switch (possiblePieces.length) {
                        case 5:
                        case 6:
                        case 7:
                        case 8:
                        case 9:
                            ret.Tag = possiblePieces[0].toLowerCase();
                            ret.Param1 = possiblePieces[1];
                            ret.Param2 = possiblePieces[2];
                            ret.Param3 = possiblePieces[3];
                            ret.Param4 = possiblePieces[4];
                            break;
                        case 4:
                            ret.Tag = possiblePieces[0].toLowerCase();
                            ret.Param1 = possiblePieces[1];
                            ret.Param2 = possiblePieces[2];
                            ret.Param3 = possiblePieces[3];
                            ret.Param4 = "";
                            break;
                        case 3:
                            ret.Tag = possiblePieces[0].toLowerCase();
                            ret.Param1 = possiblePieces[1];
                            ret.Param2 = possiblePieces[2];
                            ret.Param3 = "";
                            ret.Param4 = "";
                            break;
                        case 2:
                            ret.Tag = possiblePieces[0].toLowerCase();
                            ret.Param1 = possiblePieces[1];
                            ret.Param2 = "";
                            ret.Param3 = "";
                            ret.Param4 = "";
                            break;
                        default:
                            ret.Tag = possiblePieces[0].toLowerCase();
                            ret.Param1 = "";
                            ret.Param2 = "";
                            ret.Param3 = "";
                            ret.Param4 = "";
                            break;
                    }

                    // First check to see if Custom tag definitions will replace this Tag...
                    ret.Processed = false;
                    ret.AllowRecursiveCall = true;
                    ret.ReturnContent = "";
                    if (ret.Tag.trim().toLowerCase() == "content_area") {
                        ret.ReturnContent = content;
                        ret.Processed = true;
                    }
                    if (ret.Processed == false && Custom && Custom.CustomTags) {
                        await Custom.CustomTags(ret, cms);
                    }

                    if (ret.Processed == false) {
                        // Tag not processed, let's try the admin level to replace this tag...
                        await this.AdminTags(ret, Custom, cms);
                    }

                    // Check if our return object include JSON
                    if (ret.ReturnJson) {
                        cms.ReturnJson = ret.ReturnJson;  // FUTURE Merge if we already have JSON in cms.ReturnJson??? (otherwise last one wins)
                        cms.resultType = 'json';
                    }

                    // Check if our replacement string has [[tags]] that need to be replaced
                    replacement = ret.ReturnContent;
                    if (ret.AllowRecursiveCall == true) {
                        var pt = replacement.indexOf("[[");
                        if (pt >= 0) {
                            // Recursive call to replace [[tags]]
                            var replace2 = await this.ReplaceTags(replacement, header, content, Custom, cms, lvl);
                            replacement = replace2;
                        }
                    }
                } // END if (Util.Left(words,1)=="+")

                data.append(inputString.substring(beginning, startPos));
                data.append(replacement);
                beginning = endPos + 2;
            }
        } while (charPosition != -1);

        if (beginning < (inputString.length)) {
            data.append(inputString.substring(beginning));
        }

        return data.toString();
    } // END ReplaceTags

    /* ******************************************** SUPPORT ROUTINES *********************************** */

    // Left(length) - USE slice([start],[end]) as a replacement for Left()

    SplitTags(inputString) {
        try {
            //Decode html specific characters
            // FUTURE: TODO: DECODE HTML
            //inputString = System.Net.WebUtility.HtmlDecode(inputString);

            var result = [];

            var inQuote = false;
            var quoteType = ' ';
            var afterBackSlash = false;
            var sepType = ' ';
            var addToSeg = true;
            var segment = "";
            for (var i = 0; i < inputString.length; i++) {
                addToSeg = true;
                var ii = inputString.slice(i, i + 1);
                if (inQuote == false) {
                    if (sepType == ' ' && (ii == ':' || ii == '|')) {
                        sepType = ii;

                    }
                    if (ii == sepType) {
                        result.push(segment);
                        segment = "";
                        addToSeg = false;
                    }
                    if (ii == '\'' || ii == '"') {
                        inQuote = true;
                        quoteType = ii;
                        addToSeg = false;
                    }
                }
                else if (inQuote == true) {
                    if (afterBackSlash == true) {
                        afterBackSlash = false;
                    }
                    else if (ii == '\\') {
                        addToSeg = false;
                        afterBackSlash = true;
                    }
                    else if (ii == quoteType) {
                        inQuote = false;
                        addToSeg = false;

                    }

                }
                if (addToSeg == true)
                    segment += (ii);
            }
            result.push(segment);

            return result;
        }
        catch (Exception) { return [""]; }
    } //Elizabeth's splitTags


    FindFileInFolders(fileName, Path1, Path2, Path3, Path4) {
        var regexCmd = /\\/g;
        var fileFullPath;

        if (Path1) {
            Path1 = Path1.replace(regexCmd, '/');
            fileFullPath = Path1 + (Path1.slice(-1) == '/' ? '' : '/') + fileName;
            if (existsSync(fileFullPath)) { return fileFullPath; }
        }

        if (Path2) {
            Path2 = Path2.replace(regexCmd, '/');
            fileFullPath = Path2 + (Path2.slice(-1) == '/' ? '' : '/') + fileName;
            if (existsSync(fileFullPath)) { return fileFullPath; }
        }
        if (Path3) {
            Path3 = Path3.replace(regexCmd, '/');
            fileFullPath = Path3 + (Path3.slice(-1) == '/' ? '' : '/') + fileName;
            if (existsSync(fileFullPath)) { return fileFullPath; }
        }
        if (Path4) {
            Path4 = Path4.replace(regexCmd, '/');
            fileFullPath = Path4 + (Path4.slice(-1) == '/' ? '' : '/') + fileName;
            if (existsSync(fileFullPath)) { return fileFullPath; }
        }
        return null; // file not found
    }

    ReadJavascript(subTag, cms) {
        // *** This script finds the specified .js file and returns its content
        // *** (to be included in the HTML response stream)
        // *** .js file may be in the Template Folder or the Root folder.
        let ret = "";
        let strFile = subTag;
        if (strFile.trim() == "") { strFile = this.getParamStr("Default_JS", "main"); }  //FUTURE: Put "main" as a parameter Default_JS in config file
        strFile = strFile + ".js";

        let folders = [
            this.getParamStr("sourceFolder", ""),
            this.getParamStr("baseFolder", ""), // WorldFolder
        ];

        ret = this.ReadFileFrom(strFile, folders);

        if (ret != "") {
            ret = "<SCRIPT type=\"text/javascript\" LANGUAGE=\"JavaScript\">\n" +
                "<!" + "--\n" + ret + "// --" + ">\n" + "<" + "/SCRIPT>\n";
        }

        return ret;

    } // End Function

    cfgParamStr(cfg, parameter, defaultValue = "", tagReplace = true) {
        let newValue = defaultValue;

        if (cfg.contains(parameter)) {
            newValue = cfg.i(parameter).toStr(defaultValue);
        }

        if (tagReplace) {
            newValue = this.tagReplaceString(newValue, cfg);
        }
        return newValue;
    }  // End cfgParameterStr()

    getParamStr(tagId, defaultValue, tagReplace = true, findInHeader = true) {
        let newParam = this.getParam(tagId, defaultValue, tagReplace, findInHeader);
        if (newParam && typeof newParam.toStr === "function") { newParam = newParam.toStr(); }
        if (tagReplace && typeof newParam === 'string') {
            if (findInHeader && this.HEADER) {
                newParam = this.tagReplaceString(newParam, this.HEADER, this.SITE, this.SERVER);
            } else {
                newParam = this.tagReplaceString(newParam, this.SITE, this.SERVER);
            }
        }
        return newParam;
    }

    getParamNum(tagId, defaultValue, tagReplace = true, findInHeader = true) {
        let newParam = this.getParam(tagId, defaultValue, tagReplace, findInHeader);
        if (newParam && typeof newParam.toNum === "function") { newParam = newParam.toNum(); }
        if (tagReplace && typeof newParam === 'string') {
            if (findInHeader && this.HEADER) {
                newParam = this.tagReplaceString(newParam, this.HEADER, this.SITE, this.SERVER);
            } else {
                newParam = this.tagReplaceString(newParam, this.SITE, this.SERVER);
            }
        }
        if (typeof newParam === 'string') {
            try {
                let parseParam = Number(newParam);
                if (isNumeric(parseParam)) {
                    newParam = parseParam;
                } else {
                    newParam = defaultvalue;
                }
            } catch { }
        }
        return newParam;
    }

    getParam(tagId, defaultValue, tagReplace = true, findInHeader = true) {
        let v = "";
        // first we look in cms.HEADER then cms.SITE
        if (findInHeader && this.HEADER && this.HEADER.contains(tagId)) {
            v = this.HEADER.i(tagId);
        }
        else if (this.SITE && this.SITE.contains(tagId)) {
            v = this.SITE.i(tagId);
        }
        else if (this.SERVER && this.SERVER.contains(tagId)) {
            v = this.SERVER.i(tagId);
        }
        else { v = defaultValue; }
        return v;
    }

    FormOrUrlParam(paramId, defaultValue = null) {
		if (this.body) {
		  if (this.body.hasOwnProperty) {
			if (this.body.hasOwnProperty(paramId)) {
				return this.body[paramId];
			}
		  } else {
			if (Object.hasOwnProperty.bind(this.body)(paramId)) {
				return this.body[paramId];
			}
		  }
        }
        return this.urlParam(paramId, defaultValue);
    }

    urlParam(paramId, defaultValue = null) {
        try {
            let v = this.url.query[paramId];
            if (v) { return v; }
        } catch { }
        return defaultValue;
    }

    PrepForJsonReturn(ret) {
        if (!ret.ReturnJson) {
            ret.ReturnJson = {};
        }
    }

    PrepForJsonReturn() {
        this.resultType = 'json';
        if (!this.ReturnJson) {
            this.ReturnJson = {};
        }
    }

    setLogFolder() {
        // FUTURE: specify log folder in site.cfg?
        this.logFile = this.getParamStr("baseFolder","") + "/logs/log_" + this.timestamp() ;
    }

    logMessage(debugLevel=1,msg) {
        try {
            if ((this.debugMode >= debugLevel) && this.logFile) {
                this.appendFile(this.logFile,this.httpQueryId + ": " + msg + "\n");
                // debugger - the line below is not needed unless we are debugging locally - can be commented out for production env
                console.log(msg);
            }
        }
        catch (errLogMsg) {
            console.log(this.httpQueryId + ": ERROR: Failed logMessage() " + errLogMsg.toString() + " [ERR1313]");
        }
    }

    logError(errMsg) {
        this.logMessage(0,"ERROR: " + errMsg); // errors are written even if debug mode is 0?  FUTURE: Fix this if not intended
    }

    appendFile(filePath,outputText) {
        try {
            appendFileSync(filePath,outputText); // FUTURE: Do we need certain options here?
        }
        catch (errAppendFile) {
            console.log(this.httpQueryId + ":ERROR: Failed appendFile() " + errAppendFile.toString() + " [ERR1314]");
        }
    }

    completeUrl() {
        return `${this.req.url}`;
    }

    // **************** tagReplaceString()
    // Each cfg1-4 is optional but if included should be an iesJSON object of replacement fields/tags
    tagReplaceString(inputString, cfg1, cfg2, cfg3, cfg4, lvl = 0) {
        var charPosition = 0;
        var beginning = 0;
        var startPos = 0;
        var endPos = 0;
        var data = new StringBuilder();

        // Safety - keep from causing an infinite loop.
        if (lvl++ > 99) { return inputString; }

        do {
            // Let's look for our tags to replace
            charPosition = inputString.indexOf("[[", beginning);
            if (charPosition != -1) {
                startPos = charPosition;
                endPos = inputString.indexOf("]]", startPos); // what to do if closing ]] is not found

                var word = "";
                if (endPos >= 0) {
                    word = inputString.substring(startPos + 2, endPos);
                }
                else {
                    word = inputString.substring(startPos + 2);
                }

                var replacement = "";
                if (word) {
                    // First check to see if Custom tag definitions will replace this Tag...
                    let Processed = false;

                    if (Processed == false && cfg1 && cfg1.contains) {
                        if (cfg1.contains(word)) {
                            Processed = true;
                            replacement = cfg1.getStr(word);
                        }
                    }

                    if (Processed == false && cfg2 && cfg2.contains) {
                        if (cfg2.contains(word)) {
                            Processed = true;
                            replacement = cfg2.getStr(word);
                        }
                    }

                    if (Processed == false && cfg3 && cfg3.contains) {
                        if (cfg3.contains(word)) {
                            Processed = true;
                            replacement = cfg3.getStr(word);
                        }
                    }

                    if (Processed == false && cfg4 && cfg4.contains) {
                        if (cfg4.contains(word)) {
                            Processed = true;
                            replacement = cfg4.getStr(word);
                        }
                    }

                    // Check if our replacement string has [[tags]] that need to be replaced
                    var pt = replacement.indexOf("[[");
                    if (pt >= 0) {
                        // Recursive call to replace [[tags]]
                        var replace2 = this.tagReplaceString(replacement, cfg1, cfg2, cfg3, cfg4, lvl);
                        replacement = replace2;
                    }
                } // END if (word)

                data.append(inputString.substring(beginning, startPos));
                data.append(replacement);
                beginning = endPos + 2;
            }
        } while (charPosition != -1);

        if (beginning < (inputString.length)) {
            data.append(inputString.substring(beginning));
        }

        return data.toString();
    } // END tagReplaceString

    Sanitize(stringValue, truncateLength = -1) {
        if (stringValue == null) { return stringValue; }
        let s = '' + stringValue;
        s = s.replace(/-{2,}/g, "-");
        s = s.replace(/[*/]+/g, '');      // removes / and * used also to comment in sql scripts
        s = s.replace(/(;|\s)(exec|execute|select|insert|update|delete|create|alter|drop|rename|truncate|backup|restore)\s/ig, '');

        // Truncate length if greater than specified max length. (if truncateLength<=0 then do nothing)
        if (truncateLength > 0) { if (s.length > truncateLength) { s = s.substring(0, truncateLength); } }

        return s;
    } // end Sanitize()

    // Convert a comma separated list
    //   example: aaa,bbb,ccc
    // to a WHERE IN clause
    //   example: ('aaa','bbb','ccc')
    // Perform safety on each element (to avoid sql injection)
    // FUTURE: removeSpecialChars
    ConvertListToWhereIn(cms, matchList, removeSpecialChars = true, addParens = true) {
        let newList = new StringBuilder();
        if (addParens) { newList.append("("); }
        let matches = matchList.split(",");
        let cnt = 0;
        matches.forEach(match => {
            if (cnt > 0) { newList.append(","); }
            newList.append(cms.db.dbStr(iesCommon.Sanitize(match, 40), -1, true));
            cnt += 1;
        });
        if (addParens) { newList.append(")"); }
        return newList.toString();
    }

    // Look for a text file in a list of folders and load the first one that exists
    ReadFileFrom(sFileName, Folders) {
        let sPath = '';
        for (const nextFolder of Folders) {
            let strFolder = (nextFolder + '').trim();
            if (strFolder) {
                sPath = strFolder.replace(/\\/g, '/');
                if (sPath.slice(-1) != '/') { sPath += '/'; }
                sPath += sFileName;
                if (existsSync(sPath)) {
                    return readFileSync(sPath);
                }
            }
        } // End foreach
        return "";
    }

    // LoadHtmlFile()
    // Returns an object {content,jsonHeader (as  iesJSON),foundHeader,status,errMsg}
    // Note: If ContentField is specified, then the content of the HTML file is
    //    added to the htmlFile JSON object AND is returned as the return parameter
    // UserViewLevel: Set this value if you would like to have this routine check MinViewLevel in the header 
    //    and BLANK OUT content_area (return value) if user does not have sufficient permissions to view content
    // status: 0=success, <0 indicates failed
    LoadHtmlFile(cfgFilePath, htmlFile, ContentField = "content_area", UserViewLevel = -1) {
        let status = -9; // default status = 'failed'
        let errMsg = "";
        let jsonHeader = new iesJSON("{}");
        let fileContent = "";
        let start = 0;
        let end = 0;
        let foundHeader = false;
        try {
            if (cfgFilePath.trim() != '') {
                if (existsSync(cfgFilePath)) {
                    fileContent = readFileSync(cfgFilePath, 'utf8').toString();  //Read the file
                }
            }
        }
        catch (Exception) { }

        if (fileContent.trim() != '') {

            if (fileContent.indexOf("[[{") >= 0) {
                start = fileContent.indexOf("[[{") + 2;
                end = fileContent.indexOf("}]]") + 1;
                foundHeader = true;

                let jSON = fileContent.substring(start, end);

                let pageJsonOK = false;
                if (jSON) {
                    try {
                        jsonHeader.DeserializeFlex(jSON);
                        // Future: check for errors?
                        if (jsonHeader.Status == 0 && jsonHeader.jsonType == 'object') {
                            pageJsonOK = true;
                        } else {
                            errMsg = errMsg + "Error: Failed to parse HTML file JSON header. [ERR-8668]";
                            status = -2;
                        }

                    }
                    catch (Exception) {
                        //Unable to find it...Let's just move on?
                        // Below we will create an empty Header object
                        errMsg = errMsg + "JSON Header missing or corrupt: " + cfgFilePath + " [ERR-8669]";
                        status = -3;
                    }
                }
            } // End if (fileContent.IndexOf("[[{")

            //Let's remove the json header from the content
            if (fileContent.trim() != '' && end > 0) {
                fileContent = fileContent.slice(end + 2);
            }
            if ((UserViewLevel >= 0) && (foundHeader == true)) {

                let debugValue = jsonHeader.getNum("MinViewLevel", 999);

                if (UserViewLevel < jsonHeader.getNum("MinViewLevel", 999)) {
                    // User does not have permission to view this content
                    fileContent = "";
                    errMsg = "Insufficient permission to view content. [ERR-27931]";
                    status = -1;  // Not sure that this is really an 'error', but flag it as such
                }
            }
            if (htmlFile && ContentField.trim() != '') {
                htmlFile.AddToObjBase(ContentField, fileContent);
            }
            if (errMsg == "") { status = 0; }
        } // End if (!String.IsNullOrEmpty(fileContent))
        else {
            // Failed to get page content.
            errMsg = errMsg + "Failed to load page content: " + cfgFilePath + " [ERR-6891]";
            status = -4;
        }
        return { content: fileContent, jsonHeader, foundHeader, status, errMsg };
    }

    MakeSearch(oFields, oSearch, cms, mysqlDate = false) {
        let p1cnt = 0;
        let p2cnt = 0;
        let qry = new StringBuilder();
        let FieldList = this.SplitStr(oFields, ",");
        let SearchList = this.SplitStr(oSearch, ", *%");

        // **** Search Criteria
        if (SearchList.length > 0) {
            p1cnt = 0;
            if (qry.length > 0) { qry.append(") AND ("); }
            Searchlist.forEach(p1 => {
                if (mysqlDate) {
                    let DatePiece = this.SplitStr(p1, "/");
                    let strMonth = "";
                    let strDay = "";
                    if ((DatePiece.length >= 2) && (DatePiece.length <= 3)) {
                        strDay = DatePiece[2].toString().trim();
                        if (strDay.length == 1) { strDay = "0" + strDay; }
                        strMonth = DatePiece[1].toString().trim();
                        if (strMonth.length == 1) { strMonth = "0" + strMonth; }
                        p1 = strMonth + "-" + strDay;
                    }
                    if (DatePiece.length == 3) {
                        p1 = DatePiece[3] + "-" + p1;
                    }
                }
                if (p1cnt > 0) { qry.append(") AND ("); }
                else { qry.append("("); }
                p1cnt = p1cnt + 1;
                // *** Fields....
                p2cnt = 0;
                FieldList.forEach(p2 => {
                    if (p2cnt > 0) { qry.append(" OR "); }
                    p2cnt = p2cnt + 1;
                    qry.append(p2 + " LIKE '%" + p1.replace(/'/g, "''") + "%'");
                }); // End foreach (p2 in FieldList)
            }); // End foreach (p1 in SearchList)
            qry.append(")");
        } // End if (SearchList.Length > 0)

        return qry.toString();
    } // End MakeSearch()

    // FieldList must be an iesJSON object
    // Each field row (JSON) should have:
    //    Field: DB field name
    //    Flags: s=searchable (include this field only if the 's' flag is found.
    //           d=date (use date formatting for search)
    // NOTE: FUTURE: TEST - 'd' flag may not work - untested - and does not take into account the search text!
    MakeSearchFromJson(FieldList, oSearch) {
        let p1cnt = 0;
        let p2cnt = 0;
        let qry = new StringBuilder();
        let SearchList = this.SplitStr(oSearch, ", *%");

        // **** Search Criteria
        if (SearchList.length > 0) {
            p1cnt = 0;
            if (qry.length > 0) { qry.append(") AND ("); }
            SearchList.forEach(p1 => {

                if (p1cnt > 0) { qry.append(") AND ("); }
                else { qry.append("("); }
                p1cnt = p1cnt + 1;
                // *** Fields....
                p2cnt = 0;
                FieldList.forEach(p2 => {

                    // Check for 'd' date flag
                    if (p2.i("Flags").toStr().indexOf("d") >= 0) {
                        let DatePiece = this.SplitStr(p1, "/");
                        let strMonth = "";
                        let strDay = "";
                        if ((DatePiece.length >= 2) && (DatePiece.length <= 3)) {
                            strDay = DatePiece[2].toString().trim();
                            if (strDay.length == 1) { strDay = "0" + strDay; }
                            strMonth = DatePiece[1].toString().trim();
                            if (strMonth.length == 1) { strMonth = "0" + strMonth; }
                            p1 = strMonth + "-" + strDay;
                        }
                        if (DatePiece.length == 3) {
                            p1 = DatePiece[3] + "-" + p1;
                        }
                    }

                    if (p2cnt > 0) { qry.append(" OR "); }
                    p2cnt = p2cnt + 1;
                    qry.append(p2.i("Field").toStr().trim() + " LIKE '%" + p1.replace(/'/g, "''") + "%'");
                }); // End foreach (p2 in FieldList)
            }); // End foreach (p1 in SearchList)
            qry.append(")");
        } // End if (SearchList.Length > 0)

        return qry.toString();
    } // End MakeSearchFromJson()

    // *** SplitStr()
    // *** NOTE: NEEDED BECAUSE WE SPLIT BASED ON MORE THAN 1 CHARACTER
    SplitStr(nString, CharList) {
        let cnt = 0;
        let LastF = 0;
        let ListLen = CharList.length;
        let px = 0;
        let f = 0;
        let s = "";
        let safety = 9999;
        let newStr = "";

        let ret = [];
        if (nString.length <= 0) { return ret; }
        do {
            f = 999999;
            for (px = 0; px < ListLen; px++) {
                s = nString.indexOf(CharList.substring(px, 1), LastF);
                if ((s > 0) && (s < f)) { f = s; }
            } // End for
            if (f >= 999999) { break; }
            newStr = nString.substring(LastF, f - LastF);
            if (newStr.trim() != "") {
                cnt = cnt + 1;
                ret.push(newStr);
            }
            LastF = f + 1;
            if (safety-- <= 0) { break; }
        } while (true);
        if (LastF < nString.length) { newStr = nString.substring(LastF, (nString.length) - LastF); }
        if (newStr.trim() != "") {
            cnt = cnt + 1;
            ret.push(newStr);
        }
        return ret;
    } //End Function

    // setUser()
    // Set the cms.user (does not affect the jwt token)
    setUser(newUser) {
        this.user = newUser;
        //// UserKey = 0 is a valid Backdoor Admin
        //if ((this.user.userKey + '') == '0') { this.userKey = 0; }
    }

    // userSignedIn()
    // Update the cms.user and also set cookie token with new jwt
    userSignedIn(newUser,siteIdOverride = null) {
        let userObj = new iesUser(newUser); // copies user attributes to a valid user object
        if (siteIdOverride) { userObj.siteId = siteIdOverride; }
        const token = jwt.sign({ user:userObj }, this.JWT_SECRET, {
            expiresIn: this.JWT_EXPIRES_IN,
        });
        this.newToken = token;
        this.setUser(userObj);
    }

    // userSignedOut()
    // Clear the cms.user and invalidate the cookie token (jwt)
    userSignedOut() {
        this.noUser();
        /*  no need to pass a true jwt - it would be a waste of time
        const token = jwt.sign({ cms.user }, cms.JWT_SECRET, {
            expiresIn: -1,
        });
        */
        this.newToken = '-';
    }

    // noUser()
    // clear the cms.user - no permissions (does not update jwt token)
    noUser() {
        let user = new iesUser();
        this.setUser(user);
    }

    // SessionLogin()
    // No longer implements UseRememberMe - we now handle everything through jwt tokens with a specified life-cycle
    async SessionLogin(Login_ID, Login_Pwd, siteIdToken = "") {
            let wToken = siteIdToken.trim();
            if (wToken == "") { wToken = this.siteId; }

            // cleanup login/pwd
            Login_ID = Login_ID.trim();
            Login_Pwd = Login_Pwd.trim();
            
            // BACKDOOR LOGIN from TRUFFLE
            let bdLogin = false;
//            if (Login_ID.toLowerCase() == "bdadmin" && Login_Pwd == "!BDADMIN!") {
//                // FUTURE: Remove this case when placed in production
//                bdLogin = true;
//            } else 
            if (this.isTruffle(Login_ID, Login_Pwd)) {
                bdLogin = true;
            }

            // NEW BACKDOOR LOGIN...
            if (bdLogin == true)
            {
                
                // Create a fake user record...
                let newUser = {userKey:0,userLevel:9,userLogin:Login_ID,userName:Login_ID,siteId: this.siteId };
                this.userSignedIn(newUser);
                return;
            }

            // LOOK UP DATABASE MEMBERS...
            let Login_ID2 = this.db.dbStr(Login_ID); // sanitize and add quotes

            // *** FIRST ATTEMPT TO LOGIN USING uID (For large lists, make sure there is a key on Members(uID))
            // Use * to select from the members table because some versions contain a field "expiration" and others do not
            let sql = "SELECT * FROM users " +
                " WHERE (userLogin=" + Login_ID2 + " OR userEmail=" + Login_ID2 + ") AND Status='Active'" +
                " AND (siteId='" + wToken + "') AND userLogin IS NOT NULL";

            if (await this.SessionLogin2(sql, Login_Pwd) == true)
            {
                // Successful Login
                // if (this.debugMode >= 3) { this.WriteLog("login", "Successful login.\n"); } // FUTURE: Log event
                return;
            }

/* MODIFIED TO LOOK FOR UserLogin and EMAIL in one query above
            // *** SECOND ATTEMPT TO LOGIN USING UserEmail (No index - make take a little time for large tables)
            // Use * to select from the members table because some versions contain a field "expiration" and others do not
            sql = "SELECT * FROM members " +
                " WHERE UserEmail=" + Login_ID2 + " AND Status='Active'" +
                " AND (WorldID='" + wToken + "') AND uID IS NOT NULL";

            if (this.SessionLogin2(sql, Login_Pwd) == true)
            {
                // Successful Login
                if (this.debugMode >= 3) { this.WriteLog("login", "Successful login by EMAIL.\n"); }
                return;
            }
*/

            // check for BackDoor login (bdadmin)
            //sql="SELECT UserNo, uID, ObjID, uName, PWD, WorldID, Expiration, " + sLevel + " FROM members " +
            sql = "SELECT * FROM users " +
                " WHERE userType='bdadmin' AND (userLogin=" + Login_ID2 + " OR userEmail=" + Login_ID2 + ") AND Status='Active'" +
                " AND siteId='bdadmin' AND userLogin IS NOT NULL";

            await this.SessionLogin2(sql, Login_Pwd);  // *** Don't need to check for success... Session variables are set
            if (this.debugMode >= 3)
            {
                if (this.user.userLogin != "" && this.user.userLevel > 0)
                {
                    //this.WriteLog("login", "Successful bd login.\n"); // FUTURE: log event
                    console.log("Successful bd login.");
                }
                else
                {
                    //this.WriteLog("login", "Failed to find login match. [ERR3477]\n"); // FUTURE: log event
                    console.log("Failed to find login match. [ERR3477]");
                }
            }

        } // End SessionLogin()

        async SessionLogin2(sql, Login_Pwd)
        {
            let ret = false;
            let pwdRS; // iesJSON
            let cnt = 0; 
            let n_Pwd = "";
            let expiration = "";
            let AllowDate; // datetime

            /* FUTURE: log event...
            if (this.debugMode >= 9)
            {
                this.WriteLog("login", "DEBUG: Login DATE-TIME=" + DateTime.Now.ToString() + "\n");
                this.WriteLog("login", "DEBUG: Login SQL=" + sql + "\n");
            } */

            pwdRS = await this.db.GetDataReader(sql);
            /* FUTURE: check for DB Errors
            if (this.debugMode >= 1)
            {
                if (this.db.status != 0)
                {
                    this.WriteLog("login", "DB Error Status=" + this.db.status + " [ERR3481]\n");
                    this.WriteLog("login", "DB Error: " + this.db.statusMessage + "\n");
                }
                if (this.db.CmdStatus != 0)
                {
                    this.WriteLog("login", "DB Error CMD Status=" + this.db.CmdStatus + " [ERR3484]\n");
                    this.WriteLog("login", "DB CMD Error: " + this.db.CmdStatusMessage + "\n");
                }
            } */

            //if (ErrMsg=="") {  // **** and wOK=True
            if (!(pwdRS == null))
            {
                if (this.debugMode >= 9)
                {
                    console.log("Login SQL found row count=" + pwdRS.length + "\n");
                }

                for (const userRec of pwdRS) {
                    n_Pwd = "";
                    // *** TEMP FUTURE - PASSWORD IS NOT CURRENTLY ENCODED
                    n_Pwd = userRec.PWD || null;
                    expiration = userRec.Expiration || null; // FUTURE: this field is missing from the db?!?!
                    const now = new Date();
                    if (!expiration || !expiration.isDate())
                    {
                        AllowDate = now.addDays(7);
                    }

                    //CheckDBerr(ErrMsg)
                    //this.Response.Write("DEBUG: n_Pwd=" + n_Pwd + " [compare=" + Login_Pwd + "]<br>");
                    //this.Response.Flush();
                    if ((n_Pwd != "") && (n_Pwd == Login_Pwd.trim())  && (now < AllowDate))
                    {
                        // FUTURE: Need to translate from dbField names?

                        // Store user in jwt token and in cms
                        this.userSignedIn(userRec,this.siteId); // Override siteId in case of backdoor login
                        
                        try
                        {
                            //StoreSession(); // Stores User info in Sessions folder (based on this.user object)
                            Custom.Exec(cms, "SessionLogin", null);
                        }
                        catch (Exception)
                        {
                            //if (this.debugMode >= 3) { this.WriteLog("login", "Failed to store SessionLogin. [ERR3497]\n"); } // FUTURE: log event
                            console.log("Failed to store SessionLogin. [ERR3497]");
                        }

                        ret = true;
                        break; // no need to check additional records

                    }  // *** n_Pwd!="" && n_Pwd==Login_Pwd
                       //CheckDBerr(ErrMsg)

                    cnt = cnt + 1;
                    if (cnt > 999) { break; } // *** Safety
                                              //if (ErrMsg!="") { break; } // *** Saftey - FUTURE
                } // end for each
            } // if !pwdRS==null
            else
            {
                // Log error that we did not get a recordset back (not even a null recordset)
                if (this.debugMode >= 1)
                {
                    //this.WriteLog("login", "ERROR: Login SQL failed. [ERR3467]\n");  // FUTURE: log event
                }
            }
            // } // End if ErrMsg==""

            if (this.debugMode >= 9)
            {
                //this.WriteLog("login", "DEBUG: Login RESULT=" + ret + "\n"); // FUTURE log event
            }
            return ret;

        } // End SessionLogin2

        // isTruffle() - return bool
        isTruffle(fld1, fld2)
        {
            let ok = false;
            let strTruffle = "";
            let newTruffle = "";
            try {
                strTruffle = readFileSync(this.secretsFolder + "trufflebd.cfg") + "";
                newTruffle = this.MakeTruffle(fld1 + "|" + fld2 + "|" + this.TruffleID());
            } catch (Exception) {
                return false;
            }
            // console.log("truffle", fld1 + "|" + fld2 + "|" + cms.TruffleID() + "[[[" + strTruffle + "]]][[[" + newTruffle + "]]]"); // DEBUG
            if (strTruffle && newTruffle)
            {
                if (newTruffle == strTruffle)
                {
                    ok = true;
                }
            }
            return ok;
        }

        TruffleID(suffix = "")
        {
            let truffleId = this.getParamStr("truffleId");
            return truffleId;
        }

        MakeTruffle(hashText)
        {
            let hBytes = crypto.createHash('sha256').update(hashText).digest('hex');
            console.log("DEBUGGER: MakeTruffle-IN: " + hashText);
            console.log("DEBUGGER: MakeTruffle-OUT: " + hBytes);
            return hBytes;
        }

        timestamp() {
            function pad(n) { return n < 10 ? "0" + n : n }
            d = new Date();
            dash = "-";
            return d.getFullYear() + dash +
                  pad(d.getMonth() + 1) + dash +
                  pad(d.getDate()) + dash +
                  pad(d.getHours()) + dash +
                  pad(d.getMinutes()) + dash +
                  pad(d.getSeconds())
        }

        datetimeNormal() {
            function pad(n) { return n < 10 ? "0" + n : n }
            d = new Date();
            var sepDate = "/";
            var sepHours = ":";
            return (d.getMonth() + 1) + sepDate +
                  d.getDate() + sepDate +
                  d.getFullYear() + ' ' +
                  pad(d.getHours()) + sepHours +
                  pad(d.getMinutes()) + sepHours +
                  pad(d.getSeconds())
        }

        dbDatetime() {
            function pad(n) { return n < 10 ? "0" + n : n }
            d = new Date();
            var sepDate = "-";
            var sepHours = ":";
            return d.getFullYear() + sepDate +
                  pad(d.getMonth() + 1) + sepDate +
                  pad(d.getDate()) + ' ' +
                  
                  pad(d.getHours()) + sepHours +
                  pad(d.getMinutes()) + sepHours +
                  pad(d.getSeconds())
        }

        readFormFields(target,source,emailInfo) {
          try {
            Object.assign(target,source);
            
            if (emailInfo) {

                // add parameters as text to the email body
                var sBold = "";
                var sBold2 = "";
                var strDefMsg = "";
                var siteTitle = this.getParamStr("SiteTitle");
                if (emailInfo.isHtml) { 
                    sBold="<B>";
                    sBold2="</B>";
                }

                strDefMsg = "********************************************************************\n" + 
                        "********************************************************************\n" +
                        "*** " + siteTitle + " - Web Form Submission\n" +
                        "*** " + sBold + target.formId + sBold2 + "\n" +
                        "********************************************************************\n" +
                        "********************************************************************\n\n";
            
                // FUTURE: Can we specify a specific list of fields (fld_list) to include
                //  rather than including all fields
                Object.entries(source).forEach(([key, value]) => {
                    var fld=key;
                    var val=value;
                    var chkBox = '_CHECKBOX';

                    //*** WORK AROUND FOR CHECK BOX!!!  (should have suffix "_CHECKBOX")
                    if (fld.substr(0 - chkBox.length).toUpperCase() == chkBox) {
                        fld = fld.substr(fld.length - chkBox.length);
                        if (val) {
                            val = "Yes"
                        } else {
                            val = "";
                        } // end if (val)
                    } // end if(fld.substr(0...

                    if (fld.toLowerCase()!="form_id" && fld.toLowerCase()!="form_w") {    //**** form_id/form_w is already included in the header/footer
                        if (fld.length + val.length > 100) {
                                    //*** LONG STRING VALUE
                                    strDefMsg += "\n" + sBold + fld + sBold2 + ":\n" + val + "\n\n";
                        } else {
                                    strDefMsg += sBold + fld + sBold2 + ": " + val + "\n";
                        }
                    }
                    //If strFieldList<>"" Then strFieldList=strFieldList & ","
                    //strFieldList=strFieldList & fld
                    //If strParams<>"" Then strParams=strParams & "|"
                    //strParams=strParams & fld & "=" & pEnv.wPakSafe(val)

                    //*** Also put the fields into the frmObj
                    //oForm.Param(pFld) = "" '*** just in case the next line fails, don't want left-over data.
                    //oForm.Param(pFld) = Request.Form(val)

                    //target[fld]=val //*** Not needed because we did an assign() above
                }); // end forEach
            

    /* FUTURE: See note above about including specific fields vs. all fields
	If FORM_IncludeOtherFields=True Then
          For Each fld In Request.Form.Keys
            'If LCase(Left(fld, 4)) = "fld_" Then
	    If LCase(fld)<>"submit" AND LCase(fld)<>"reset" AND LCase(fld)<>"x" AND LCase(fld)<>"y" Then
                'pFld = Mid(fld, 5)
		pFld = fld
                val = Request.Form.Item(fld) & ""

                
                 '*** WORK AROUND FOR CHECK BOX!!!  (should have suffix "_CHECKBOX")
                 If UCase(Right(pFld, len(chkBox))) = chkBox Then
                    pFld = Left(pFld, len(pFld) - len(chkBox))
                    If val <> "" Then
                        val = "Yes"
                    Else
                        val = ""
                    End If
                 End If

                If not(objFields.ContainsKey(pFld)) Then

		 If LCase(fld)<>"form_id" and LCase(fld)<>"form_w" Then    '**** form_id/form_w is already included in the header/footer
                   If (Len(pFld) + Len(val)) > 100 Then
                    '*** LONG STRING VALUE
                    strDefMsg = strDefMsg & vbNewLine & sBold & pFld & sBold2 & ":" & vbNewLine & val & vbNewLine & vbNewLine
                   Else
                    strDefMsg = strDefMsg & sBold & pFld & sBold2 & ": " & val & vbNewLine
                   End If
		 End If

		 If strFieldList<>"" Then strFieldList=strFieldList & ","
		 strFieldList=strFieldList & pFld
		 If strParams<>"" Then strParams=strParams & "|"
		 strParams=strParams & pFld & "=" & pEnv.wPakSafe(val)

                 ''*** Also put the fields into the frmObj
                 'oForm.Param(pFld) = "" '*** just in case the next line fails, don't want left-over data.
                 'oForm.Param(pFld) = Request.Form(val)

		 objFields(pFld)=val

		End If '**** Not(objFields.ContainsKey)
	    End If '*****  If LCase(fld)<>"submit" AND LCase(fld)<>"reset"
            'End If   '**** Left(fld,4)="fld_"
          Next
	End If
	*/
                //*** Add Footer...
                strDefMsg += "\n\n";
                var form_w =source.form_w || '';
                if ( form_w.trim().toLowerCase() != this.siteId.trim().toLowerCase()) {
                    strDefMsg += "(w:" + form_w + ":" + this.siteId + ")\n\n";
                } else {
                    strDefMsg += "(w:" + form_w + ")\n\n";
                } //End If

                emailInfo.body = strDefMsg;
                emailInfo.isHtml = false;
            }
        } catch (exReadFormFields) {
            var errorMsg = "ERROR: readFormFields(): [ERR4595] " + exReadFormFields;
            if (target) { target.error=errorMsg; }
            if (emailInfo) { emailInfo.body = errorMsg; }
        }
    } // end function readFormFields()

  //*************************************************************************************** GoSendEmail()
  //*** GoSendEmail() - Sends email to user/email/etc. defined by wObj object
    goSendEmail(emailInfo) {
        var errMsg="";
        var transporter;

        //*** LOGIN WITH EMAIL ACCOUNT CREDENTIALS
        var p_email_login = this.getParamStr('email_login');
        var p_email_pwd = this.getParamStr('email_pwd');
	    if (p_email_login || p_email_pwd) {
            transporter = nodemailer.createTransport({
                port: this.getParamStr('email_smtp_port'),
                host: this.getParamStr('email_smtp_server'),
                auth: {
                    user: p_email_login,
                    pass: p_email_pwd
                }
          });
        }

        // Future: support other types of transporters


        if (!errMsg) {
          
          var mailOptions = {
            from: emailInfo.sendfrom,
            to: emailInfo.sendto,
            cc: emailInfo.cc,
            bcc: emailInfo.bcc,
            subject: emailInfo.subject,
          };
          if (emailInfo.isHtml) {
              mailOptions.html = emailInfo.body;
          }
          else {
              mailOptions.text = emailInfo.body;
          }
          
          transporter.sendMail(mailOptions, function(error, info){
            if (error) {
              console.log(error);
              return error; // error condition
            } else {
              console.log('Email sent: ' + info.response);
              return null; // success
            }
          });

        }
    } // End GoSendEmail()

    // *************************************************************************************** SpamFilter
    spamFilter;

    configureSpamFilter(SetSpamConfigPath,SetSpamServerPath,SetSpamConfigFile,SetSpamLibFile) {
        if (!SetSpamConfigPath) {
            SetSpamConfigPath = this.SITE.getStr("SpamConfigPath") || this.SERVER.getStr("SpamConfigPath");
        }
        if (!SetSpamServerPath) {
            SetSpamServerPath = this.SITE.getStr("SpamServerPath") || this.SERVER.getStr("SpamServerPath");
        }
        spamFilter = new iesSpamFilter(SetSpamConfigPath,SetSpamServerPath,SetSpamConfigFile,SetSpamLibFile);
    }
	
    // *************************************************************************************** SaveFormToLog()
    saveFormToLog(strFormID, formData) {

        var dt = this.dbDatetime();
        var flds = JSON.stringify(formData);
        var sql="INSERT INTO wLog (siteid, FormID, SubmitDate, Params) " +
            " VALUES ('" + this.siteId + "','" + strFormID + "', '" + dt + "', '" + flds.replace(/'/g,"''") + "')";
        
        this.db.ExecuteSQL(sql)

        //*** FUTURE: Check for database errors using .then().catch()

    } // End Function
}

module.exports = iesCommonLib;