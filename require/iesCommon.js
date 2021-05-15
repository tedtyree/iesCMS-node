const StringBuilder = require("string-builder");
const { existsSync, readFileSync } = require('fs');
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

    AdminTags(ret,content) {
        ret.Processed=true;
        switch (ret.Tag.toLowerCase()) {
            case "tagz":
                ret.ReturnContent = "tagz_content";
                break;
            case "js":
                ret.ReturnContent = "<b>THIS-IS-JS</b>";
                break;
            default:
                ret.Processed = false;
                break;
        }
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
                        else { endPos = inputString.Length - 1; }
                    }
                    else
                    {
                        // Let's split for parameters
                        //cms.Response.Write("debug: |" + words + "| <br>");
                        var possiblePieces = this.SplitTags(words);
                        //cms.Response.Write("debug: |" + String.Join("|",possiblePieces) + "| <br>");

                        var ret = {};

                        switch (possiblePieces.Length)
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
                            Custom.CustomTags(ret, this);
                        }

                        if (ret.Processed == false)
                        {
                            // Tag not processed, let's try the admin level to replace this tag...
                            this.AdminTags(ret);
                        }

                        // Check if our replacement string has [[tags]] that need to be replaced
                        replacement = ret.ReturnContent;
                        if (ret.AllowRecursiveCall == true)
                        {
                            var pt = replacement.indexOf("[[");
                            if (pt >= 0)
                            {
                                // Recursive call to replace [[tags]]
                                var replace2 = ReplaceTags(replacement, header, content, Custom, cms, lvl);
                                replacement = replace2;
                            }
                        }
                    } // END if (Util.Left(words,1)=="+")

                    data.append(inputString.substring(beginning, startPos));
                    data.append(replacement);
                    beginning = endPos + 2;
                }
            } while (charPosition != -1);

            if (beginning < (inputString.Length))
            {
                data.Append(inputString.substring(beginning));
            }

            return data.toString();
        } // END ReplaceTags

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
        var fileFullPath = Path1 + (Path1.slice(-1) == '/'?'':'/') + fileName;
        if (existsSync(fileFullPath)) { return fileFullPath; }
        if(Path2) {
            fileFullPath = Path2 + (Path2.slice(-1) == '/'?'':'/') + fileName;
            if (existsSync(fileFullPath)) { return fileFullPath; }
        }
        if(Path3) {
            fileFullPath = Path3 + (Path3.slice(-1) == '/'?'':'/') + fileName;
            if (existsSync(fileFullPath)) { return fileFullPath; }
        }
        if(Path4) {
            fileFullPath = Path4 + (Path4.slice(-1) == '/'?'':'/') + fileName;
            if (existsSync(fileFullPath)) { return fileFullPath; }
        }
        return null; // file not found
    }

}

module.exports = iesCommonLib;