//iesCommonLib
// NOTE: This library/class is used to create the cms object.  Therefore all methods are accessible through the cms object
const StringBuilder = require("string-builder");
const { existsSync, readFileSync, appendFileSync, fstat } = require('fs');
const FlexJson = require('./FlexJson/FlexJsonClass.js');
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
                        for (const tblRec of tblRS) { // foreach, however should only be 1 row
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
                    for (const tblRec2 of tblRS2) { // foreach, however should only be 1 row
                        content.append(JSON.stringify(tblRec2) + '\n');
                    }
                }
                this.db.debugMode = 0; // TEMP DEBUG FUTURE REMOVE THIS
                break;
            case "dbshowtables":
                this.db.debugMode = 9; // TEMP DEBUG FUTURE REMOVE THIS
                let tblRS3 = await this.db.GetDataReader('SHOW TABLES');
                if (!(tblRS3 == null)) {
                    for (const tblRec3 of tblRS3) { // foreach, however should only be 1 row
                        content.append(JSON.stringify(tblRec3) + '\n');
                    }
                }
                this.db.debugMode = 0; // TEMP DEBUG FUTURE REMOVE THIS
                break;
			case "debugmode":
				content.append(this.debugMode);
				break;
				
			case "logfile":
				content.append(this.logFile);
				break;

                /*** from original cmsCommon.cs (DotNet version of CMS)
                case "brand":
                    case "brandid":
                        string b = cms.SITE.BrandID;
                        if (String.IsNullOrEmpty(b)) { b = cms.SERVER.BrandID; }
                        Content.Append(b);
                        break;

                    case "expirepage":
                        // FUTURE: Put this back - DEBUG TTyree 1/2019
                        //cms.Response.Cache.SetExpires(DateTime.Now.AddSeconds(1));
                        //cms.Response.Cache.SetCacheability(HttpCacheability.Public);
                        //cms.Response.Cache.SetValidUntilExpires(true);
                        //cms.Response.Expires = -1;
                        break;


                    case "logged_in":
                        // *** Display User Logged-In info
                        if (UserLoggedIn())
                        {
                            Content.Append("<span class='user'>User: " + cms.UserName + "&nbsp;&nbsp;</span><a href='" + cms.SITE.LOGIN_Page + "?logout=true' class='logout'>Logout</a>");
                        }
                        else
                        {
                            Content.Append("<a href='" + cms.SITE.LOGIN_Page + "?logout=true' class='login'>Login</a>");
                        }
                        break;
                    case "username":
                        Content.Append(cms.UserName);
                        break;
                    case "userobjid":
                        Content.Append(cms.UserObjID);
                        break;
                    case "sessionid":
                        Content.Append(cms.Session.Id);
                        break;
                    case "menu":
                        // Leave ret.Processed=true - Even if the below fails, we do not want this parameter to fall through to another layer because we matched the tag.
                        string MenuName = ret.Param1.Trim();
                        if (MenuName == "") { MenuName = cms.SITE.DefaultMenu; }
                        if (MenuName == "") { MenuName = "main"; }
                        // Look for menu in the template folders: local then server
                        try
                        {
                            FlexJson menuHeader = null;
                            int menuStatus = -99;
                            string menuErr = "";
                            string menuPath = Util.FindFile("menu_" + MenuName + ".cfg", cms.SITE.TemplateFolder, cms.SERVER.TemplateFolder);
                            string webBlock = Util.LoadHtmlFile(menuPath, out menuHeader, out menuStatus, out menuErr, "", cms.user.userLevel);
                            Content.Append(webBlock); // Not much error checking - it either works or doesn't
                        }
                        catch { }
                        break;

                    case "wikipage": // wiki page link
                    case "page":
                    case "p":
                        // First version of wiki - param1=pageid, param2 (optional)=alias text for link
                        string param1 = ret.Param1.Trim();
                        string param2 = ret.Param2.Trim();
                        string href1 = "#";
                        if (param2 == "") { param2 = param1; }
                        if (param1 != "")
                        {
                            href1 = param1.Replace(" ", "-"); // FUTURE: modify this to include actual wiki name.
                        }
                        Content.Append("<a href='" + href1 + "'>" + param2 + "</a>");
                        break;

                    case "wikilink":
                    case "link":
                    case "l":
                        // First version of wiki - param1=URL, param2 (optional)=alias text for link
                        string prm1 = ret.Param1.Trim();
                        string prm2 = ret.Param2.Trim();
                        if (prm2 == "") { prm2 = prm1; }
                        if (prm1 == "") { prm1 = "#"; prm2 = "#"; }
                        //FUTURE: way to specify 'do not open in new window'
                        Content.Append("<a target='_blank' href='" + prm1 + "'>" + prm2 + "</a>");
                        break;

                    case "pageid":
                        Content.Append(cms.PageID);
                        break;

                    case "domain":
                        Content.Append(cms.SITE.Domain);
                        break;

                    case "sitetitle":
                        Content.Append(cms.SITE.config["SiteTitle"].ToStr().Trim());
                        break;

                    case "title": // Title straight from page header
                        Content.Append(cms.wiki["Header"]["Title"].ToStr().Trim());
                        break;

                    // *** NOTE: USE 'title' FOR TEXT VERSION OF PAGE TITLE
                    case "page_title":
                    case "page_title_tag":
                        // Page_Title can either be specified by the WikiPage in the header,
                        // or specified in the default.config file.  The header parameter overrides.
                        string GenerateTag = "";
                        GenerateTag = cms.wiki["Header"]["Page_Title"].ToStr().Trim();
                        if (this.isNullOrWhiteSpace(GenerateTag))
                        {
                            GenerateTag = cms.SITE.config["Page_Title"].ToStr().Trim();
                        }
                        if (!this.isNullOrWhiteSpace(GenerateTag) && ret.Tag == "page_title_tag")
                        {
                            GenerateTag = "<title>" + GenerateTag + "</title>";
                        }
                        Content.Append(GenerateTag);
                        break;

                    case "description":
                    case "page_description":
                    case "description_tag":
                        // Get from <<<Page Parameters?>>>
                        string GenTag2 = "";
                        GenTag2 = cms.wiki["Header"]["Page_Description"].ToStr().Trim();
                        if (!this.isNullOrWhiteSpace(GenTag2) && ret.Tag == "description_tag")
                        {
                            GenTag2 = "<meta name=\"Description\" content=\"" + GenTag2 + "\">";
                        }
                        Content.Append(GenTag2);
                        break;

                    case "keywords":
                    case "page_keywords":
                    case "keywords_tag":
                        string GenTag3 = "";
                        GenTag3 = cms.wiki["Header"]["Page_Keywords"].ToStr().Trim();
                        if (!this.isNullOrWhiteSpace(GenTag3) && ret.Tag == "keywords_tag")
                        {
                            GenTag3 = "<meta name=\"Keywords\" content=\"" + GenTag3 + "\">";
                        }
                        Content.Append(GenTag3);
                        break;

                    case "debug_message":
                        // Add any debug messages that you would like to display
                        // at the bottom of the page (or where the [[debug_message]] tag is located)
                        // NOTE: Tag must be added to the template first

                        //Content.Append("<br>DEBUG: SessionID: " + cms.Session.Id + "<br>");
                        break;

                    case "forwardto":
                        string fwdto = ret.Param1;
                        if (ret.Param2.Trim() != "")
                        {
                            fwdto += ":" + ret.Param2;
                        }
                        // DEBUG: FUTURE: FIX - put redirect back! TTyree 1/2019
                        //Response.Redirect(fwdto);
                        break;
                    case "siteparameter":
                        string jParam = cms.SITE.config[ret.Param1].ToStr();
                        if (this.isNullOrWhiteSpace(jParam))
                        {
                            jParam = cms.SITE.config[ret.Param1].jsonString;
                        }
                        Content.Append(jParam);
                        break;
                    case "serverparameter":
                        Content.Append(cms.SERVER.config[ret.Param1].ToStr());
                        break;
                    case "formparam":
                    case "formparameter":
                        content.append(cms.FormParam(ret.Param1.Trim()));
                        break;

                    case "urlparam":
                        content.append(cms.urlParam(ret.Param1.Trim()));
                        break;

                    case "formorurlparam":
                        content.append(cms.FormOrUrlParam(ret.Param1.Trim()));
                        break;

                    case "subpage":
                        // Leave ret.Processed=true - Even if below fails, we matched tag...
                        // FUTURE: Handle ability to read Wiki objects here, too (currently, subpage must be a file)
                        // NOTE: 3rd parameter can be a flag "noE" to indicate not to display the "e" button
                        string subPage = "", subFileName;
                        string editButton = "";
                        subFileName = cms.SITE.PageFolder + "\\" + ret.Param1 + ".cfg";
                        bool noE = false;
                        if (ret.Param2.toLowerCase().IndexOf("noe") >= 0) { noE = true; }
                        //Content.Append("DEBUG: subFileName=" + subFileName + "<br>");  // DEBUG
                        if (!File.Exists(subFileName)) { subFileName = cms.SERVER.PageFolder + "\\" + cms.SITE.BrandID + "\\" + ret.Param1 + ".cfg"; }
                        if (!File.Exists(subFileName)) { subFileName = cms.SERVER.PageFolder + "\\" + ret.Param1 + ".cfg"; }
                        if (File.Exists(subFileName))
                        {
                            try
                            {
                                subPage = File.ReadAllText(subFileName);
                                // quick and dirty... remove [[{ ... }]]
                                int p = subPage.IndexOf("}]]");
                                if (p > 0)
                                {
                                    string AdminEditMode = "";
                                    try { AdminEditMode = cms.Session.GetString("AdminEditMode").toLowerCase(); } catch { }

                                    AdminEditMode = "edit"; //debug FUTURE remove this line

                                    if (AdminEditMode == "edit")
                                    {
                                        // If we are in edit mode - we need to check the MinEditSubpageLevel to determine if we should create an edit button for this subpage
                                        try
                                        {
                                            int p0 = subPage.IndexOf("[[{");
                                            if (p0 >= 0)
                                            {
                                                string subHeader = subPage.Substring(p0 + 2, p - p0 - 1);
                                                FlexJson jHead = new FlexJson(subHeader);
                                                jHead.UseFlexJson = true;
                                                jHead.Deserialize(subHeader);

                                                int MinEditSubpageLevel = jHead["MinEditLevel"].ToInt(999);
                                                string objID = (ret.Param1.Trim()); //jHead["objid"].CString().Trim();

                                                //Content.Append("here1: " + cms.user.userLevel + ":" + MinEditSubpageLevel + ", " + objID); //debug
                                                //Content.Append("here2: " + jHead.jsonString + "<br>");

                                                if (MinEditSubpageLevel < 999 && cms.user.userLevel >= MinEditSubpageLevel && objID != "" && noE == false)
                                                {
                                                    // User has edit permissions (and EDIT MODE is turned on)

                                                    editButton = File.ReadAllText(cms.SERVER.TemplateFolder + "\\admin_edit_button.cfg");
                                                    editButton = editButton.Replace("[[objID]]", objID);
                                                }
                                            }
                                        }
                                        catch { }
                                    }
                                    subPage = substr(subPage, p + 3, subPage.Length);
                                }  // NOTE: if length is longer than what is needed, substr returns entire remainder of string.
                            }
                            catch { }
                        }
                        else
                        {
                            if (cms.user.userLevel >= cms.SITE.MinEditLevel && ret.Param1 != "" && noE == false)
                            {
                                // User has edit permissions - even though this page does not exist... lets allow the admin to create it by adding an 'e' edit button
                                subPage = "&nbsp;"; // Edit button needs some text to associate with
                                editButton = File.ReadAllText(cms.SERVER.TemplateFolder + "\\admin_edit_button.cfg");
                                editButton = editButton.Replace("[[objID]]", ret.Param1);
                            }
                        }
                        Content.Append(subPage);
                        Content.Append(editButton);
                        if (ret.Param2.Trim().toLowerCase() == "notrecursive")
                        {
                            ret.AllowRecursiveCall = false;  // Do NOT replace [[tags]] recursively for this web form.
                        }
                        break;
                    case "products_html":
                        string products_html = GenerateProducts();
                        Content.Append(products_html);
                        break;

                    case "random_photo":
                        string random_photo = RandomPhoto(ret.Param1);
                        Content.Append(random_photo);
                        break;

                    case "e":
                        if (cms.user.userLevel >= cms.SITE.MinEditLevel && ret.Param1 != "")
                        {
                            // User has edit permissions - create 'e' edit button
                            string btnTxt = "&nbsp;"; // Edit button needs some text to associate with
                            btnTxt += File.ReadAllText(cms.SERVER.TemplateFolder + "\\admin_edit_button.cfg");
                            btnTxt = btnTxt.Replace("[[objID]]", ret.Param1);
                            Content.Append(btnTxt);
                        }
                        break;
                    case "track":
                        // Look for track.cfg in the template folder.
                        try
                        {
                            string filePath = cms.SITE.TemplateFolder + "\\track.cfg";
                            Content.Append(File.ReadAllText(filePath));
                        }
                        catch { }

                        break;
                    case "now":
                        // Tag to display Today's date/time
                        // example: [[now:date]]
                        string format = ret.Param2.Trim();
                        switch (ret.Param1.Trim().toLowerCase())
                        {
                            case "date":
                                if (this.isNullOrWhiteSpace(format)) { format = "MM/dd/yyyy"; }
                                Content.Append(DateTime.Now.ToString(format));
                                break;
                            case "time":
                                if (this.isNullOrWhiteSpace(format)) { format = "HH:mm:ss"; }
                                Content.Append(DateTime.Now.ToString(format));
                                break;
                            case "datetime":
                                if (this.isNullOrWhiteSpace(format)) { format = "MM/dd/yyyy HH:mm:ss"; }
                                Content.Append(DateTime.Now.ToString(format));
                                break;
                                break;
                        }
                        break;
                    
                    */
                    case "admin_block":
                            let sBlockPath = "";
                            let sName = "";
                            if (cms.user.userLevel >= cms.minAdminLevel)
                            {
                                //*** IF WE ARE LOGGED IN AND THIS PERSON HAS PRIVILEDGES... Allow edit of Wiki page.  (future, check if page is editable?!)
                                //*** Here we reference admin_main.cfg  (or if [[admin_block:alias]] specified then admin_alias.cfg)	
                                sName = ret.Param1.trim();
                                if (sName == "") { sName = "block"; }
                                sBlockPath = this.FindFileInFolders("admin_" + sName + ".cfg", this.getParamStr("TemplateFolder"), this.getParamStr("CommonTemplateFolder"));
                                if (sBlockPath)
                                {
                                    content.append(readFileSync(sBlockPath));
                                }
                            } // end if (cms.user.userLevel>= cms.minAdminLevel)
                            break;
                    
                    case "admin_edit_page":
                        let sBlockPath2 = "";
                        //int MinEditLevel=cms.wiki["header.mineditlevel"].ToInt(999);  // This is now done in default.aspx
                        //the theory is that this variable is actually not defined somehow? remove above if edit page on 215sports is fixed outside of this DSchwab 
                        if (cms.user.userLevel >= cms.minAdminLevel)
                        {
                            //Content.Append("DEBUG: UserLevel: " + cms.user.userLevel + ", MinEditLevel: " + cms.MinEditLevel + "<br>");
                            //Content.Append("DEBUG: wiki[header]=" + cms.wiki["Header"].jsonString + "<br>");
                            if (cms.user.userLevel >= cms.minEditLevel)
                            {
                                sBlockPath2 = this.FindFileInFolders("admin_edit_page.cfg", this.getParamStr("TemplateFolder"), this.getParamStr("CommonTemplateFolder"));
                                if (sBlockPath2)
                                {
                                    content.append(readFileSync(sBlockPath2));
                                }
                            }
                        } // end if (cms.user.userLevel>=SITE.MinAdminLevel)
                        break;
                    /*
                    case "admin-createpagelink":
                        // FUTURE: MOVE THIS TO AdminFunctions.cs ONCE SITE.MinCreateLevel is added to every config
                        if (cms.user.userLevel >= cms.SITE.MinCreateLevel)
                        {
                            Content.Append("<input type='button' value='CREATE PAGE' onclick='admin_open_edit_d(\"" + cms.PageID + "\",true);'><br><br>");
                        }
                        break;
                        */
                    case "admin_menulink_flag":
                        let adminMenuLink = cms.HEADER.getStr("ShowAdminMenuLink").trim();
                        if (adminMenuLink == "") { adminMenuLink = "true"; } // default=true
                        content.append(adminMenuLink);
                        break;
                    case "admin_editpage_flag":
                        // Future: only show if in edit mode and user has high enough permissions to edit the page.
                        let editFlag = "false";
                        let minedit = cms.HEADER.getNum("MinEditLevel",999);
                        if (minedit <= cms.user.userLevel) { editFlag = "true"; }
                        content.append(editFlag);
                        break;
                        /*
                    case "edit_page_link":
                        //*** This tag is to be used in the admin_block
                        //*** IF WE ARE LOGGED IN AND THIS PERSON HAS PRIVILEDGES... Allow edit of Wiki page. 	
                        //*** FUTURE: Check if page is editable
                        if (cms.user.userLevel >= cms.SITE.MinAdminLevel)
                        {
                            string EditURL = "", LinkTitle = "", tsWiki = "";
                            tsWiki = "admin-editObject.ashx?world=" + cms.siteId + "&class=Edit-MainWikiPage";

                            if (cms.wikiNotFound > 0)
                            {
                                //*** Wiki Page is missing - link to CREATE it...
                                EditURL = tsWiki + "&obj=*new*&saveas=" + cms.RequestedPage;
                                LinkTitle = "Create Page";
                            }
                            else
                            {
                                //*** Wiki Page exists - link to UPDATE it
                                EditURL = tsWiki + "&id=" + cms.wiki["objid"].CString() + "&obj=" + cms.RequestedPage;
                                LinkTitle = "Edit Page";
                            }

                            // FUTURE: check if this is a PRODUCT page
                            //if ((Product_Page<>"") && (PageID==Product_Page)) { EditURL=EditProductsURL; }

                            Content.Append("<a hRef=\"#\" onClick=\"Javascript:pup=window.open('" + EditURL + "','WObjEditor','menubar=no,status=no,width=950,height=700,toolbar=no,scrollbars=yes,location=no,directories=no,resizable=yes');pup.focus();return false;\" >" + LinkTitle + "</a>");

                        }
                        break;
                    case "admin_menu_link":
                        //*** This tag is to be used in the admin_block
                        if (cms.user.userLevel >= cms.SITE.MinAdminLevel)
                        {
                            Content.Append("<a hRef='" + cms.SITE.ADMIN_Page + ".ashx'>Admin Menu</a>");
                        }
                        break;
                    case "err_block":
                    case "error_block":
                        string errText = cms.Session.GetString("errmsg").Trim();
                        if (errText == "") { errText = cms.ErrMsg; }
                        if (errText != "")
                        {
                            Content.Append("<div class='error_block'>" + errText + "<div>");
                        }
                        break;
                    case "admin-get-editlistconfig":  // This may not be used any longer - now set as {{eclass}} tag within admin-editlist-table below
                        Content.Append(editlistconfig);
                        break;
                    case "admin-load-editconfig":
                        // This tag will load the editor config file if needed.  A response will be generated if there is an error.
                        // This tag is not mandatory, but it enables the display of a user-friendly response and it allows
                        // an override of the eclass config file name (Param1)
                        this.LoadEditListIfNeeded(ret.Param1);
                        if (editlisterror != "")
                        {
                            Content.Append("<div id='adminerror'>ERROR: " + editlisterror + "</div>");
                        }
                        break;
                    case "admin-editlist-param":
                        this.LoadEditListIfNeeded();
                        try
                        {
                            if (editlistj.Contains(ret.Param1))
                            {
                                FlexJson rParam = this.editlistj.i(ret.Param1);
                                if (rParam.jsonType == "array" || rParam.jsonType == "object") {
                                    rParam.UseFlexJson = false;
                                    rParam.InvalidateJsonString();
                                    Content.Append(rParam.jsonString);
                                } else {
                                    Content.Append(rParam.CString());
                                }
                            }
                            else
                            {
                                Content.Append(ret.Param2 + "");
                            }
                        }
                        catch (Exception) { }
                        break;
                    */
                    case "admin-editlist-table":
                        try
                        {
                            let filePath2="";
                            let tableHtml="";
                            let out = { Cols : [],
                                ColsHtml : "",
                                ColsJS : ""  // Json String
                            };
                            let rTags = new FlexJson("{}");
                            let err = false;

                            // Look for editlist table HTML config file in the SERVER src folder.
                            try
                            {
                                filePath2 = this.FindFileInFolders("admin-editlist-table.cfg", this.getParamStr("SourceFolder"), this.getParamStr("CommonSourceFolder"));
                                if (filePath2) {
                                    tableHtml = readFileSync(filePath2) + "";
                                }
                            }
                            catch { }
                            if (!tableHtml) { 
                                tableHtml = "<br><br>ERROR: Failed to load table config.  [err3498]<br><br>"; 
                                err = true;
                            }
                            else {
                       
                                this.LoadEditListIfNeeded();
                                let SpecialFlags = this.editlistj.getStr("SpecialFlags").toLowerCase();
                                let DisplayLength = this.editlistj.getStr("Paging","50");
                                let pagingStart = this.toInt(cms.FormOrUrlParam("start"),0); // FUTURE: Use this value?
                                if (this.editlisterror != "") { 
                                    tableHtml = "<br><br>ERROR: " + this.editlisterror + "<br><br>"; 
                                    err = true;
                                }
                                else {
                                    this.GetColumns(out); // gets json columns

                                    // Insert data into HTML
                                    rTags.add(cms.urlParam("eclass"),"eclass");
                                    //rTags["editlist-header"].Value=colsHtml;

                                    rTags.add(out.ColsJS,"editlist-columns");
                                    rTags.add(this.editlistj.getStr("PrimaryKey").trim(),"editlist-primarykey");
                                    let orderby2 = this.editlistj.getStr("OrderBy2").trim();
                                    if (orderby2 != "") { 
                                        rTags.add(",\"order\": " + orderby2, "editlistorderby"); 
                                        }
                                    rTags.add(DisplayLength, "paging");
                                    if (SpecialFlags.indexOf("serverside") >=0) {
                                        rTags.add(",\"processing\":true ", "processing");
                                        rTags.add(",\"serverSide\":true ", "serverside");
                                    }
                                }
                            }
                            if (!err) {
                                content.append(await cms.ReplaceStringTags(tableHtml, rTags, true, "{{", "}}"));
                            }
                            else {
                                content.append(tableHtml); // Error message
                            }
                        }
                        catch (errTmp) {  content.append(errTmp + ""); }
                        break;
                    
                    case "admin-editlist-data":
                        // Return item/record data in JSON form
                        ret.AllowRecursiveCall = false;
                        this.PrepForJsonReturn(ret);
                        await this.GenerateJsonData(ret);
                        break;

                    /*
                    case "admin-editlist-buttons":
                        // Create the Save/Close buttons, but only if specified in the eclass config
                        // Values that can be specified in SpecialFlags: SaveButton, CancelButton, SaveCloseButton, DeleteButton
                        GenerateFormButtons(Content);
                        break;
                    case "admin-editlist-form":
                        {
                            ret.AllowRecursiveCall = false; // Do NOT replace [[tags]] recursively for this web form.
                            GenerateForm(Content);
                        }
                        break;
                    case "admin-edit-row":
                        {
                            // Used to edit a single record (usually not when selected from a list - always edit SAME record)
                            ret.AllowRecursiveCall = false; // Do NOT replace [[tags]] recursively for this web form.
                            GenerateForm(Content);
                        }
                        break;
                    case "block":
                        ProcessWebBlock(Content, ret);
                        break;
                    case "printform":
                        ret.AllowRecursiveCall = false;
                        GeneratePrintForm(Content);
                        break;
                    case "admin-editlist-save":
                        SaveEditForm(Content);
                        break;
                    case "admin-editconfig":
                        GenerateEditConfig(Content);
                        break;
                    case "admin-editrecord":
                        { // FUTURE: Why are we using this and not admin-editlist-form?
                            GenerateEditRecord(Content);
                        }
                        break;
                    case "admin-saveconfig":
                        {
                            SaveConfig(Content);
                        }
                        break;
                    case "admin_autofill":
                        string autofillTable = cms.FormOrUrlParam("table");
                        string autofillField = cms.FormOrUrlParam("field");
                        string autofillType = cms.FormOrUrlParam("type");
                        string autofillSubField = cms.FormOrUrlParam("subfield");
                        FlexJson autofill = new FlexJson("{}");
                        autofill["success"].Value = "false";
                        autofill["data"].Value = "";

                        string autoFillData = GenerateAutofillForm(autofillTable, autofillField, autofillType, autofillSubField);
                        if (!this.isNullOrWhiteSpace(autoFillData))
                        {
                            autofill["success"].Value = "true";
                            autofill["data"].Value = autoFillData;
                        }
                        Content.Append(autofill.jsonString);
                        break;
                    case "admin-show-view":
                        // Show a custom form with data filled in from a DB record/object
                        // Config file specified by vClass
                        // Object ID specified by id
                        AdminShowView(Content);
                        break;
                    case "jsonlist":
                        FlexJson jsonListConfig = new FlexJson();
                        string webBlockPath = Util.FindFile("jsonlist_" + ret.Param1 + ".cfg", cms.SITE.ConfigFolder, cms.SERVER.ConfigFolder);
                        jsonListConfig.DeserializeFlexFile(webBlockPath);
                        // Check for Errors
                        if (jsonListConfig.Status != 0)
                        {
                            cms.WriteLog("cmsCommon-AdminTags", "ERROR: jsonList: Failed to parse file: Param1=" + ret.Param1 + ", File=" + webBlockPath + "\n");
                            // cms.WriteLog("DEBUG", "configPath1=" + cms.SITE.ConfigFolder + "\n");  // DEBUG
                            // cms.WriteLog("DEBUG", "configPath2=" + cms.SERVER.ConfigFolder + "\n");  // DEBUG
                        }
                        else
                        {
                            jsonListConfig.addToBase(ret.Tag, "Tag");
                            jsonListConfig.addToBase(ret.Param1, "Param1");
                            jsonListConfig.addToBase(ret.Param2, "Param2");
                            jsonListConfig.addToBase(ret.Param3, "Param3");
                            jsonListConfig.addToBase(ret.Param4, "Param4");
                            string jsonListType = jsonListConfig["jsonListType"].ToStr().toLowerCase();
                            switch (jsonListType)
                            {
                                case "fixedsql":
                                    string sqlSelect = Util.GetParamStr(jsonListConfig, "select", "", true, true);
                                    FlexJson webBlockResults = cms.db.GetDataReaderAll(sqlSelect);
                                    Content.Append(webBlockResults.jsonString);
                                    break;
                                default:
                                    cms.WriteLog("cmsCommon-AdminTags", "ERROR: jsonList: Invalid jsonListType: Param1=" + ret.Param1 + ", File=" + webBlockPath + "\n");
                                    break;
                            }
                        }
                        break;
                    case "pagesearchresults":
                        PageSearchResults(Content);
                        break;
                    case "galleria_image_list":
                        string ThisGalleria = cms.FormOrUrlParam("folder");
                        string galleriaFolder = cms.SITE.ContentFolder + "\\images\\photogalleries\\" + ThisGalleria;
                        DirectoryInfo pg = new DirectoryInfo(galleriaFolder);
                        foreach (string suffix in new string[] { "jpg", "png", "gif" })
                        {
                            FileInfo[] Files = pg.GetFiles("*." + suffix); //Getting cfg files
                            int photonumber = 1;
                            foreach (FileInfo ThisFile in Files)
                            {
                                Content.Append("<img src='content/images/photogalleries/" + ThisGalleria + "/" + ThisFile.Name + "' data-title='" + ThisGalleria + "-Photo " + photonumber + "'>");
                                photonumber = photonumber + 1;
                            }
                        }
                        break;
                    case "photogallery":
                        // Get template
                        try
                        {
                            string photogalleryPath = cms.SITE.TemplateFolder + "\\block_photogallery.cfg";
                            if (!File.Exists(photogalleryPath))
                            {
                                photogalleryPath = cms.SERVER.TemplateFolder + "\\block_photogallery.cfg";
                            }
                            Content.Append(File.ReadAllText(photogalleryPath));
                        }
                        catch { }
                        break;
                    case "photolist":
                        //Content.Append("DEBUG: photo gallery list<br>");
                        // FUTURE: TODO: Specify GalleryFolder in the SITE class
                        string ThisGallery = cms.FormOrUrlParam("gallery");
                        string ThisGalleryFolder = cms.SITE.ContentFolder + "\\images\\Galleries\\" + ThisGallery;
                        //Content.Append("DEBUG ThisGallery=" + ThisGallery + "<br>");
                        //Content.Append("DEBUG ThisGalleryFolder=" + ThisGalleryFolder + "<br>");

                        // Get config file (if it exists)

                        // Get list of photos (each image can have multiple versions based on the config file)

                        // Detemrine if there are any new photos in the folder
                        DirectoryInfo d = new DirectoryInfo(ThisGalleryFolder);
                        foreach (string suffix in new string[] { "jpg", "png", "gif" })
                        {
                            FileInfo[] Files = d.GetFiles("*." + suffix); //Getting cfg files
                            foreach (FileInfo ThisFile in Files)
                            {
                                Content.Append("<img border=0 src='/" + cms.SITE.World + "/content/images/galleries/" + ThisGallery + "/" + ThisFile.Name + "'>");
                            }
                        }
                        // Make/Return the list of photos
                        break;
                    case "ifuserlevel":
                    case "ifnotuserlevel":
                        bool pFlag = false;
                        int paramLvl = 999;
                        try { paramLvl = Int32.Parse(ret.Param1); } catch { paramLvl = 999; }
                        if (cms.user.userLevel >= paramLvl) { pFlag = true; }
                        if (ret.Tag == "ifnotuserlevel") { pFlag = !pFlag; } // invert true/false
                        if (pFlag) { Content.Append(ret.Param2); }
                        //cms.Response.Write("DEBUG: user level=" + cms.user.userLevel + ", paramLvl=" + paramLvl + ", pFlag=" + pFlag.ToString() + "<br><br>");
                        break;
                    case "ifuserisadmin":
                    case "ifnotuserisadmin":
                        bool admFlag = false;
                        if (cms.user.userLevel >= cms.SITE.MinAdminLevel) { admFlag = true; }
                        if (ret.Tag == "ifnotuserisadmin") { admFlag = !admFlag; } // invert true/false
                        if (admFlag) { Content.Append(ret.Param1); }
                        break;
                    case "getcookie": // [[getcookie:<cookie_name>]]
                        string cookieval1 = null;
                        try {
                            cookieval1 = cms.Request.Cookies[ret.Param1].ToString().Trim();
                        } catch {}
                        if(cookieval1!=null)
                        {
                            Content.Append(cookieval1);
                        }
                        break;
                    case "ifcookieequals": // [[ifcookieequals:<cookie_name>:<compare_value>:<text_to_append>]]
                        string cookieval2 = null;
                        try {
                            cookieval2 = cms.Request.Cookies[ret.Param1].ToString().Trim();
                        } catch {}
                        if (cookieval2 == ret.Param2.Trim())
                        {
                            Content.Append(ret.Param3);
                        } else {
                            Content.Append(ret.Param4);
                        }
                        break;
                    */
                    case "runcmd":
                        // runcmd IS PRIVATE - User must be level 3 or higher
                        let cmd = cms.FormOrUrlParam("cmd");
                        //cms.Response.Write("DEBUG:cmd=" + cmd + "<br>");
                        await this.RunCmd(cmd, content, ret);
                        break;
                    /*
                    case "qcmd":
                        // WARNING: qcmd IS PUBLIC and can be run WITHOUT PERMISSIONS
                        string qcmd = cms.FormOrUrlParam("cmd");
                        QCmd(qcmd, Content);
                        break;
                    case "errmsg":
                        try { Content.Append(cms.Session.GetString("errmsg")); } catch { }
                        break;
                    case "captcha":
                        //variables that IDK where they came from:
                        //	baseFOLDER <- replaced with SERVER.BaseFolder
                        //	wWorld <- made SITE.World
                        //	SERVER_FOLDER <- made SITE.WorldFolder
                        //	Captcha <- defined as a string
                        //	cSelect
                        string CaptchaID = "";
                        int MAX_CAPTCHAS = 9999;
                        string CaptchaFolder = "";
                        string CaptchaURL = "";
                        string CaptchaPrefix = "c";
                        string CaptchaSuffix = ".gif";

                        if (CaptchaFolder == "") //looks for captcha files in the specifically for this site
                        {
                            CaptchaFolder = cms.SITE.WorldFolder + "\\captcha";
                            CaptchaURL = "/" + cms.SITE.World + "/captcha";
                            if (Directory.Exists(CaptchaFolder) == false) //if it doesn't find them, use generic captcha files
                            {
                                CaptchaFolder = cms.SERVER.BaseFolder + "\\captcha";
                                CaptchaURL = "/captcha";
                            }
                        }
                        string f; //the file
                        if (CaptchaID == "")
                        {
                            Random r = new Random();
                            double Rnd = r.NextDouble();
                            double n = ((MAX_CAPTCHAS * Rnd) + 1);
                            int i = Convert.ToInt32(n); //This used to round, now it truncates
                            int cLast = MAX_CAPTCHAS + 99;
                            int c = MAX_CAPTCHAS;
                            int safety = 999;

                            while (true)
                            {
                                //The program cannot know how many captcha files there are. This while loop searches for
                                //an existing file in a speedy (O(lgN)) manner
                                if (i < cLast)
                                {
                                    //*** Check for captcha 
                                    f = CaptchaFolder + "\\" + CaptchaPrefix + i + CaptchaSuffix;
                                    //Response.Write("Check for " & f & "<br>")
                                    if (File.Exists(f))
                                    {
                                        CaptchaID = i.ToString();
                                        break;
                                    }
                                    cLast = i;
                                }

                                //*** Photo not found (move # down to lower 50% - thus looking for a lower number photo)
                                c = c / 2;
                                if (c <= 1)
                                    break;
                                if (i > c)
                                    i = i - c;

                                safety = safety - 1;
                                if (safety <= 0)
                                    break;
                            }
                        }

                        //*** Check one last time for CaptchaID=1
                        if (CaptchaID == "")
                        {
                            f = CaptchaFolder + "\\" + CaptchaPrefix + "1" + CaptchaSuffix;
                            if (File.Exists(f))
                                CaptchaID = "1";
                        }

                        //*** Must have selected a Captcha in order to continue...
                        if (CaptchaID == "") { }
                        //Then Exit Function //?
                        //throw an exception here?

                        //*** Generate the HTML that was requested...
                        string Captcha = "";
                        //can you put more information in tags and access it here, to get cSelect?
                        switch (((ret.Param1).Trim()).toLowerCase())
                        {
                            case "":
                                Captcha = "<table id='captchatable' border=0 cellpadding=0 cellspacing=0><tr><td>Please type the characters in the image:&nbsp;</td><td colspan=2><img border=0 src='" +
                                    CaptchaURL + "/" + CaptchaPrefix + CaptchaID + CaptchaSuffix + "'></td></tr>" +
                                    "<tr><td><input type='text' name='captcha' id='captcha'><input type='hidden' name='captchaid' id='captchaid' value='" + CaptchaID + "'></td></tr></table>";
                                break;
                            case "title":
                                Captcha = "Please type the characters in the image:";
                                break;
                            case "field":
                                Captcha = "<input type='text' name='captcha' id='captcha'>";
                                break;
                            case "hidden":
                                Captcha = "<input type='hidden' name='captchaid' id='captchaid' value='" + CaptchaID + "'>";
                                break;
                            case "img":
                                Captcha = "<img border=0 src='" + CaptchaURL + "/" + CaptchaPrefix + CaptchaID + CaptchaSuffix + "'>";
                                break;
                            case "imgurl":
                                Captcha = CaptchaURL + "/" + CaptchaPrefix + CaptchaID + CaptchaSuffix;
                                break;
                            case "id":
                                Captcha = CaptchaID;
                                break;
                            default:
                                Captcha = "";
                                break;
                        }
                        //what do I do with Captcha that I created? content.append it?
                        Content.Append(Captcha);
                        break;
                    case "runutility":
                        callRunUtility(cms.FormOrUrlParam("runClass"));
                        break;
                    case "remoteips": // DEBUG: List remote IPs
                        string[] HeaderItems = ("HTTP_CLIENT_IP,HTTP_X_FORWARDED_FOR,HTTP_X_FORWARDED,HTTP_X_CLUSTER_CLIENT_IP,HTTP_FORWARDED_FOR,HTTP_FORWARDED,HTTP_VIA,REMOTE_ADDR,Basic,data")
                            .Split(",");
                        for (const item of HeaderItems) // foreach
                        {
                            try
                            {
                                Microsoft.Extensions.Primitives.StringValues value1;
                                cms.Request.HttpContext.Request.Headers.TryGetValue(item, out value1);
                                var v1 = value1.FirstOrDefault();

                                //string val = cms.Request.Headers[item].ToString();
                                Content.Append(item + "=" + v1 + "<br>\n");
                            }
                            catch (Exception) { }
                        }
                        Content.Append("RemoteAddr=" + cms.Request.HttpContext.Connection.RemoteIpAddress + "<br>\n");
                        break;

                        *** End of section from original cmsCommon.cs ***/

            /* admin_block - same as above
            case "admin_block":
                let sBlockPath = "";
                let sName = "";
                if (cms.user.userLevel >= cms.minAdminLevel)
                {
                    //*** IF WE ARE LOGGED IN AND THIS PERSON HAS PRIVILEDGES... Allow edit of Wiki page.  (future, check if page is editable?!)
                    //*** Here we reference admin_main.cfg  (or if [[admin_block:alias]] specified then admin_alias.cfg)	
                    sName = ret.Param1.trim();
                    if (sName == "") { sName = "block"; }
                    sBlockPath = this.FindFileInFolders("admin_" + sName + ".cfg", this.getParamStr("TemplateFolder"), this.getParamStr("CommonTemplateFolder"));
                    if (sBlockPath)
                    {
                        content.append(readFileSync(sBlockPath));
                    }
                } // end if (cms.user.userLevel>= cms.minAdminLevel)
                break;
            
            case "admin_edit_page":
                string sBlockPath2 = "";
                //int MinEditLevel=cms.wiki["header.mineditlevel"].ToInt(999);  // This is now done in default.aspx
                //the theory is that this variable is actually not defined somehow? remove above if edit page on 215sports is fixed outside of this DSchwab 
                if (cms.user.userLevel >= cms.minAdminLevel)
                {
                    //Content.Append("DEBUG: UserLevel: " + cms.user.userLevel + ", MinEditLevel: " + cms.minEditLevel + "<br>");
                    //Content.Append("DEBUG: wiki[header]=" + cms.wiki["Header"].jsonString + "<br>");
                    if (cms.user.userLevel >= cms.minEditLevel)
                    {
                        sBlockPath2 = cms.SITE.TemplateFolder + "\\admin_edit_page.cfg";
                        if (File.Exists(sBlockPath2))
                        {
                            Content.Append(readFileSync(sBlockPath2));
                        }
                        else
                        {
                            sBlockPath2 = cms.SERVER.TemplateFolder + "\\admin_edit_page.cfg";
                            //Content.Append("DEBUG: Looking for [" + sBlockPath2 + "]");
                            if (File.Exists(sBlockPath2))
                            {
                                Content.Append(readFileSync(sBlockPath2));
                            }
                        }
                    }
                } // end if (cms.user.userLevel>= cms.minAdminLevel)
                break;
            case "admin-createpagelink":
                // FUTURE: MOVE THIS TO AdminFunctions.cs ONCE SITE.MinCreateLevel is added to every config
                if (cms.user.userLevel >= cms.SITE.MinCreateLevel)
                {
                    Content.Append("<input type='button' value='CREATE PAGE' onclick='admin_open_edit_d(\"" + cms.PageID + "\",true);'><br><br>");
                }
                break;
            
            case "edit_page_link":
                //*** This tag is to be used in the admin_block
                //*** IF WE ARE LOGGED IN AND THIS PERSON HAS PRIVILEDGES... Allow edit of Wiki page. 	
                //*** FUTURE: Check if page is editable
                if (cms.user.userLevel >= cms.minAdminLevel)
                {
                    string EditURL = "", LinkTitle = "", tsWiki = "";
                    tsWiki = "admin-editObject.ashx?world=" + cms.siteId + "&class=Edit-MainWikiPage";

                    if (cms.wikiNotFound > 0)
                    {
                        //*** Wiki Page is missing - link to CREATE it...
                        EditURL = tsWiki + "&obj=*new*&saveas=" + cms.RequestedPage;
                        LinkTitle = "Create Page";
                    }
                    else
                    {
                        //*** Wiki Page exists - link to UPDATE it
                        EditURL = tsWiki + "&id=" + cms.wiki["objid"].CString() + "&obj=" + cms.RequestedPage;
                        LinkTitle = "Edit Page";
                    }

                    // FUTURE: check if this is a PRODUCT page
                    //if ((Product_Page<>"") && (PageID==Product_Page)) { EditURL=EditProductsURL; }

                    Content.Append("<a hRef=\"#\" onClick=\"Javascript:pup=window.open('" + EditURL + "','WObjEditor','menubar=no,status=no,width=950,height=700,toolbar=no,scrollbars=yes,location=no,directories=no,resizable=yes');pup.focus();return false;\" >" + LinkTitle + "</a>");

                }
                break;
            case "admin_menu_link":
                //*** This tag is to be used in the admin_block
                if (cms.user.userLevel >= cms.minAdminLevel)
                {
                    Content.Append("<a hRef='" + cms.SITE.ADMIN_Page + ".ashx'>Admin Menu</a>");
                }
                break;
            case "err_block":
            case "error_block":
                string errText = cms.Session.GetString("errmsg").Trim();
                if (errText == "") { errText = cms.ErrMsg; }
                if (errText != "")
                {
                    Content.Append("<div class='error_block'>" + errText + "<div>");
                }
                break;
            case "admin-get-editlistconfig":  // This may not be used any longer - now set as {{eclass}} tag within admin-editlist-table below
                Content.Append(editlistconfig);
                break;
            case "admin-load-editconfig":
                // This tag will load the editor config file if needed.  A response will be generated if there is an error.
                // This tag is not mandatory, but it enables the display of a user-friendly response and it allows
                // an override of the eclass config file name (Param1)
                LoadEditListIfNeeded(ret.Param1);
                if (editlisterror != "")
                {
                    Content.Append("<div id='adminerror'>ERROR: " + editlisterror + "</div>");
                }
                break;
            case "admin-editlist-param":
                LoadEditListIfNeeded();
                try
                {
                    if (editlistj.Contains(ret.Param1))
                    {
                        FlexJson rParam = this.editlistj.i(ret.Param1);
                        if (rParam.jsonType == "array" || rParam.jsonType == "object") {
                            rParam.UseFlexJson = false;
                            rParam.InvalidateJsonString();
                            Content.Append(rParam.jsonString);
                        } else {
                            Content.Append(rParam.CString());
                        }
                    }
                    else
                    {
                        Content.Append(ret.Param2 + "");
                    }
                }
                catch (Exception) { }
                break;
            case "admin-editlist-table":
                try
                {
                    string filePath2, tableHtml;
                    let out = {
                        cols: "",
                        colsHtml = "", 
                        jsCols = ""
                        };
                    FlexJson rTags = new FlexJson("{}");

                    // Look for editlist table HTML config file in the SERVER src folder.
                    try
                    {
                        filePath2 = cms.SERVER.SourceFolder + "\\admin-editlist-table.cfg";
                        tableHtml = readFileSync(filePath2);
                    }
                    catch { tableHtml = "<br><br>ERROR: Failed to load table config.  [err3498]<br><br>"; }
                    LoadEditListIfNeeded();
                    string SpecialFlags = this.editlistj.getStr("SpecialFlags").toLowerCase();
                    string DisplayLength = this.editlistj.getStr("Paging","50");
                    int pagingStart = Util.ToInt(cms.FormOrUrlParam("start"),0);
                    if (editlisterror != "") { tableHtml = "<br><br>ERROR: " + editlisterror + "<br><br>"; }
                    else
                    {
                        GetColumns(out); // gets json columns

                        // Insert data into HTML
                        rTags["eclass"].Value = cms.urlParam("eclass");
                        //rTags["editlist-header"].Value=colsHtml;

                        rTags["editlist-columns"].Value = jsCols;
                        rTags["editlist-primarykey"].Value = this.editlistj.getStr("PrimaryKey");
                        string orderby2 = this.editlistj.getStr("OrderBy2").Trim();
                        if (orderby2 != "") { 
                            rTags["editlistorderby"].Value = ",\"order\": " + orderby2; 
                            }
                        rTags["paging"].Value = DisplayLength;
                        if (SpecialFlags.IndexOf("serverside") >=0) {
                            rTags["processing"].Value = ",\"processing\":true ";
                            rTags["serverside"].Value = ",\"serverSide\":true ";
                        }
                    }
                    Content.Append(Util.ReplaceTags(tableHtml, rTags, true, "{{", "}}"));
                }
                catch { }
                break;
            case "admin-editlist-buttons":
                // Create the Save/Close buttons, but only if specified in the eclass config
                // Values that can be specified in SpecialFlags: SaveButton, CancelButton, SaveCloseButton, DeleteButton
                GenerateFormButtons(Content);
                break;
            case "admin-editlist-form":
                {
                    ret.AllowRecursiveCall = false; // Do NOT replace [[tags]] recursively for this web form.
                    GenerateForm(Content);
                }
                break;
            case "admin-edit-row":
                {
                    // Used to edit a single record (usually not when selected from a list - always edit SAME record)
                    ret.AllowRecursiveCall = false; // Do NOT replace [[tags]] recursively for this web form.
                    GenerateForm(Content);
                }
                break;
            case "block":
                ProcessWebBlock(Content, ret);
                break;
            case "printform":
                ret.AllowRecursiveCall = false;
                GeneratePrintForm(Content);
                break;
            case "admin-editlist-save":
                SaveEditForm(Content);
                break;
            case "admin-editconfig":
                GenerateEditConfig(Content);
                break;
            case "admin-editrecord":
                { // FUTURE: Why are we using this and not admin-editlist-form?
                    GenerateEditRecord(Content);
                }
                break;
            case "admin-saveconfig":
                {
                    SaveConfig(Content);
                }
                break;
            case "admin_autofill":
                string autofillTable = cms.FormOrUrlParam("table");
                string autofillField = cms.FormOrUrlParam("field");
                string autofillType = cms.FormOrUrlParam("type");
                string autofillSubField = cms.FormOrUrlParam("subfield");
                FlexJson autofill = new FlexJson("{}");
                autofill["success"].Value = "false";
                autofill["data"].Value = "";

                string autoFillData = GenerateAutofillForm(autofillTable, autofillField, autofillType, autofillSubField);
                if (!this.isNullOrWhiteSpace(autoFillData))
                {
                    autofill["success"].Value = "true";
                    autofill["data"].Value = autoFillData;
                }
                Content.Append(autofill.jsonString);
                break;
            case "admin-show-view":
                // Show a custom form with data filled in from a DB record/object
                // Config file specified by vClass
                // Object ID specified by id
                AdminShowView(Content);
                break;
            case "jsonlist":
                FlexJson jsonListConfig = new FlexJson();
                string webBlockPath = Util.FindFile("jsonlist_" + ret.Param1 + ".cfg", cms.SITE.ConfigFolder, cms.SERVER.ConfigFolder);
                jsonListConfig.DeserializeFlexFile(webBlockPath);
                // Check for Errors
                if (jsonListConfig.Status != 0)
                {
                    cms.WriteLog("cmsCommon-AdminTags", "ERROR: jsonList: Failed to parse file: Param1=" + ret.Param1 + ", File=" + webBlockPath + "\n");
                    // cms.WriteLog("DEBUG", "configPath1=" + cms.SITE.ConfigFolder + "\n");  // DEBUG
                    // cms.WriteLog("DEBUG", "configPath2=" + cms.SERVER.ConfigFolder + "\n");  // DEBUG
                }
                else
                {
                    jsonListConfig.addToBase(ret.Tag, "Tag");
                    jsonListConfig.addToBase(ret.Param1, "Param1");
                    jsonListConfig.addToBase(ret.Param2, "Param2");
                    jsonListConfig.addToBase(ret.Param3, "Param3");
                    jsonListConfig.addToBase(ret.Param4, "Param4");
                    string jsonListType = jsonListConfig["jsonListType"].ToStr().toLowerCase();
                    switch (jsonListType)
                    {
                        case "fixedsql":
                            string sqlSelect = Util.GetParamStr(jsonListConfig, "select", "", true, true);
                            FlexJson webBlockResults = cms.db.GetDataReaderAll(sqlSelect);
                            Content.Append(webBlockResults.jsonString);
                            break;
                        default:
                            cms.WriteLog("cmsCommon-AdminTags", "ERROR: jsonList: Invalid jsonListType: Param1=" + ret.Param1 + ", File=" + webBlockPath + "\n");
                            break;
                    }
                }
                break;
            case "pagesearchresults":
                PageSearchResults(Content);
                break;
            */
				
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

    // RunCmd(): PRIVATE CALL - must be level 3+
    async RunCmd(cmd, content, ret)
    {
        let jContent = null; // FlexJson 
        let fileName = "";
        switch (cmd.trim().toLowerCase())
        {
            case "listcontentfiles": //NOTE: MOVED THE FORM-EDIT COMMANDS BACK TO managedata.aspx/managedataClass.cs
                //jContent=listContentFiles();
                //OutputJSON(jContent);
                break;
            case "listallfiles": //NOTE: MOVED THE FORM-EDIT COMMANDS BACK TO managedata.aspx/managedataClass.cs
                //jContent=listAllFiles();
                //OutputJSON(jContent);
                break;
            case "editfile": //NOTE: MOVED THE FORM-EDIT COMMANDS BACK TO managedata.aspx/managedataClass.cs
                //fileName = cms.FormOrUrlParam("filename");
                //jContent=editFile(fileName);
                //OutputJSON(jContent);
                break;
            case "savefile": //NOTE: MOVED THE FORM-EDIT COMMANDS BACK TO managedata.aspx/managedataClass.cs
                //FlexJson jObj=new FlexJson();
                //jObj.Serialize(cms.Request.Form); // Reads all FORM parameters
                //jObj.RemoveFromBase("cmd");
                //jObj.RemoveFromBase("rtype");
                //jContent=saveFile(jObj);
                //OutputJSON(jContent);
                break;
            case "editlist-info":
                    // Send key Config info to front-end for edit-data-tables
                    this.PrepForJsonReturn(ret);
                    this.LoadEditListIfNeeded();
                    let newHeader = new FlexJson("{}");
                    newHeader.add(this.editlistj.getStr("Title"),"Title");
                    newHeader.add(this.editlistj.getStr("Table"),"Table");
                    newHeader.add(this.editlistj.getStr("SpecialFlags"),"SpecialFlags");
                    newHeader.add(this.editlistj.getStr("PrimaryKey"),"PrimaryKey");
                    newHeader.add(this.editlistj.getStr("PrimaryKeyNumeric"),"PrimaryKeyNumeric");
                    newHeader.add(this.editlistj.i("SearchList"),"SearchList");
                    ret.ReturnJson = newHeader.jsonString;
                    break;
            case "editlist-data":
                // Create HTML list of records
                // Content.Append("HERE 444: DEBUG<br><br>");
                // EditList.htmlList(cms,Content);
                break;
            case "editlist-json":
                // Create JSON list of records
                this.PrepForJsonReturn(ret);
                await this.GenerateJsonData(ret);
                break;
        }
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

    /* ************************************************************************************* */
    /* ************************ Edit Table / Edit Form ************************************* */
    /* ************************************************************************************* */

    async GenerateJsonData(ret, idOverride = "", eClassOverride = "", includeHeader = true)
        {
            let sql3 = "";
            let out = {
                Cols: "",
                ColsHtml:"",
                ColsJS: ""
                };
            var errmsg;
            let id = idOverride;
            let limit = "";
            if (this.isNullOrWhiteSpace(id)) { id = this.urlParam("id"); }
            //if (id=="") { ret.ReturnJson.error = "<br><br>ERROR: Record ID not specified. [err4336]"; return; }

            let jret = new FlexJson("{}");

            this.LoadEditListIfNeeded();
            if (this.editlistconfig == "") { return; } // no need to display error because this should have been done in the admin-load-editconfig tag
            if (this.editlistj.i("MasterFiles").length >= 1)
            {
                // If the objects are stored in data files as the 'master' copy... then use the data files as the master list of objects 
                this.GenJsonFromMasterFiles(ret, this.editlistj.i("MasterFiles"), this.editlistj.i("SearchList"), idOverride, eClassOverride, includeHeader);
                return;
            }
            let SearchTable = this.editlistj.getStr("SearchTable");
            let flags = this.editlistj.getStr("SpecialFlags").toLowerCase();
            let pagingLength = this.editlistj.getStr("Paging","50");
            let pagingStart = this.toInt(this.FormOrUrlParam("start"),0);
            let historyFlag = this.toBool(this.FormOrUrlParam("history"),false);
            let searchText = this.FormOrUrlParam("search");

            this.GetColumns(out);

            if (flags.indexOf("serverside") >=0) {
                limit = " LIMIT " + pagingStart + ", " + pagingLength;
            }

            // CHECK SECURITY LEVEL
            let Permit = this.EditFormSecurityLevel();  // Default=No Access
            // let bViewOnly = (Permit <= 1) ? true : false;
            this.db.Open();
            if (Permit <= 0)
            {
                ret.ReturnJson.error = "ERROR: Permission denied.";
                if (this.debugMode > 0) { ret.ReturnJson.error = " [UserLevel=" + this.user.userLevel + "]"; }
                return;
            }
            else
            {
                try
                {
                    let w = this.MakeSearch(out.Cols,searchText);
                    let w1 = "SiteID='" + this.siteId + "'";
                    if (flags.indexOf("noworldid") >= 0) { w1 = ""; }
                    if (w1 != "") { if (w != "") { w += " AND "; } w += "(" + w1 + ")"; }
                    let w2 = this.editlistj.getStr("Where").trim();
                    if (w2 != "") { if (w != "") { w += " AND "; } w += "(" + w2 + ")"; }
                    let w3 = "";
                    if (historyFlag) { w3 = this.editlistj.getStr("WhereHistoryTrue").trim(); }
                    else { w3 = this.editlistj.getStr("WhereHistoryFalse").trim(); }
                    if (w3 != "") { if (w != "") { w += " AND "; } w += "(" + w3 + ")"; }
                    if (w.trim() != "") { w = " WHERE " + w; }
                    let o = this.editlistj.getStr("OrderBy").trim();  // For datatables this does nothing - Try OrderBy2="[ [5, 'desc' ] ]"
                    if (o != "") { o = " ORDER BY " + o + " "; }
                    sql3 = "SELECT " + out.Cols + " FROM " + SearchTable + " " + w + o + limit;
                    /* DEBUG
                    using (StreamWriter writer = new StreamWriter(SITE.ConfigFolder + "\\temp-SQL.txt"))
                    {
                        writer.Write(sql3);
                    } 
                    */
                    //this.Response.Write("DEBUG: connect=" + this.db.ConnectString + "<br><br>"); //DEBUG 
                    let rData = await this.db.GetDataReader(sql3);
                    let rDataAll = rData.GetAllRecords();
                    let recordsTotal=await this.db.GetCount(SearchTable,w);
                    let recordsFiltered=recordsTotal;

                    jret.add("success", "msg");
                    jret.add(this.FormOrUrlParam("draw"), "draw"); // Return the DRAW id sent in the request (used to sync results)
                    jret.add(recordsTotal, "recordsTotal");
                    jret.add(recordsFiltered, "recordsFiltered");
                    jret.add(rDataAll, "data");
                    jret.add(sql3, "sql"); //DEBUG
                    ret.ReturnJson = jret;
                }
                catch (ee3)
                {
                    console.log(ee3);
                    errmsg = "ERROR: Failed to get data records. [err4995]";
                    if (this.debugMode > 0) { errmsg += " SQL=" + sql3; }
                    jret.add(new FlexJson("[]"), "data");
                    jret.add(errmsg, "error");
                    ret.ReturnJson = jret;
                }
            } // end if-else (Permit<=0)
            this.db.Close();
        } // end function

        // FUTURE: first parameter "ret" is no longer a StringBuilder. This is expecting a JSON object to be generated.
        GenJsonFromMasterFiles(ret, MstrFiles, SearchFields, idOverride = "", eClassOverride = "", includeHeader = true)
        {
            let rData = new FlexJson("[]");
            let tTags = new FlexJson("{}");
            var jjFile;
            let fileCount = 0;

            // This loop allows for multiple MaterFile folders - which is why the MasterFiles is an array
            for (const MstrFile of MstrFiles) // foreach
            {
                // Get a list of files in the specified folder
                let readPath = "";
                let prefix = "";
                let ext = ""; 
                let FileNameField = "";
                let hasHeader = false;
                readPath = MstrFile.getStr("FolderPath");
                prefix = MstrFile.getStr("FilePrefix").trim();
                ext = MstrFile.getStr("FileExt").trim().toLowerCase();
                FileNameField = MstrFile.getStr("FileNameField").trim();
                hasHeader = MstrFile.getBool("IncludeJsonHeader");
                tTags.add(this.SITE.PageFolder, "pageFolder");
                tTags.add(this.SITE.ContentFolder, "contentFolder");
                tTags.add(this.SITE.TemplateFolder, "templateFolder");
                readPath = this.ReplaceStringTags(readPath, tTags, true, "{{", "}}");
                //ret.ReturnJson.error = "DEBUG: path=" + readPath + "\\" + prefix + "*" + ext + "  " ;

                if (readPath != "")
                {
                    // got to here zzzz
                    if (Directory.Exists(readPath))
                    {
                        let d = new DirectoryInfo(readPath);
                        let Files = d.GetFiles(prefix + "*" + ext); //Getting cfg files	
                        for (const file of Files) // foreach
                        {
                            //ret.ReturnJson.debug += "DEBUG:" + rData.jsonString;
                            if (file.Extension.toLowerCase() == ext)
                            {
                                fileCount++;
                                //ret.ReturnJson.debug += "DEBUG:[" + file.Name + "]";
                                //we need the title without the prefix/ext
                                let fileNameNoExtension = Path.GetFileNameWithoutExtension(file.Name);
                                if (prefix.length > 0)
                                {
                                    if (Util.Left(fileNameNoExtension, prefix.Length).toLowerCase() == prefix.toLowerCase())
                                    {
                                        fileNameNoExtension = Util.Mid(fileNameNoExtension, prefix.Length + 1);
                                    }
                                }

                                jjFile = new FlexJson("{}");
  
                                // Read [[header]] from file (if files contain headers)
                                if (hasHeader) {
                                    let fileHeader=Util.ReadJsonHeader(file.FullName);
                                    for (fld of SearchFields) {
                                        let fldName = fld.getStr("Field");
                                        if (fileHeader.Contains(fldName)) {
                                            jjFile[fldName].Value = fileHeader[fldName].Value;
                                        } else {
                                            let jjValue = "";
                                            switch (fldName.toLowerCase()) {
                                                case "pageid":
                                                    jjValue = fileNameNoExtension;
                                                    break;
                                                case "type":
                                                    jjValue = "webpage";
                                                    break;
                                                case "status":
                                                    jjValue = "Active";
                                                    break;
                                                case "pageidx":
                                                    jjValue = "";
                                                    break;
                                                case "pagelink":
                                                    jjValue = "<a href='" + fileNameNoExtension + "'>View</a>";
                                                    break;
                                            }
                                            jjFile.add(jjValue, fldName);
                                        }
                                    }
                                }

                                // FUTURE: use SearchList to create fields in jjFile.

                                // Add file to list
                                rData.add(jjFile);
                                jjFile = null;
                            }
                        }
                    }
                } // readPath is not missing
            } // foreach MasterFiles
            //ret.ReturnJson.debug += "DEBUG +++++++++" + rData.jsonString + "++++++++";
            let jret = new FlexJson("{}");
            if (fileCount == 0)
            {
                jret.add("no files found", "msg");
            }
            else
            {
                jret.add("success", "msg");
            }
            jret.add(rData, "data");
            ret.ReturnJson = jret;
            return;
        }
        /*
        GenerateFormButtons(content)
        {
            LoadEditListIfNeeded();  // This loads editlistj
            if (editlistconfig == "") { return; } // no need to display error because this should have been done in the admin-load-editconfig tag

            string flags = this.editlistj.getStr("SpecialFlags").toLowerCase();
            StringBuilder buttons = new StringBuilder();

            //Add Buttons to the form
            if ((flags.IndexOf("savebutton") >= 0) || (flags.IndexOf("allbuttons") >= 0))
            {
                buttons.Append("<input class='adminbutton adminsavebutton' type='button' name='Save' value='Save' onclick='SaveItem(false);return false;'>");
            }
            if ((flags.IndexOf("saveclosebutton") >= 0) || (flags.IndexOf("allbuttons") >= 0))
            {
                buttons.Append("<input class='adminbutton adminsaveclosebutton' type='button' name='SaveClose' value='Save/Close' onclick='SaveItem(true);return false;'>");
            }
            if ((flags.IndexOf("cancelbutton") >= 0) || (flags.IndexOf("allbuttons") >= 0))
            {
                buttons.Append("<input class='adminbutton admincancelbutton' type='button' name='Cancel' value='Cancel/Close' onclick='CloseForm(false);return false;'>");
            }
            if ((flags.IndexOf("deletebutton") >= 0) || (flags.IndexOf("allbuttons") >= 0))
            {
                buttons.Append("<input class='adminbutton admindeletebutton' type='button' name='Delete' value='Delete' onclick='DeleteItem();return false;'>");
            }
            if (buttons.Length > 0)
            {
                buttons.Insert(0, "<div class='adminbuttoncontainer'>");
                buttons.Append("</div>");
                content.append(buttons.ToString());
            }
        }

        public void GenerateForm(content, string idOverride = "", string eClassOverride = "", bool includeHeader = true)
        {
            string id = idOverride;
            string autoFillInfo = "";
            try
            {
                if (this.isNullOrWhiteSpace(id)) { id = cms.urlParam("id"); }
                // Moved check that ID is not blank below (so we can check if it is needed first)

                if (this.debugMode >= 9)
                {
                    cms.WriteLog("GenerateForm", "id=" + id + "\n", true);
                }

                // Set the CKEditor Upload folder based on the WORLD (DEFAULT VALUES)
                // see below where this may be overridden by the Edit Class (FUTURE)
                cms.Session.SetString("CKFinder_BaseUrl", "/" + cms.siteId + "/content/");

                LoadEditListIfNeeded(eClassOverride);  // This loads editlistj
                if (editlistconfig == "") { return; } // no need to display error because this should have been done in the admin-load-editconfig tag
                string title = this.editlistj.getStr("Title");
                if (includeHeader) { content.append("<h1>EDIT FORM: " + title + "</h1>"); }
                string table = this.editlistj.getStr("Table");
                string pk = this.editlistj.getStr("PrimaryKey");
                string pknumeric = this.editlistj.getStr("PrimaryKeyNumeric").toLowerCase();

                // If Edit Class contains CKEditor Parameters... use them...
                string sVal = "";
                sVal = this.editlistj.getStr("UserFilesPath").trim();
                if (sVal != "") { cms.Session.SetString("CKFinder_BaseUrl", sVal); }
                sVal = "";
                sVal = this.editlistj.getStr("UserFilesDirectory").trim();
                if (sVal != "") { cms.Session.SetString("CKFinder_BaseDir", sVal); }

                // CHECK SECURITY LEVEL
                int Permit = EditFormSecurityLevel();  // Default=No Access
                bool bViewOnly = (Permit <= 1) ? true : false;

                if (Permit <= 0)
                {
                    content.append("<br><br>ERROR: Permission denied.");
                    if (this.debugMode > 0) { content.append(" [UserLevel=" + cms.user.userLevel.ToString() + "]"); }
                    return;
                }
                content.append("<div class='msgBox' id='msgBox'></div>");


                // Get Object/Record from the database
                FlexJson jRec = null;
                string id2 = id;
                string flags = this.editlistj.getStr("SpecialFlags").toLowerCase();
                bool create = false; 
                bool fromFile = false;
                if (id.toLowerCase() == "*new*") { create = true; }

                if (id == "")
                {
                    if (!(flags.IndexOf("norecordid") >= 0))
                    { // Ignore Record ID if it is not needed
                        content.append("<br><br>ERROR: Record ID not specified. [err4337]"); return;
                    }
                }

                string ReadFromSource = this.editlistj.getStr("ReadFromSource","table").toLowerCase();

                if (this.editlistj.i("MasterFiles").length >= 1 || ReadFromSource=="wikipage" || ReadFromSource=="config" )
                {
                    fromFile = true;
                    // If the objects are stored in data files as the 'master' copy... then use the data files as the master list of objects 
                    FlexJson MstrFiles = this.editlistj.i("MasterFiles");
                    FlexJson tTags = new FlexJson("{}");
                    // FlexJson jjFile;
                    int fileCount = 0;

                    // This loop allows for multiple MaterFile folders - which is why the MasterFiles is an array
                    if (!create)
                    {
                        foreach (FlexJson MstrFile in MstrFiles)
                        {
                            // Find specified file in the folder
                            string readPath = "", prefix = "", ext = "", FileNameField = "", FileNamePath = "", ContentField = "";
                            bool hasHeader = false;
                            readPath = MstrFile["FolderPath"].ToStr();
                            prefix = MstrFile["FilePrefix"].ToStr().Trim();
                            ext = MstrFile["FileExt"].ToStr().Trim().toLowerCase();
                            FileNameField = MstrFile["FileNameField"].ToStr().Trim();
                            ContentField = MstrFile["Field"].ToStr().Trim();
                            hasHeader = MstrFile["IncludeJsonHeader"].ToBool();
                            tTags["baseFolder"].Value = cms.SITE.WorldFolder;
                            tTags["pageFolder"].Value = cms.SITE.PageFolder;
                            tTags["contentFolder"].Value = cms.SITE.ContentFolder;
                            tTags["templateFolder"].Value = cms.SITE.TemplateFolder;
                            readPath = Util.ReplaceTags(readPath, tTags, true, "{{", "}}");

                            //content.append("DEBUG: path=" + readPath + "  <br>");
                            if (readPath != "")
                            {
                                FileNamePath = readPath + "\\" + prefix + id.Trim() + ext;
                                if (File.Exists(FileNamePath))
                                {
                                    // Load file into jRec
                                    int flagStatus = 0;
                                    string loadErrMsg = "";
                                    //Util.GetMasterFile(FileNamePath, ref jRec, ref flagStatus, ContentField);
                                    if (ReadFromSource == "config") {
                                        jRec = new FlexJson();
                                        jRec.DeserializeFlexFile(FileNamePath,false,1,1);
                                        jRec["id"].Value = id;
                                    } else {
                                        // case: ReadFromSource == "wikipage" or "table"
                                        Util.LoadHtmlFile(FileNamePath, out jRec, out flagStatus, out loadErrMsg, ContentField, cms.user.userLevel);
                                    }
                                    fileCount += 1;
                                    // FUTURE: check return value (values <0 indicate error)
                                }
                            } // if (readPath != "")
                        }     // foreach
                    } // if (!create)

                    if (fileCount <= 0 && (!create))
                    {
                        //if ((cms.urlParam("AllowCreate").toLowerCase() == "true") && (cms.user.userLevel >= cms.SITE.MinCreateLevel))
                        if ((editlistj.getBool("AllowCreate",false) == true) && (cms.user.userLevel >= cms.SITE.MinCreateLevel))
                        {
                            // Even though the object was not found, we are allowed to create it
                            create = true;
                        }
                        else
                        {
                            // File was not found AND we are not allowed to create it
                            content.append("ERROR: Item not found. [err1393]<br>\n");
                            return;
                        }
                    }

                } // [MasterFiles].Length >=1
                else
                {
                    if (!create)
                    {
                        if (pknumeric != "true") { id2 = "'" + id + "'"; }
                        string w = " AND WorldID='" + cms.siteId + "' ";
                        string w2 = this.editlistj.getStr("Where").trim();
                        string where = "";
                        if (w2 != "") { w2 = " AND (" + w2 + ")"; }
                        if (flags.IndexOf("noworldid") >= 0) { w = ""; }
                        if (!(flags.IndexOf("norecordid") >= 0))
                        {
                            where = " WHERE " + pk + "=" + id2 + w + w2;
                        }
                        else
                        {
                            where = " WHERE 1=1 " + w + w2;
                        }
                        string sql = "SELECT * FROM " + table + " " + where;

                        if (this.debugMode >= 9)
                        {
                            cms.WriteLog("GenerateForm", "DEBUG: GenerateForm SQL=" + sql + "\n");
                        }

                        try
                        {
                            cms.db.Open();
                            jRec = cms.db.GetFirstRow(sql);
                            cms.db.Close();
                        }
                        catch (Exception e) { content.append("ERROR: Query record failed. [err4646]<br>"); if (this.debugMode > 0) { Content.Append(e.ToString()); } return; }
                        //content.append("SQL=" + sql + "<br>");//DEBUG
                        string thisErr = "";
                        if (jRec == null) { thisErr = "ERROR: Query failed. [err4663]<br>"; }
                        if (jRec.jsonType == "null") { thisErr = "ERROR: Query failed. [err4664]<br>"; }
                        if (jRec.Status != 0) { thisErr = "ERROR: Query failed. [err4668]<br>"; }

                        if (thisErr != "")
                        {
                            if ((cms.urlParam("AllowCreate").toLowerCase() == "true") && (cms.user.userLevel > cms.SITE.MinCreateLevel))
                            {
                                // Even though the object was not found, we are allowed to create it
                                create = true;
                                thisErr = "";
                            }
                        }

                        if (thisErr != "")
                        {
                            content.append(thisErr);
                            if (this.debugMode > 0) { content.append("SQL=" + sql + "<br>"); }
                            return;
                        }
                    }
                }

                if (!create)
                {
                    //jRec=jRec[0]; // Get first row of returned recordset (there should only be one row)  - NO LONGER NEEDED - CHANGE TO iesDB Library TKT 5/13/2016
                    if (jRec["StorFormat"].CString().toLowerCase() == "parampak") { UnpakParamPak(jRec); }
                    if (flags.IndexOf("norecordid") >= 0)
                    {
                        // Even thought 'norecordid' means we do not select the record by means of a record id, we still need the primary key to know which
                        // record we are updating.
                        id = jRec[pk].CString();
                    }
                    //content.append("JSON=" + jRec.jsonString + "<br>");//DEBUG		
                }
                else
                {
                    jRec = new FlexJson("{}");
                    FlexJson rTags = new FlexJson("{}");
                    rTags["now"].Value = DateTime.Now.ToString();
                    rTags["world"].Value = cms.siteId;
                    rTags["worldid"].Value = cms.siteId;
                    rTags["userno"].Value = cms.UserNo;
                    rTags["userid"].Value = cms.UserID;

                    // NOTE: These values could come from the Edit Config Defaults below - ie. they can get overwritten.  Here we set overall defaults in case they are not set below.
                    jRec["MinViewLevel"].Value = cms.SITE.MinEditLevel;
                    jRec["MinEditLevel"].Value = cms.SITE.MinEditLevel;

                    // Load default values into jRec
                    FlexJson Defaults = this.editlistj.i("Defaults");
                    if (Defaults != null)
                    {
                        if (Defaults.Status == 0 && Defaults.jsonType != "null")
                        {
                            foreach (FlexJson df in Defaults)
                            {
                                string dfValue = Util.ReplaceTags(df.CString(), rTags, false, "{{", "}}");
                                jRec.addToBase(dfValue, df.Key);
                            } // end foreach
                        } // end if
                    } // end if
                }

                // Apply Override values to jRec  (these should be applied before being displayed (so user sees them if visible) and before save (to make sure they are always set)
                FlexJson Override = this.editlistj.i("Override");
                if (Override != null)
                {
                    if (Override.Status == 0 && Override.jsonType != "null")
                    {
                        foreach (FlexJson ovr in Override)
                        {
                            jRec.addToBase(ovr, ovr.Key);
                        } // end foreach
                    } // end if
                } // end if

                if (id != "" && id.toLowerCase() != "*new*" && ReadFromSource != "config")
                {
                    jRec["pageid"].Value = id;
                }
                // MinViewLevel should not be missing.  Add it if it is missing (even if this is not a new record)
                if (!jRec.Contains("MinViewLevel"))
                {
                    int defViewLevel = editlistj.i("Defaults").getInt("MinViewLevel",-1);
                    if (defViewLevel >= 0) { jRec["MinViewLevel"].Value = defViewLevel; }
                    else { jRec["MinViewLevel"].Value = cms.SITE.MinEditLevel; }
                }
                // MinEditLevel should not be missing.  Add it if it is missing (even if this is not a new record)
                if (!jRec.Contains("MinEditLevel"))
                {
                    int defEditLevel = this.editlistj.i("Defaults").getInt("MinEditLevel",-1);
                    if (defEditLevel >= 0) { jRec["MinEditLevel"].Value = defEditLevel; }
                    else { jRec["MinEditLevel"].Value = cms.SITE.MinEditLevel; }
                }

                string neededEclass = "";
                neededEclass = eClassOverride;
                if (this.isNullOrWhiteSpace(neededEclass)) { neededEclass = cms.urlParam("eclass"); }
                string pkHidden = "<input type='hidden' id='fld_" + pk + "' name='fld_" + pk + "' value='" + id + "'/>";
                content.append("<form id='editlistform'><input type='hidden' id='eClass' name='eClass' value='" + neededEclass + "'/>" +
                    "<TABLE border=0 width=1050 cellpadding=0><TBODY>");

                // DISPLAY NEW RECORD BANNER if specified
                if (create && (this.editlistj.getStr("ShowNewBanner").trim().toLowerCase() == "true"))
                {
                    content.append("<tr><td colspan=2 align=left><Font size=3 color=#309040><B>*** NEW RECORD ***</B></td></tr>");
                }

                // *** FIELD SET #1 - wObject RECORD fields **********************************

                bool ShowField;
                string sType, sWidth, sHeight, sNote, sFlags, dValue, dFieldName, sAlias, sClass;
                StringBuilder HiddenFields = new StringBuilder();
                int cnt = 0;

                string gSpecialFlags = this.editlistj.getStr("SpecialFlags").toLowerCase();
                string ShowAllParams = this.editlistj.getStr("ShowAllParams").toLowerCase();
                string UserEntersNewKey = this.editlistj.getStr("UserEntersNewKey").toLowerCase();
                foreach (FlexJson field in this.editlistj.i("EditFields"))
                {
                    dValue = "";
                    ShowField = true;
                    dFieldName = Util.NoBracket(field["Field"].CString());
                    sAlias = field["Alias"].CString().Trim();
                    if (sAlias == "") { sAlias = dFieldName; }

                    sFlags = field["Flags"].CString();
                    sType = field["Type"].CString();
                    sClass = field["Class"].CString();
                    sWidth = field["Width"].CString();
                    sHeight = field["Height"].CString();
                    sNote = field["Note"].CString();

                    autoFillInfo = field["Autofill"].jsonString;

                    if (autoFillInfo == "null")
                    {
                        autoFillInfo = "";
                    }
                    if (Util.Left(sType, 5).toLowerCase() == "json_")
                    {
                        dValue = jRec[dFieldName].jsonString;
                    }
                    else
                    {
                        dValue = jRec[dFieldName].CString();
                    }
                    //if (sType.Trim().toLowerCase()=="json") { dValue=jRec[dFieldName].jsonString; }  // FUTURE: THIS DID NOT WORK
                    if (create)
                    {
                        if (sFlags.IndexOf("p") >= 0 && (UserEntersNewKey != "true"))
                        {
                            ShowField = false;
                            if (gSpecialFlags.IndexOf("shownew") >= 0) { ShowField = true; }
                        }
                    }
                    if ((ShowAllParams == "true") && jRec.Contains(dFieldName)) { jRec.RemoveFromBase(dFieldName); }
                    //cms.Response.Write("DEBUG: Field=" + dFieldName + ", Flags=" + sFlags + ", Value=" + dValue);

                    if (dFieldName.toLowerCase() == pk.toLowerCase()) { pkHidden = ""; }
                    dFieldName = "fld_" + dFieldName;  // DO NOT Add fld_ prefix - this is done in MakeEditRow
                    if (ShowField == true) { content.append(MakeEditRow(sAlias, dFieldName, sType, sClass, sFlags, sWidth, sHeight, dValue, sNote, cms, create, bViewOnly, HiddenFields, autoFillInfo)); }

                    cnt++;
                    if (cnt > 99999) { break; }  //*** Safety
                } // End foreach

                // Display the remaining fields in jRec - if specified
                if (ShowAllParams == "true")
                {
                    foreach (FlexJson field2 in jRec)
                    {
                        dValue = "";
                        if (!create) { dValue = field2.CString(); }
                        if (field2.Key.toLowerCase() == pk.toLowerCase()) { pkHidden = ""; }
                        content.append(MakeEditRow(field2.Key, "fld_" + field2.Key, "text", "", "", "160", "", dValue, "", cms, create, bViewOnly, HiddenFields));
                        cnt++;
                        if (cnt > 99999) { break; }  //*** Safety
                    }
                }

                // FUTURE: Display second set of fields if high enough UserLevel
                // FUTURE: If SHOWALL then show remaining fields in jRec (as text box)
                content.append("</TABLE>" + pkHidden + HiddenFields.ToString());
                //Add Buttons to the form
                //if (!bViewOnly){
                //	content.append("<input type='button' name='Save2' value='Save' onclick='SaveItem(false);return false;'>");
                //}
                content.append("</form>");
                if (cnt <= 0) { content.append("<br><br><span style='color:#C04040;'>Record not found.</span><br><br><br>"); }

            }
            catch (Exception e99)
            {
                // If we are an admin, then display the error message
                if (cms.user.userLevel >= cms.SITE.MinAdminLevel)
                {
                    content.append("ERROR: AdminFunctions.CreateForm: " + e99.ToString() + "<br>\n");
                }
            }
        }

        public string MakeEditRow(string fAlias, string fID, string fType, string sClass, string fFlags, string fWidth, string fHeight, string fValue, string sNote, cmsInfo cms, bool IsNew, bool bViewOnly, StringBuilder HiddenFields, string AutoFillInfo = "")
        {
            string sRet = "", bld = "";
            bool Processed = false;
            bool meViewOnly = bViewOnly;
            bool meRequired = false;

            //Custom.MakeEditRow(ref fAlias,ref fID,ref fType,ref fFlags, ref fWidth, ref fValue, cms, ref meViewOnly, ref sRet, ref Processed);
            if (Processed) { return sRet; }

            string fTypeLower = fType.toLowerCase();
            string fFlagsLower = fFlags.toLowerCase();
            if (fFlagsLower.IndexOf("b") >= 0) { bld = " class='bold' "; }
            if (fFlagsLower.IndexOf("r") >= 0) { meRequired = true; } // Required field
            if (fFlagsLower.IndexOf("l") >= 0) { meViewOnly = true; } // Lock field
            if (IsNew && (fFlagsLower.IndexOf("a") >= 0)) { meViewOnly = false; } // UNlock field when ADDING a record
            string sNote2 = sNote.Trim();
            if (sNote2 != "") { sNote2 = "<span class='FieldNote'>" + sNote2 + "</span>"; }
            string mEditRow = "<tr><td width=200 valign=top" + bld + ">" + fAlias + ":</td><td>";
            string mEditRow2 = sNote2 + "</td></tr>";

            if (Util.Left(fTypeLower, 5) == "list-")
            {
                switch (Util.Mid(fTypeLower, 5, 999))
                {
                    case "status":
                        // FUTURE: NEED TO MAKE THIS LIST DYNAMIC - AND SET VALUE BASED ON dValue
                        / ***
                        sRet = "<select id='" + fID + "' name='"+ fID + "'";
                        if (meViewOnly){ sRet += " disabled"; }					
                        sRet += "><option value='Active' selected>Active</option><option value='Inactive'>Inactive</option><option value='Deleted'>Deleted</option></select>";
                        *** /
                        FlexJson pListJson3 = new FlexJson("[[\"Active\",\"Active\"],[\"Inactive\",\"Inactive\"],[\"Deleted\",\"Deleted\"]]");
                        sRet = GenerateDD(pListJson3, fID, fWidth, fValue, meViewOnly, meRequired, sClass, true, "");
                        
                        break;

                    case "templates":

                          FlexJson pListJson4 = new FlexJson("[]" );

                        // pListJson4.addToBase(new FlexJson("[\"Main\",\"Main\"]"));
                         //pListJson4.addToBase(new FlexJson("[\"Joe\",\"Joe\"]"));

                   string readPath = cms.SITE.TemplateFolder;

                   if (Directory.Exists(readPath))
                    {
                        DirectoryInfo d = new DirectoryInfo(readPath);
                        FileInfo[] Files = d.GetFiles("layout_*.cfg"); //Getting layout cfg files	
                        foreach (FileInfo file in Files)
                        {
                                             
                           string templatelayout = Path.GetFileNameWithoutExtension(file.Name); 

                                templatelayout = Util.Mid(templatelayout, 7);   

                                FlexJson templateItem = new FlexJson("[]");  

                                templateItem.add(templatelayout);  
                                templateItem.add(templatelayout);   

                                pListJson4.addToBase(templateItem);
                        }
                    }
                        sRet = GenerateDD(pListJson4, fID, fWidth, fValue, meViewOnly, meRequired, sClass, true, "");
                     break;               


                }



                fTypeLower = "list";
            }

            if (Util.Left(fTypeLower, 6) == "plist-")
            {
                FlexJson pList = this.editlistj.i(fType);
                if ((pList.Status == 0) && (pList.jsonType != "null"))
                {
                    string pListType = pList["ListType"].CString();
                    bool IncludeCurrent = true;
                    if (pList.Contains("IncludeCurrent"))
                    {
                        if (pList["IncludeCurrent"].CString().toLowerCase() == "false") { IncludeCurrent = false; }
                    }
                    string AddNull = null;
                    if (pList.Contains("AddBlank"))
                    {  // AddBlank is the old method - to be replaced by AddNull
                        if (pList["AddBlank"].CString().toLowerCase() == "true") { AddNull = ""; }
                    }
                    if (pList.Contains("AddNull"))
                    {  // AddNull indicates a string/value to display in place of Null (for blank, set this to "")
                        AddNull = pList["AddNull"].CString();
                    }
                    switch (pListType.toLowerCase())
                    {
                        case "sql":
                            FlexJson pListData = cms.db.GetDataReaderAll(pList["sql"].CString());
                            if ((pListData.Status == 0) && (pListData.jsonType != "null"))
                            {
                                sRet = GenerateDD(pListData, fID, fWidth, fValue, meViewOnly, meRequired, sClass, IncludeCurrent, AddNull);
                            }
                            break;
                        case "json":
                            FlexJson pListJson = pList["data"];
                            if ((pListJson.Status == 0) && (pListJson.jsonType != "null"))
                            {
                                sRet = GenerateDD(pListJson, fID, fWidth, fValue, meViewOnly, meRequired, sClass, IncludeCurrent, AddNull);
                            }
                            break;
                        default:
                            sRet = "Invalid pList type encountered: " + pListType + ", " + pList + " [err1331]";
                            break;
                    }
                }
                fTypeLower = "plist";
            }

            switch (fTypeLower)
            {
                case "text":
                    sRet = mkTextBox(fID, fWidth, fValue, meViewOnly, meRequired, false, sClass);
                    break;
                case "note":
                case "textarea":
                    sRet = mkTextArea(fID, fWidth, fHeight, fValue, meViewOnly, meRequired, sClass);
                    break;
                case "json_list":  // FUTURE: THIS DID NOT WORK
                    sRet = mkTextBox(fID, fWidth, fValue, meViewOnly, meRequired, false, sClass, AutoFillInfo);
                    break;
                case "richtext":
                    sRet = mkTextArea(fID, fWidth, fHeight, fValue, meViewOnly, meRequired, sClass + " richtext");
                    // We also need this to be on one row...
                    mEditRow = "<tr><td colspan='2' width=200 valign=top" + bld + ">" + fAlias + ":<br>";
                    break;
                case "password":
                    sRet = mkTextBox(fID, fWidth, "*******", meViewOnly, meRequired, false, sClass);
                    break;
                case "hidden":
                    sRet = mkHidden(fID, fWidth, fValue, meViewOnly, sClass);
                    HiddenFields.Append(sRet);
                    return ""; //Exit without creating a row
                    break;
                case "date":
                    sRet = mkDateBox(fID, fWidth, fValue, meViewOnly, meRequired, true, sClass);
                    break;
                case "datetime":
                    sRet = mkDateBox(fID, fWidth, fValue, meViewOnly, meRequired, false, sClass);
                    break;
                case "list":
                case "plist":
                    break;  // No error - this was handled above.
                default:
                    sRet = "Invalid field type encountered: " + fType + " [err1321]";
                    break;
            }

            return mEditRow + sRet + mEditRow2;
        }

        public static string mkDateBox(string fID, string nWidth, string fValue, bool bViewOnly, bool isRequired, bool isDateField = false, string cssClass = "")
        {
            string w = "", fc = "class='", d = "";
            string[] valueParts;
            if (nWidth.Trim() != "") { w = "width:" + nWidth + ";"; }
            if (bViewOnly) { fc += " locked"; d = " readonly "; }  // do not use 'disabled' because the field is excluded from the submit
            if (isRequired) { fc += " required"; }
            if (isDateField)
            {
                if (!this.isNullOrWhiteSpace(fValue))
                {
                    valueParts = fValue.Split(' ');
                    fValue = valueParts[0];
                }
            }
            fc += "'";
            return "<input type='text' class='datepicker' id='" + fID + "' name='" + fID + "' value='" + fValue + "' style='float:left;margin-right:8px;" + w + "' " + d + fc + "><a href='#' class='cleardate' id='" + fID + "'>reset</a>";
        }

        public static string mkTextBox(string fID, string nWidth, string fValue, bool bViewOnly, bool isRequired, bool isDateField = false, string cssClass = "", string AutoFillInfo = "")
        {
            string w = "", fc = "class='", d = "";
            StringBuilder returnString = new StringBuilder();
            string[] valueParts;
            fc += cssClass;
            if (nWidth.Trim() != "") { w = "width:" + nWidth + ";"; }
            if (bViewOnly) { fc += " locked"; d = " readonly "; }  // do not use 'disabled' because the field is excluded from the submit
            if (isRequired) { fc += " required"; }
            if (isDateField)
            {
                if (!this.isNullOrWhiteSpace(fValue))
                {
                    valueParts = fValue.Split(' ');
                    fValue = valueParts[0];
                }
            }
            fc += "'";
            returnString.Append("<input type='textbox' id='" + fID + "' name='" + fID + "' value=\"" + fValue + "\" style='float:left;margin-right:8px;" + w + "' " + d + fc + ">");
            if (!this.isNullOrWhiteSpace(AutoFillInfo))
            {
                FlexJson autoFillDetails = new FlexJson();
                try
                {
                    autoFillDetails.Deserialize(AutoFillInfo);
                    returnString.Append("<a ");
                    foreach (FlexJson fillField in autoFillDetails)
                    {
                        returnString.Append(fillField.Key + " = '" + fillField.CString() + "' ");
                    }
                    returnString.Append("configname='" + fID + "' href='#' class='autofill'><span class='ui-icon ui-icon-circle-plus'></span></b>");
                }
                catch (Exception)
                {
                    //Do nothing
                }
            }
            return returnString.ToString();
        }

        public static string mkTextArea(string fID, string nWidth, string nHeight, string fValue, bool bViewOnly, bool isRequired, string cssClass = "")
        {
            string w = "", fc = "class='", d = "";
            // string cssClasses = "";
            if (!this.isNullOrWhiteSpace(nWidth)) { w = w + "width:" + nWidth + ";"; }
            if (!this.isNullOrWhiteSpace(nHeight)) { w = w + "height:" + nHeight + ";"; }
            if (!this.isNullOrWhiteSpace(cssClass)) { fc += " " + cssClass; }
            if (bViewOnly) { fc += " locked"; d = " disabled "; }
            if (isRequired) { fc += " required"; }
            fc += "'";
            string fValueAdj = fValue.Replace("<textarea", "&lt;textarea").Replace("</textarea", "&lt;/textarea");
            return "<textarea id='" + fID + "' name='" + fID + "' style='float:left;margin-right:8px;" + w + "' " + d + fc + ">" + fValueAdj + "</textarea>";
        }

        public static string mkHidden(string fID, string nWidth, string fValue, bool bViewOnly, string sClass)
        {
            return "<input type='hidden' id='" + fID + "' name='" + fID + "' class='" + sClass + "' value='" + fValue + "'>";
        }

        public static string GenerateDD(FlexJson ddJson, string fID, string nWidth, string fValue, bool bViewOnly, bool isRequired, string sClass = "", bool includeCurrent = true, string AddNull = null)
        {
            string fValLower = fValue.toLowerCase();
            StringBuilder oOpt = new StringBuilder();
            string oSelected = "";
            foreach (FlexJson jRow in ddJson)
            {
                string jValue = jRow[0].CString();
                string jTitle = jRow[1].CString();
                //if ((jValue.toLowerCase()==fValLower) && (fValLower!="")) {  // If the dropdown contains a blank, then we need to match it here (if the fValue is also blank)
                if (jValue.toLowerCase() == fValLower)
                {
                    oSelected = "<option value='" + jValue + "' selected>" + jTitle + "</option>";
                }
                else
                {
                    oOpt.Append("<option value='" + jValue + "'>" + jTitle + "</option>");
                }
            }
            if ((fValue != "") && (oSelected == ""))
            {
                // Selected value fValue was provided, but not found in the list.  Make a row so that the dropdown does not wipeout this value.
                // But ONLY IF includeCurrent==true
                if (includeCurrent) { oSelected = "<option value='" + fValue + "' selected>" + fValue + "</option>"; }
            }
            string w = "", fc = "class='", blank = "", d = "";
            if (nWidth.Trim() != "") { w = "width:" + nWidth + ";"; }
            if (bViewOnly) { fc += " locked"; d = " disabled "; }
            if (isRequired) { fc += " required"; }
            if (AddNull != null) { blank = "<option value=''>" + AddNull + "</option>"; }
            fc += "'";
            string ret = "<select id='" + fID + "' name='" + fID + "' style='float:left;margin-right:8px;" + w + "' " + d + fc + ">" + blank + oSelected + oOpt.ToString() + "</select>";
            return ret;
        }
        */

    /* ************************************************************************************************* */
    /* ******************************************** SUPPORT ROUTINES *********************************** */
    /* ************************************************************************************************* */

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

    setPermissionLevels() {
        this.minViewLevel = this.SITE.i("defaultMinViewLevel").toNum(999); // default value
        this.minEditLevel = this.SITE.i("defaultMinEditLevel").toNum(999); // default value
        this.minAdminLevel = this.SITE.i("defaultMinAdminLevel").toNum(999); // default value
    }

    PrepForJsonReturn(ret) {
        this.resultType = 'json';
        if (!this.ReturnJson) {
            this.ReturnJson = {};
        }
        if (ret) {
            if (!ret.ReturnJson) {
                ret.ReturnJson = {};
            }
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
    // Each cfg1-4 is optional but if included should be an FlexJson object of replacement fields/tags
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
    // Returns an object {content,jsonHeader (as  FlexJson),foundHeader,status,errMsg}
    // Note: If ContentField is specified, then the content of the HTML file is
    //    added to the htmlFile JSON object AND is returned as the return parameter
    // UserViewLevel: Set this value if you would like to have this routine check MinViewLevel in the header 
    //    and BLANK OUT content_area (return value) if user does not have sufficient permissions to view content
    // status: 0=success, <0 indicates failed
    LoadHtmlFile(cfgFilePath, htmlFile, ContentField = "content_area", UserViewLevel = -1) {
        let status = -9; // default status = 'failed'
        let errMsg = "";
        let jsonHeader = new FlexJson("{}");
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
                htmlFile.addToBase(fileContent, ContentField);
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

    MakeSearch(oFields, oSearch, mysqlDate = false) {
        let p1cnt = 0;
        let p2cnt = 0;
        let qry = new StringBuilder();
        let FieldList = this.SplitStr(oFields, ",");
        let SearchList = this.SplitStr(oSearch, ", *%");

        // **** Search Criteria
        if (SearchList.length > 0) {
            p1cnt = 0;
            if (qry.length > 0) { qry.append(") AND ("); }
            SearchList.forEach(p1 => {
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

    // FieldList must be an FlexJson object
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
    SplitStr(inputString, CharList) {
        let cnt = 0;
        let LastF = 0;
        let ListLen = CharList.length;
        let px = 0;
        let f = 0;
        let s = "";
        let safety = 9999;
        let newStr = "";

        let ret = [];

        if (typeof inputString !== 'string' || inputString === null) { return ret; } // cannot parse a null or error

        let nString = inputString + '';
        if (nString.length <= 0) { return ret; }
        do {
            f = 999999;
            for (px = 0; px < ListLen; px++) {
                s = nString.indexOf(CharList.substr(px, 1), LastF);
                if ((s > 0) && (s < f)) { f = s; }
            } // End for
            if (f >= 999999) { break; }
            newStr = nString.substr(LastF, f - LastF);
            if (newStr.trim() != "") {
                cnt = cnt + 1;
                ret.push(newStr);
            }
            LastF = f + 1;
            if (safety-- <= 0) { break; }
        } while (true);
        if (LastF < nString.length) { newStr = nString.substr(LastF, (nString.length) - LastF); }
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

            let pwdRS = await this.db.GetDataReader(sql);
            let pwdData = pwdRS.GetAllRecords();

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

                pwdData.forEach(userRec => {
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
                        return; // no need to check additional records (break out of forEach)

                    }  // *** n_Pwd!="" && n_Pwd==Login_Pwd
                       //CheckDBerr(ErrMsg)

                    cnt = cnt + 1;
                    if (cnt > 999) { return; } // *** Safety (break out of forEach)
                                              //if (ErrMsg!="") { break; } // *** Saftey - FUTURE
                }); // end for each
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
            let d = new Date();
            let dash = "-";
            return d.getFullYear() + dash +
                  pad(d.getMonth() + 1) + dash +
                  pad(d.getDate()) + dash +
                  pad(d.getHours()) + dash +
                  pad(d.getMinutes()) + dash +
                  pad(d.getSeconds())
        }

        datetimeNormal() {
            function pad(n) { return n < 10 ? "0" + n : n }
            let d = new Date();
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
            let d = new Date();
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
                var form_w = '';
                Object.entries(source).forEach(([key, value]) => {
                    var fld=key;
                    var val=(value + '').trim();
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

                    if (fld.toLowerCase()=="form_w") { form_w = val; }

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
                //var form_w =source.form_w || ''; // form_w is collected above
                if ( form_w.toLowerCase() != this.siteId.trim().toLowerCase()) {
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

    configureSpamFilter(SpamFolderSite,SpamFolderCommon,SetSpamConfigFile,SetSpamLibFile) {
        if (!SpamFolderSite) {
            SpamFolderSite = this.getParamStr("SpamFolder","",true,false);
        }
        if (!SpamFolderCommon) {
            SpamFolderCommon = this.getParamStr("SpamFolderCommon","",true,false);
        }
        this.spamFilter = new iesSpamFilter(SpamFolderSite,SpamFolderCommon,SetSpamConfigFile,SetSpamLibFile);
    }
	
    // *************************************************************************************** SaveFormToLog()
    async saveFormToLog(strFormID, formData, maxLength=-1, spamLevel=0, spamReason='') {

        var dt = this.dbDatetime();
        var flds = JSON.stringify(formData);
        var sql="INSERT INTO wlog (siteid, FormID, SubmitDate, SpamLevel, SpamReason, Params) " +
            " VALUES ('" + this.siteId + "','" + strFormID + "', '" + dt + "', " + 
            spamLevel + ", " + this.db.dbStr(spamReason,-1,true) + "," +
            this.db.dbStr(flds,maxLength,true)
            + ")";
        //this.logMessage(0,'DEBUG: sql=' + sql); // DEBUG FUTURE REMOVE THIS LINE
        await this.db.ExecuteSQL(sql);

        //*** FUTURE: Check for database errors using .then().catch()

    } // End Function

    // *******************************************************************************************
    // *******************************************************************************************
    // *******************************************************************************************
    // Section to handle dynamic table edit/forms processing/record updates/etc

    // EDITLIST - future:indicate success/failure
    editlistconfig = ""; // static variable to hold name of most recent config that has been loaded
    editlisterror = "";
    editlistj = null;
    LoadEditListIfNeeded(eClassOverride = "")
    {
        let eclass = eClassOverride.trim().toLowerCase();
        this.editlisterror = "";
        if (!eclass) { eclass = this.FormOrUrlParam("eclass","").trim().toLowerCase(); }
        let eclassfile = "eclass-" + eclass + ".cfg";
        if (eclass != this.editlistconfig)
        {
            //Need to load config file
            let configpath = this.FindFileInFolders(eclassfile, this.getParamStr("ConfigFolder"), this.getParamStr("DefaultConfigFolder"), this.getParamStr("CommonConfigFolder"));
            if (!configpath)
            {
                this.editlisterror = "Config file not found: " + eclassfile + " [err7971]";
                return;
            }
            this.editlistj = new FlexJson();
            this.editlistj.DeserializeFlexFile(configpath, false, 0, 0); // 0,0 does not keep Comments or Spacing
            if (this.editlistj.Status == 0)
            { // no JSON errors
                this.editlistconfig = eclass;
            }
            else {
                this.editlistconfig = ""; // Error loading config
                // this.editlistj = null;  // Leave this object for now so we can debug errors. FUTURE: remove object?
            }
        }
        if (this.editlistconfig == "" && this.editlisterror == "")
        {
            this.editlisterror = "Failed to load config file: " + eclassfile + " [" + this.editlistj.Status + "][err7972]\nERROR REASON: " + this.editlistj.statusMsg;
        }
    }

    // Get a list of columns (string) from an editclass config file (JSON)
    // Three output formats:
    //   out.Cols=csv (comma separated list)
    //   out.ColsHtml=html table header row
    //   out.ColsJS=Javascript list of data field names (for jquery.datatables)
    GetColumns(out)
    {
            let sField = "";
            let sTitle = "";
            let sWidth = 0;
            let sAs = "";
            let sClass = "";
            let vClass = "";
            let sFlags = "";
            let noPrimaryKey = true;
            let cols = new StringBuilder();
            //StringBuilder colsHtml=new StringBuilder();
            let jsCols = new FlexJson("[]");
            var node; // to hold json Node
            try
            {
                let sep = '';
                let a = this.editlistj.i("SearchList");
                let b = a.toJsonArray();
                b.forEach( (fld) =>
                {
                    sWidth = fld.getStr("Width").trim();
                    sField = fld.getStr("Field").trim();
                    sTitle = fld.getStr("Alias").trim();
                    sClass = fld.getStr("Class").trim();
                    vClass = fld.getStr("vClass").trim();
                    sFlags = fld.getStr("Flags").trim();
                    sAs = fld.getStr("As").trim();  // If field is a sub-query "(SELECT...) as Foo" then set As:Foo

                    if (sField == this.editlistj.getStr("primaryKey").trim()) { noPrimaryKey = false; } //check if the field is a primary key
                    cols.append(sep + sField);
                    sep = ',';

                    if (this.isNullOrWhiteSpace(sAs)) { sAs = sField; }  // If no AS then set AS to the field name.
                    else { cols.append(" as " + sAs); } // Apply 'as' portion to Query field

                    if (sTitle == "") { sTitle = sAs; }  // If no alias then set alias title to the field name.
                    if (sWidth != "" && sWidth != "0")
                    {
                        //colsHtml.append("<td>" + sTitle + "</td>"); 
                        node = new FlexJson("{}");
                        node.add(sTitle.replace(/`/g, ""),"sTitle");   // DEBUG: + "[" + sWidth + "]";
                        if (sFlags.indexOf("l") >= 0) { node.add("class","editRow"); }
                        node.add(sAs.replace(/`/g, ""),"data");
                        if (!this.isNullOrWhiteSpace(sClass)) { node.add(node.getStr("class") + " " + sClass,"class"); }
                        if (!this.isNullOrWhiteSpace(vClass)) { node.add(vClass, "vclass"); }
                        jsCols.addToBase(node);
                    }
                });
                if (noPrimaryKey)
                { //if there is still no primary key in the columns, then add one.
                    cols.append("," + this.editlistj.getStr("primaryKey").trim());
                }
            }
            catch (eee) { console.log(eee); }
            out.Cols = cols.toString();
            //out.acolsHtml=colsHtml.toString();
            out.ColsJS = jsCols.jsonString;
        }

        EditFormSecurityLevel()
        {
            let Permit = 0;  //Default=No Access
            let ViewSecLevel = this.editlistj.getNum("ViewSecLevel",99);
            let EditSecLevel = this.editlistj.getNum("EditSecLevel",99);
            let AdminSecLevel = this.editlistj.getNum("AdminSecLevel",99);
            // FUTURE: If flag OwnerCanEdit, then check the owner of the object and if that is this user, allow edit.
            if (this.user.userLevel >= ViewSecLevel) { Permit = 1; }   //Allow VIEW ONLY Mode
            if (this.user.userLevel >= EditSecLevel) { Permit = 3; }   //Allow Edit Mode
            if (this.user.userLevel >= AdminSecLevel) { Permit = 7; }  //Allow Admin Mode
            return Permit;
        }

        // ************************************************************************************************************
        // **************** ReplaceStringTags() - alternate to ReplaceTags() that uses one set of JSON items to fill tags in one string
        // **************** Replaces [[Tags]] with values from a FlexJson object.
        // **************** If a [[Tag]] is not found in tagValues then...
        // ****************   If SetNoMatchBlank=true Then the tag is replaced with ""
        // ****************   If SetNoMatchBlank=false Then the tag is left in the string.
        // ****************
        // FUTURE: Do we need both ReplaceStringTags and tagReplaceString()
        ReplaceStringTags(inputString, tagValues /* FlexJson obj */, SetNoMatchBlank = true, startStr = "[[", endStr = "]]", lvl = 0)
        {
            let charPosition = 0;
            let beginning = 0;
            let startPos = 0;
            let endPos = 0;
            let data = new StringBuilder();

            // Safety - keep from causing an infinite loop.
            lvl = lvl + 1;
            if (lvl > 99) { return inputString; }

            do
            {
                // Let's look for our tags to replace
                charPosition = inputString.indexOf(startStr, endPos);
                if (charPosition >= 0)
                {
                    startPos = charPosition;
                    endPos = inputString.indexOf(endStr, startPos);
                    if (endPos < 0)
                    {
                        // We did not find a matching end ]].  Break out of loop.
                        charPosition = -2;
                    }
                    else
                    {
                        // We found a match...
                        let tag = inputString.substring(startPos + startStr.length, endPos);

                        let replacement = "";
                        // Check to see if tagValues contains a value for this field.
                        if (tagValues.contains(tag))
                        {
                            // Yes it does.
                            replacement = tagValues.getStr(tag);

                            // Check if our replacement string has [[tags]] that need to be replaced
                            let pt = replacement.indexOf(startStr);
                            if (pt >= 0)
                            {
                                // Recursive call to replace [[tags]]
                                let replace2 = this.ReplaceStringTags(replacement, tagValues, SetNoMatchBlank, startStr, endStr, lvl);
                                replacement = replace2;
                            }
                        }
                        else
                        {
                            // No it does not contain tag
                            if (SetNoMatchBlank == false) { replacement = startStr + tag + endStr; }
                        }

                        data.append(inputString.substring(beginning, startPos));
                        data.append(replacement);
                        beginning = endPos + endStr.length;
                    }  // End if (endPos<0) else
                }  // End if (charPosition >= 0)
            } while (charPosition >= 0);

            if (beginning < (inputString.length))
            {
                data.append(inputString.substring(beginning));
            }

            return data.toString();
        } // END ReplaceStringTags()


    toInt(sObj, nDefault = 0) {
        let ret = nDefault;
        try {
            ret = parseInt(sObj + "");
        }
        catch (Exception) {
            ret = nDefault;
        }
        if (isNaN(ret) || ret === null) { return nDefault; }
        return ret;
    }

    toBool(sObj, nDefault = false) {
        try {
          switch (typeof sObj) {
            case "boolean":
                return sObj;
            case "string":
                switch(sObj.trim().toLowerCase()) {
                    case "f":
                    case "false":
                    case "0":
                    case "":
                        return false;
                    default: // t, true, 1, or any non-blank stringn = TRUE
                        return true;
                }
            case "null":
                return nDefault;
            default: // any non-null object = TRUE
                return true;
            }
        }
        catch {  }  // on error return default
        return nDefault;
    }

    isNullOrWhiteSpace( input ) {
        return !input || !(input + '').trim();
      }

}

module.exports = iesCommonLib;