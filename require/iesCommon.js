const StringBuilder = require("string-builder");
const { existsSync, readFileSync } = require('fs');
const iesJSON = require('./iesJSON/iesJsonClass.js');
const { connect } = require("http2");
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

    constructor() { }

    AdminTags(ret,Custom,cms) {
        var content = new StringBuilder();
        ret.Processed=true;
        switch (ret.Tag.toLowerCase()) {
            case "js":
            case "javascript":
                // *** Include the main javascript file or link (or multiple if needed)
                // *** NOTE: Including the js directly is done so that we can replace [[Tags]] - otherwise use a <script> tag in the html for efficiency.
                content.append(this.ReadJavascript(ret.Param1,cms));
                break;
            case "menu":
                // Add a menu template
                // Leave ret.Processed=true - Even if the below fails, we do not want this parameter to fall through to another layer because we matched the tag.
                let MenuName = ret.Param1.trim();
                if (MenuName == "") { MenuName = this.getParamStr(cms,"DefaultMenu","main"); }
                //content.append("<!-- DEBUGGER MenuName=" + MenuName + ", TemplateFolder=" + this.getParamStr(cms,"TemplateFolder") + " -->");
                // Look for menu in the template folders: local then server
                try
                {
                    const menuPath = this.FindFileInFolders("menu_" + MenuName + ".cfg", this.getParamStr(cms,"TemplateFolder"), this.getParamStr(cms,"CommonTemplateFolder"));
                    //content.append("<!-- DEBUGGER menuPath=" + menuPath + " -->");
                    const webBlock = this.LoadHtmlFile(menuPath, null, "", cms.userLevel);
                    content.append(webBlock.content + ''); // Not much error checking - it either works or doesn't
                }
                catch { }
                break;
            //case "pageid": // this is handled by cms.HEADER

            case "tagz":
                ret.ReturnContent = "tagz_content";
                break;
            case "track":
                try {
                    let trackFile = (ret.Param1||"track") + ".cfg"
                    let trackPath = this.FindFileInFolders(trackFile, this.getParamStr(cms,"TemplateFolder"), this.getParamStr(cms,"BaseFolder"));
                    const trackBlock = this.LoadHtmlFile(trackPath, null, "", cms.userLevel);
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
                content.append(cms.siteID);
                break;
            case "who_am_i":
                if (cms.userLevel > 0) {
                    content.append(cms.user.username + " [id=" + cms.userId + ",level=" + cms.userLevel + ",site=" + cms.user.siteid + "]");
                } else {
                    content.append("User not logged in.");
                }
                break;
            default:
                let vv = this.getParamStr(cms,ret.Tag,null,true,true);
                if (vv === null) {
                    ret.Processed = false;
                } else {
                    content.append(vv);
                }
                break;
        }
        ret.ReturnContent += content.toString();
    }


    // **************** ReplaceTags()
    ReplaceTags(inputString, header, content, Custom, cms, lvl = 0)
    {
        var charPosition = 0;
        var beginning = 0;
        var startPos = 0;
        var endPos = 0;
        var data = new StringBuilder();
   
            // Safety - keep from causing an infinite loop.
            if (lvl++ > 99) { return inputString; }

            do
            {
                // Let's look for our tags to replace
                charPosition = inputString.indexOf("[[", beginning);
                if (charPosition != -1)
                {
                    startPos = charPosition;
                    endPos = inputString.indexOf("]]", startPos); // what to do if closing ]] is not found
                    var words = "";
                    if (endPos >= 0)
                    {
                        words = inputString.substring(startPos + 2, endPos);
                    }
                    else
                    {
                        words = inputString.substring(startPos + 2);
                    }

                    var replacement = "";
                    if ((words.slice(0,1) == "+") || (endPos == -1))
                    {
                        //[[+...]] the plus sign indicates that we should pass this tag through un-processed
                        // And if we didn't find ]] then we pass through un-processed
                        replacement = "[[" + words.slice(0,1);
                        if (endPos >= 0) { replacement += "]]"; }
                        else { endPos = inputString.length - 1; }
                    }
                    else
                    {
                        // Let's split for parameters
                        //cms.Response.Write("debug: |" + words + "| <br>");
                        var possiblePieces = this.SplitTags(words);
                        //cms.Response.Write("debug: |" + String.Join("|",possiblePieces) + "| <br>");

                        var ret = {};

                        switch (possiblePieces.length)
                        {
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
                        if(ret.Processed == false && Custom && Custom.CustomTags) {
                            Custom.CustomTags(ret, cms);
                        }

                        if (ret.Processed == false)
                        {
                            // Tag not processed, let's try the admin level to replace this tag...
                            this.AdminTags(ret, Custom, cms);
                        }

                        // Check if our replacement string has [[tags]] that need to be replaced
                        replacement = ret.ReturnContent;
                        if (ret.AllowRecursiveCall == true)
                        {
                            var pt = replacement.indexOf("[[");
                            if (pt >= 0)
                            {
                                // Recursive call to replace [[tags]]
                                var replace2 = this.ReplaceTags(replacement, header, content, Custom, cms, lvl);
                                replacement = replace2;
                            }
                        }
                    } // END if (Util.Left(words,1)=="+")

                    data.append(inputString.substring(beginning, startPos));
                    data.append(replacement);
                    beginning = endPos + 2;
                }
            } while (charPosition != -1);

            if (beginning < (inputString.length))
            {
                data.append(inputString.substring(beginning));
            }

            return data.toString();
        } // END ReplaceTags

        /* ******************************************** SUPPORT ROUTINES *********************************** */

        SplitTags(inputString)
        {
            try
            {
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
                for (var i = 0; i < inputString.length; i++)
                {
                    addToSeg = true;
                    var ii = inputString.slice(i,i+1);
                    if (inQuote == false)
                    {
                        if (sepType == ' ' && (ii == ':' || ii == '|'))
                        {
                            sepType = ii;

                        }
                        if (ii == sepType)
                        {
                            result.push(segment);
                            segment = "";
                            addToSeg = false;
                        }
                        if (ii == '\'' || ii == '"')
                        {
                            inQuote = true;
                            quoteType = ii;
                            addToSeg = false;
                        }
                    }
                    else if (inQuote == true)
                    {
                        if (afterBackSlash == true)
                        {
                            afterBackSlash = false;
                        }
                        else if (ii == '\\')
                        {
                            addToSeg = false;
                            afterBackSlash = true;
                        }
                        else if (ii == quoteType)
                        {
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


    FindFileInFolders(fileName,Path1,Path2,Path3,Path4) {
        var regexCmd = /\\/g;
        if (Path1) { Path1 = Path1.replace(regexCmd,'/'); }

        var fileFullPath = Path1 + (Path1.slice(-1) == '/'?'':'/') + fileName;
        if (existsSync(fileFullPath)) { return fileFullPath; }
        if (Path2) {
            Path2 = Path2.replace(regexCmd,'/');
            fileFullPath = Path2 + (Path2.slice(-1) == '/'?'':'/') + fileName;
            if (existsSync(fileFullPath)) { return fileFullPath; }
        }
        if(Path3) {
            Path3 = Path3.replace(regexCmd,'/');
            fileFullPath = Path3 + (Path3.slice(-1) == '/'?'':'/') + fileName;
            if (existsSync(fileFullPath)) { return fileFullPath; }
        }
        if(Path4) {
            Path4 = Path4.replace(regexCmd,'/');
            fileFullPath = Path4 + (Path4.slice(-1) == '/'?'':'/') + fileName;
            if (existsSync(fileFullPath)) { return fileFullPath; }
        }
        return null; // file not found
    }

    ReadJavascript(subTag, cms)
    {
        // *** This script finds the specified .js file and returns its content
        // *** (to be included in the HTML response stream)
        // *** .js file may be in the Template Folder or the Root folder.
        let ret = "";
        let strFile = subTag;
        if (strFile.trim() == "") { strFile = this.getParamStr(cms,"Default_JS","main"); }  //FUTURE: Put "main" as a parameter Default_JS in config file
        strFile = strFile + ".js";

        let folders = [
            this.getParamStr(cms,"sourceFolder",""),
            this.getParamStr(cms,"baseFolder",""), // WorldFolder
        ];

        ret = this.ReadFileFrom(strFile, folders);

        if (ret != "")
        {
            ret = "<SCRIPT type=\"text/javascript\" LANGUAGE=\"JavaScript\">\n" +
                "<!" + "--\n" + ret + "// --" + ">\n" + "<" + "/SCRIPT>\n";
        }

        return ret;

    } // End Function

    getParamStr(cms,tagId,defaultValue,tagReplace = true,findInHeader = true) {
        let v="";
        // first we look in cms.HEADER then cms.SITE
        if (findInHeader && cms.HEADER && cms.HEADER.contains(tagId)) {
            v = cms.HEADER.getStr(tagId);
        }
        else if (cms.SITE && cms.SITE.contains(tagId)) {
            v = cms.SITE.getStr(tagId);
        }
        else if (cms.SERVER && cms.SERVER.contains(tagId)) {
            v = cms.SERVER.getStr(tagId);
        }
        else { v = defaultValue; }
        if (typeof v === 'string') { 
            if (findInHeader && cms.HEADER) {
                v = this.tagReplaceString(v, cms.HEADER, cms.SITE, cms.SERVER); 
            } else {
                v = this.tagReplaceString(v, cms.SITE, cms.SERVER); 
            }
        }
        return v;
    }

    // **************** tagReplaceString()
    tagReplaceString(inputString, cfg1, cfg2, cfg3, cfg4, lvl = 0)
    {
        var charPosition = 0;
        var beginning = 0;
        var startPos = 0;
        var endPos = 0;
        var data = new StringBuilder();
   
        // Safety - keep from causing an infinite loop.
        if (lvl++ > 99) { return inputString; }

            do
            {
                // Let's look for our tags to replace
                charPosition = inputString.indexOf("[[", beginning);
                if (charPosition != -1)
                {
                    startPos = charPosition;
                    endPos = inputString.indexOf("]]", startPos); // what to do if closing ]] is not found
                    
                    var word = "";
                    if (endPos >= 0)
                    {
                        word = inputString.substring(startPos + 2, endPos);
                    }
                    else
                    {
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
                        if (pt >= 0)
                        {
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

            if (beginning < (inputString.length))
            {
                data.append(inputString.substring(beginning));
            }

            return data.toString();
        } // END tagReplaceString

        // Look for a text file in a list of folders and load the first one that exists
        ReadFileFrom(sFileName, Folders)
        {
            let sPath='';
            for (const nextFolder of Folders) {
                let strFolder = (nextFolder + '').trim();
                if (strFolder) {
                    sPath = strFolder.replace(/\\/g,'/');
                    if (sPath.slice(-1) != '/') { sPath += '/'; }
                    sPath += sFileName;
                    if (existsSync(sPath))
                    {
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
        LoadHtmlFile(cfgFilePath, htmlFile, ContentField = "content_area", UserViewLevel = -1)
        {
            let status = -9; // default status = 'failed'
            let errMsg = "";
            let jsonHeader = new iesJSON("{}");
            let fileContent = "";
            let start = 0;
            let end = 0;
            let foundHeader = false;
            try
            {
                if (cfgFilePath.trim() != '')
                {
                    if (existsSync(cfgFilePath))
                    {
                        fileContent = readFileSync(cfgFilePath,'utf8').toString();  //Read the file
                    }
                }
            }
            catch (Exception) { }

            if (fileContent.trim() != '')
            {

                if (fileContent.indexOf("[[{") >= 0)
                {
                    start = fileContent.indexOf("[[{") + 2;
                    end = fileContent.indexOf("}]]") - 1;
                    foundHeader = true; 

                    let jSON = fileContent.substring(start, end);

                    let pageJsonOK = false;
                    if (jSON)
                    {
                        try
                        {
                            jsonHeader.DeserializeFlex(jSON);
                              // Future: check for errors?
                            if (jsonHeader.Status ==0 && jsonHeader.jsonType=='object') {
                                pageJsonOK = true;
                            } else {
                                errMsg = errMsg + "Error: Failed to parse HTML file JSON header. [ERR-8668]";
                                status = -2;
                            }
                            
                        }
                        catch (Exception)
                        {
                            //Unable to find it...Let's just move on?
                            // Below we will create an empty Header object
                            errMsg = errMsg + "JSON Header missing or corrupt: " + cfgFilePath + " [ERR-8669]";
                            status = -3;
                        }
                    }
                } // End if (fileContent.IndexOf("[[{")

                //Let's remove the json header from the content
                if (fileContent.trim() != '' && end > 0)
                {
                    fileContent = fileContent.splice(end+3);
                }
                if ((UserViewLevel >= 0) && (foundHeader == true))
                {
                    if (UserViewLevel < htmlFile.getInt("MinViewLevel",999))
                    {
                        // User does not have permission to view this content
                        fileContent = "";
                        errMsg = "Insufficient permission to view content. [ERR-27931]";
                        status = -1;  // Not sure that this is really an 'error', but flag it as such
                    }
                }
                if (ContentField.trim() != '')
                {
                    htmlFile.AddToObjBase(ContentField, fileContent);
                }
                if (errMsg == "") { status = 0; }
            } // End if (!String.IsNullOrEmpty(fileContent))
            else
            {
                // Failed to get page content.
                errMsg = errMsg + "Failed to load page content: " + cfgFilePath + " [ERR-6891]";
                status = -4;
            }
            return {content:fileContent, jsonHeader, foundHeader, status, errMsg};
        }

}

module.exports = iesCommonLib;