# iesCMS-node
Outrageously simple content management system (CMS) for NodeJS
UNDER DEVELOPMENT

This CMS is being modeled after iesCMS which is a C# based CMS.  Also relatively simple, but has been complicated by C#, Windows Server, IIS requirements beyond our control.  It is time to break free!

# RUN  (currently on serverPort 8118)
node app.js
or
Open app.js in VS Code and select Run > Start Debugging
browse to > localhost:8118

Use localhost:8118/home?mimic=<siteid> to mimic a specific website for testing

# DEBUGGING
Open app.js in the editor (select the app.js tab if not selected)
Select Run > Start Debugging
Select "Node.js"
Navigate to http://localhost:8118

# INSTALL
copy entire iesCMS-node folder to server > /var/www/iescms
NOTE: May not want to overwite websites folder (since each site may be managed elsewhere)
NOTE: May need to update /secrets/server.cfg if there were structure changes to that file
Key folders/files
  app.js
  /iesCommon
  /node_modules  (or run 'npm i' as mentioned below)
  /require  (exclude website_*.js ... but include website_hostsite.js)
NOTE: May need to run 'npm i' in /var/www/iescms to get node_modules
open a folder in the root installation and run npm install string-builder 


# CONVERT WEBSITE TO iesCMS-Node
1) rename site.cfg to all lowercase letters (linux/node is case sensitive)
2) fix any json errors in site.cfg (example: fixed a missing quote)
3) Change "baseFolder" in site.cfg to...
   ,baseFolder:"[[SERVER_FOLDER]]/websites/[[SiteID]]"
4) changed url of logo in top left corner to "/" (it was index.html)
5) update other page links to remove ".html" or ".ashx" suffix
6) migrate any custom tags (if needed, you will need to create a custom class for the website)
7) test website locally for all functionality

# Build backdoor login for top-level admin
cd /util
node makeTruffle.js
Enter userid/pwd of BD Admin
>> this reads /secrets/server.cfg (parameters: truffleId, ServerId)
>> this generates /secrets/trufflebd.cfg