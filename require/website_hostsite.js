const iesJSON = require('./iesJSON/iesJsonClass.js');
const iesCommonLib = require('./iesCommon.js');
const iesCommon = new iesCommonLib();

const { existsSync, readFileSync } = require('fs');
const _siteID = 'hostsite';
var assignedSiteID = '';

class webEngine {

    constructor(thisSiteID) {
        assignedSiteID = thisSiteID;
    	}
        

    static invalidSiteID(cms) {
        if (assignedSiteID != _siteID) {
            cms.err = 517;
            cms.errMessage = 'ERROR: webEngine missmatch: ' + assignedSiteID + ' != ' + _siteID;
            return true;
        }
        return false;

    }

    CreateHtml(cms) {
        var fileType = '';
        let pageHead = new iesJSON();
        var pageErr = -1;
        var fileFullPath;
        var pageTemplate;
        var templatePath;

       // if (this.invalidSiteID(cms)) { return; }
        cms.Html = "hostsite HTML<br>";
        let filePath = cms.url.pathname.replace(/\\/g,'/');
        if (filePath && filePath.substr(0,1) == '/') { filePath = filePath.slice(1); }
        if (cms.pathExt == '' || cms.pathExt == '.htm' || cms.pathExt == '.html') {
            fileType = 'html';
            filePath = filePath.replace(/\//g,'_');
        }
        // debugger
        cms.Html += 'File:[' + filePath + '][' + cms.pathExt + ']<br>';

        // FUTURE: Determine if path is located in root (shared common folders) or in Websites/<siteid>
        
        if (fileType=='html') {
            fileFullPath = iesCommon.FindFileInFolders(filePath + '.cfg',
                './websites/' + cms.siteID + '/pages/',
                './cmsCommon/pages/'
                );
                /*
            cms.Html += 'looking for: ' + fileFullPath + '<br>'; // debugger
            if (!existsSync(fileFullPath)) {
                fileFullPath = './cmsCommon' + filePath + '.cfg';
                cms.Html += 'looking for: ' + fileFullPath + '<br>'; // debugger
                if (!existsSync(fileFullPath)) {
                    // We didn't find the file - time to call it quits
                    cms.Html += 'file not found.<br>';
                    return;
                }
            }
            */
            if (!fileFullPath) {
                // We didn't find the file - time to call it quits
                cms.Html += 'file not found.<br>';
                return;
            }

            var contentHtml = readFileSync(fileFullPath, 'utf8');
            // look for [[{ header }]]
            var p1 = contentHtml.indexOf('[[{');
            if (p1 >=0) {
                var p2 = contentHtml.indexOf('}]]');
                if (p2>p1) {
                    cms.Html += 'w/ header<br>';
                    var headJson = contentHtml.substring(p1+2,p2+1);
                    cms.Html += headJson + '<br>';
                    pageHead.DeserializeFlex(headJson);
                    if (pageHead.Status ==0 && pageHead.jsonType=='object') {
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
            pageTemplate="layout_" + pageHead.getStr("Template") + ".cfg";
            templatePath = iesCommon.FindFileInFolders(pageTemplate,
                './websites/' + cms.siteID + '/templates/',
                './cmsCommon/templates/'
                );
            if (!templatePath) {
                cms.Html += "ERROR: Template not found: " + pageTemplate + "<br>";
                return;
            }
            cms.Html += "Template found: " + templatePath + "<br>";

        } else {
            cms.Html += 'get non-html file<br>';
            return;
        }
        return;
    }

    static CustomTags(tag,content) {
        switch (tag.toLowerCase()) {
            case "tag1":
                content = "tag1_content";
                break;
        }
    }
}

module.exports = webEngine;