const StringBuilder = require("string-builder");
const iesJSON = require('./iesJSON/iesJsonClass.js');
const iesCommonLib = require('./iesCommon.js');
const iesCommon = new iesCommonLib();

const { existsSync, readFileSync } = require('fs');
const _siteID = 'kenyaheart';
var assignedSiteID = '';

class webEngine {

    constructor(thisSiteID) {
        assignedSiteID = thisSiteID;
    }

    invalidSiteID(cms) {
        if (assignedSiteID != _siteID) {
            cms.err = 517;
            cms.errMessage = 'ERROR: webEngine missmatch: ' + assignedSiteID + ' != ' + _siteID;
            return true;
        }
        return false;
    }

    CustomTags(ret, cms) {
        var content = new StringBuilder();
        ret.Processed = true;
        switch (ret.Tag.toLowerCase()) {
            case "tag1":
                ret.ReturnContent = "tag1_content";
                break;
            case "tag2":
                content.append("tag2_content");
                break;
            case "lang":
                this.ProcessLangTag(ret.Param1, content, cms);
                break;
            default:
                ret.Processed = false;
                break;
        }
        ret.ReturnContent += content.toString();
    }

    CreateHtml(cms) {
        var fileType = '';
        let pageHead = new iesJSON();
        var pageErr = -1;
        var pageTemplate;
        var templatePath;

        if (this.invalidSiteID(cms)) { return; }
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
                return;
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
                return;
            }
            // Lookup page template
            pageTemplate = "layout_" + pageHead.getStr("Template") + ".cfg";
            templatePath = iesCommon.FindFileInFolders(pageTemplate,
                './websites/' + cms.siteID + '/templates/',
                './cmsCommon/templates/'
            );
            if (!templatePath) {
                cms.Html += "ERROR: Template not found: " + pageTemplate + "<br>";
                return;
            }
            //cms.Html += "Template found: " + templatePath + "<br>";
            var template = readFileSync(templatePath, 'utf8');
            cms.Html = iesCommon.ReplaceTags(template, pageHead, contentHtml, this, cms);

        } else {
            // NON-HTML RESOURCES
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
            return;
        }
        return;
    }

    /**
     *  Add the language switcher 
     */

    ProcessLangTag(langText, Content, cms) {

        let langPieces = {};
        let textPieces = langText.split("@@");

        for (const piece of textPieces) {

            let firstWord = this.GetFirstWord(piece).trim();
            let remainder = piece.substring(firstWord.length).trim();
            // Content.Append("|||DEBUGGER:piece=[" + piece + "],firstword=[" + firstWord + "],remainder=[" + remainder + "]|||");
            if (firstWord == "") { firstWord = "default"; }
            if (remainder != "") { langPieces[firstWord] = remainder; }
        }

        // Use the list of languages for this PAGE (ie. in HEADER) first... and only for the SITE if not found for PAGE
        let languages = new iesJSON("{}");
        if (cms.HEADER.Contains("languages")) {

            for (const lng of cms.HEADER["languages"].ToStr().split(",")) {
                let l = lng.trim();
                if (l != "") { languages[l].Value = l; }
            }

        } else {
            languages = cms.SITE.config["Languages"];
        }
        // int cnt=0;
        for (const lang of languages) {
            if (cnt > 0) { Content.Append("<span class='lang-none'> / </span>"); }
            let k1 = lang.Key.trim();
            let v1 = "";
            if (langPieces[k1]) {
                v1 = langPieces[k1].trim();
            } else {
                v1 = langPieces["default"].trim();
            }
            Content.Append("<span class='lang-" + k1 + "'>" + v1 + "</span>");
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

}

module.exports = webEngine;