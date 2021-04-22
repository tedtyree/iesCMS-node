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
       // if (this.invalidSiteID(cms)) { return; }
        cms.Html = "hostsite HTML";
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