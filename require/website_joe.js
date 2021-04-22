const _siteID = 'joe';
var assignedSiteID = '';

class webEngine {

    constructor(thisSiteID) {
        assignedSiteID = thisSiteID;
    	}

    CreateHtml(cms) {
        cms.Html = "Joe HTML";
        return;
    }

    CustomTags(tag,content) {
        switch (tag.toLowerCase()) {
            case "tag2":
                content = "tag2_content";
                break;
        }
    }
}

module.exports = webEngine;