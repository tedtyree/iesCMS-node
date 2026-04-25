# iesCMS-node
Outrageously simple content management system (CMS) for NodeJS
UNDER DEVELOPMENT

 - Made for web developers and website managers managing many sites for multiple customers. Fully configurable.
 - Does not require compiling.
 - Each website content is contained within their folder.
   Optional .js extensions can be added per website.
   require/website_<id>.js
 - Each website is given an "id" used as the folder name,
   the name of the option website js extensions, and a tag
   used in the database to mark records belonging to that site.
 - Pages:
   - Each *.cfg in the websites/<id>/pages folder corresponds to a web page on the website. 
   - It includes a header with page parameters 
   - Includes [[tags]] that get replaced at runtime.
 - Template files:
   - Each page specifies a template file (usually the header and footer of the page) 
   - found in the templates/ folder - format layout_<template_name>.cfg 
   - also contains [[tags]] that get replaced at runtime.

NOTE: Uses Flex Json: https://www.npmjs.com/package/flex-json

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
NOTE: Do not overwite websites folder (since each site should be managed it its own repo)
NOTE: May need to update /secrets/server.cfg if there were structure changes to that file
Copy websites/hostsite/require/website_hostsite.js to require/website_hostsite.js
Key folders/files
  app.js
  /iesCommon
  /node_modules  (or run 'npm i' as mentioned below)
  /require  (exclude website_*.js ... but include website_hostsite.js)
Run 'npm i' in /var/www/iescms to get node_modules
open a folder in the root installation and run npm install string-builder 
Start the app using PM2 (preinstalled pm2 on the server)

# Install each website
Websites should each be their own git repository. 
 - Copy/clone website files/folders to websites/<id> 
 - copy websites/<id>/require/website_<id>.js to require/website_<id>.js
 - site.cfg contains core site parameters - update as needed
 - For development purposes they can be included in the websites/ folder but are ignored by the parent git repository.
 - Restart the iesCMS app so that it sees the website config (and optional .js)

Rather than cloning the iesCMS to one location on the server (a github sync) and then copying it to a production location - on s3 we are triyng out just cloning directly to the production location and running it from there. See deploy_s3.sh

Rather than cloning each website to a git sync location and then copying it to the production location, on s3 I cloned each website directly into the websites/ folder and renamed it to the proper <id>. Then the deploy_s3_site.sh script will pull the latest changes - copy website_<id>.js as needed, and restart the iesCMS server.

So everything is being cloned to the specific location on s3.

# /orig Folder — Protected Original Site Reference

Each website can optionally include an `orig/` subfolder containing a complete original HTML website (typically with `index.html` as the home page). This is useful during active development — the developer can view the original HTML design alongside the in-progress CMS version.

Access to `/orig/**` is gated by the `origMinViewLevel` parameter in `site.cfg`:

| Value | Behavior |
|---|---|
| (absent) | Defaults to `1` — requires any logged-in user |
| `0` | Publicly accessible — no login required |
| `1`–`9` | Requires a user with that minimum access level |

If a user without sufficient access tries to reach any `/orig/...` URL, the CMS redirects them to the site's login page (with the original URL as a `deeplink` query parameter).

Example `site.cfg` entry:
```
,origMinViewLevel:1  // protect the /orig folder — requires login
```

This feature is implemented entirely in `app.js` and requires no per-site engine customization.

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

# Run app on server using pm2
login to server using ssh
sudo su - s57app
cd /var/www/iescms
pm2 start app.js  (see notes in server setup doc)
pm2 list
# restart app
pm2 restart app

# Apache2 setup
Typical example config if port defined as 8118...
<VirtualHost *:80>
    ProxyPass /.well-known !
    ServerName <domain>
    ErrorLog /var/log/apache2/<domain>.error.log
    CustomLog /var/log/apache2/<domain>.requests.log combined
    ProxyRequests On
    ProxyPass / http://localhost:8118/
    ProxyPassReverse / http://localhost:8118/
</VirtualHost>
