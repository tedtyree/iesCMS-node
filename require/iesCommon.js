const { existsSync, readFileSync } = require('fs');
class iesCommonLib {

    constructor() { }

    AdminTags(tag,content) {
        switch (tag.toLowerCase()) {
            case "tagz":
                content = "tagz_content";
                break;
        }
    }

   /*
    // **************** ReplaceTags()
    ReplaceTags(string inputString, iesCommonLib.cmsCommon Admin, iesCommonLib.cmsCustom Custom, cmsInfo cms, int lvl = 0)
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
                charPosition = inputString.IndexOf("[[", beginning);
                if (charPosition != -1)
                {
                    startPos = charPosition;
                    endPos = inputString.IndexOf("]]", startPos); // what to do if closing ]] is not found
                    string words = "";
                    if (endPos >= 0)
                    {
                        words = inputString.Substring(startPos + 2, (endPos - startPos) - 2);
                    }
                    else
                    {
                        words = inputString.Substring(startPos + 2);
                    }

                    string replacement = "";
                    if ((Util.Left(words, 1) == "+") || (endPos == -1))
                    {
                        //[[+...]] the plus sign indicates that we should pass this tag through un-processed
                        // And if we didn't find ]] then we pass through un-processed
                        replacement = "[[" + words.Substring(1);
                        if (endPos >= 0) { replacement += "]]"; }
                        else { endPos = inputString.Length - 1; }
                    }
                    else
                    {
                        // Let's split for parameters
                        //cms.Response.Write("debug: |" + words + "| <br>");
                        string[] possiblePieces = Util.SplitTags(words);
                        //cms.Response.Write("debug: |" + String.Join("|",possiblePieces) + "| <br>");

                        cmsReturn ret = new cmsReturn();

                        switch (possiblePieces.Length)
                        {
                            case 5:
                            case 6:
                            case 7:
                            case 8:
                            case 9:
                                ret.Tag = possiblePieces[0].ToLower();
                                ret.Param1 = possiblePieces[1];
                                ret.Param2 = possiblePieces[2];
                                ret.Param3 = possiblePieces[3];
                                ret.Param4 = possiblePieces[4];
                                break;
                            case 4:
                                ret.Tag = possiblePieces[0].ToLower();
                                ret.Param1 = possiblePieces[1];
                                ret.Param2 = possiblePieces[2];
                                ret.Param3 = possiblePieces[3];
                                ret.Param4 = "";
                                break;
                            case 3:
                                ret.Tag = possiblePieces[0].ToLower();
                                ret.Param1 = possiblePieces[1];
                                ret.Param2 = possiblePieces[2];
                                ret.Param3 = "";
                                ret.Param4 = "";
                                break;
                            case 2:
                                ret.Tag = possiblePieces[0].ToLower();
                                ret.Param1 = possiblePieces[1];
                                ret.Param2 = "";
                                ret.Param3 = "";
                                ret.Param4 = "";
                                break;
                            default:
                                ret.Tag = possiblePieces[0].ToLower();
                                ret.Param1 = "";
                                ret.Param2 = "";
                                ret.Param3 = "";
                                ret.Param4 = "";
                                break;
                        }

                        // First check to see if Custom tag definitions will replace this Tag...
                        ret.Processed = false;
                        ret.AllowRecursiveCall = true;
                        Custom.CustomTags(ret, Admin);

                        if (ret.Processed == false)
                        {
                            // Tag not processed, let's try the admin level to replace this tag...
                            Admin.AdminTags(ret);
                        }

                        // Check if our replacement string has [[tags]] that need to be replaced
                        replacement = ret.ReturnContent;
                        if (ret.AllowRecursiveCall == true)
                        {
                            int pt = replacement.IndexOf("[[");
                            if (pt >= 0)
                            {
                                // Recursive call to replace [[tags]]
                                string replace2 = ReplaceTags(replacement, Admin, Custom, cms, lvl);
                                replacement = replace2;
                            }
                        }
                    } // END if (Util.Left(words,1)=="+")

                    data.Append(inputString.Substring(beginning, (startPos - beginning)));
                    data.Append(replacement);
                    beginning = endPos + 2;
                }
            } while (charPosition != -1);

            if (beginning < (inputString.Length))
            {
                data.Append(inputString.Substring(beginning));
            }

            return data.ToString();
        } // END ReplaceTags
*/

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
    }

}

module.exports = iesCommonLib;