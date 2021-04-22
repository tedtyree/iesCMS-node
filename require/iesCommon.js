class iesCommonLib {

    constructor() { }

    AdminTags(tag,content) {
        switch (tag.toLowerCase()) {
            case "tagz":
                content = "tagz_content";
                break;
        }
    }
}

module.exports = iesCommonLib;