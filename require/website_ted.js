const _siteID = 'hostsite';
var assignedSiteID = '';

class webEngine {

    constructor(thisSiteID) {
        assignedSiteID = thisSiteID;
    	}

    CreateHtml(cms) {
        cms.Html = "ted HTML";
        return;
    }

    CustomTags(tag,content) {
        switch (tag.toLowerCase()) {
            case "tag3":
                content = "tag3_content";
                break;
        }
    }
}

module.exports = webEngine;