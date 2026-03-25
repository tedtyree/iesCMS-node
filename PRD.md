# iesCMS - NodeJS

Super simple content management system (CMS)leveraging NodeJS.

What makes it unique:

- Very easy to install/setup and config a new website
- Each website is contained within its own folder
- Optional .js extensions can be added per website; require/website_<id>.js
- Front-end is very much HTML/CSS/JS ... not a complex proprietary framework
- Tag replacement is built in
- Flex JSON config files make it easy to read and manage the server, system, and each website.

   NOTE: Uses Flex JSON: https://www.npmjs.com/package/flex-json

NOTE: Each requirement below is given a tag. In the sources code, the tags will be used to identify portions of the code that implement that requirement.

## Folder/Extensions per Website [#REQ-FOLDER-01]

- Each website is contained within its own folder [#REQ-FOLDER-01-01]  
- Folder name is also used as a VID (visual ID) for the website [#REQ-FOLDER-01-02]
- Optional .js extensions can be added per website; require/website_<id>.js [#REQ-FOLDER-01-03]
- If no require provided for a website, a default common engine will be used [#REQ-FOLDER-01-04]
- The website engine can replace the entire common engine OR can extend/override specific parts of it [#REQ-FOLDER-01-05] esp for things like tag definitions/functionality and api endpoints.
- API endpoints are not typical NodeJS routes. Instead there is a single command endpoint that handles all API requests. [#REQ-FOLDER-01-06] - currently "cmd" but could be changed in the future to "api" or other standard.
- Optional CustomForms() can be added per website in the custom engine to process forms that are unique to the website [#REQ-FOLDER-01-07]
- Not yet implemented? handleEvents() can be added per website in the custom engine to extend functionality for events per website [#REQ-FOLDER-01-08]
- The admin-extras.cfg in pages folder is an extension of the admin page and can be used to add custom menu options/functionality to the admin page [#REQ-FOLDER-01-09]

## Database per Website [#REQ-DB-01]

- Websites can load and run without a database (users will not be able to self-manage their accounts/content) [#REQ-DB-01-01]

## Config Files and Layers [#REQ-CONFIG-01]

- FlexJSON config files make it easy to read and manage - and config for each layer:
  - the server [#REQ-CONFIG-01-01]
  - each website [#REQ-CONFIG-01-02]
  - each page as a header block [#REQ-CONFIG-01-03]
- Each tag can refer to other tags using a sub-tag reference for example: site.cfg can contain a property ,HomeURL:"http://[[www]].[[URLHost]]" where [[www]] and [[URLHost]] are sub-tags that will be replaced with their actual values. [#REQ-CONFIG-01-04]
- Configs from page, site, server get merged/layered such that a tag in a page could come from any of the layers. [[page_title]] would first look in the page header config, then the site config (maybe a defualt vlaue), and then the server config. [#REQ-CONFIG-01-05]

## Common support functions to handle standard functionality across websites [#REQ-COMMON-01]

- Common support functions are provided to handle standard functionality across websites [#REQ-COMMON-01-01]
    - Reaplcetags() - replaces [[tags]] in content with values from the config (or in some cases a custome process)
    - getParamStr() - gets a parameter from the configs
    - LoadHTMLfile() - loads an HTML file and processes it with Reaplcetags()

## Ideas

- Allow tag replacements in JS, CSS, and other documents? Would this slow things down or create awesome flexibility such as specifying a color #00A5B9 that will be used in many locations throughout the app?
- Make FlexJson object iterable + easy way to convert to a traditional JSON object
