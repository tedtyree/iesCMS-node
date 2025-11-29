const _siteID = 'joe';
var assignedSiteID = '';

class webEngine {

    constructor(thisSiteID) {
        assignedSiteID = thisSiteID;
    	}

    async CreateHtml(cms) {
        cms.Html = "Joe HTML";
        return;
    }

    async CustomTags(tag,content) {
        switch (tag.toLowerCase()) {
            case "tag2":
                content = "tag2_content";
                break;
        }
    }
}

module.exports = webEngine;