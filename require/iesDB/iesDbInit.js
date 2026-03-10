// iesDbInit.js
// Initializes site databases during app startup.
// Called once for each site found in ./websites/ that has db_enabled:true in its site-db.jfx.
//
// For each enabled site:
//   1. Reads site-db.jfx to get the site-specific table list
//   2. Reads cmsCommon/db/all-sites-db.jfx to get the common table list
//   3. Merges and deduplicates the two lists
//   4. Connects to the PostgreSQL 'postgres' admin DB to create the site database if missing
//   5. Connects to the site database and creates any missing tables using .sql files
//      (looks in the site's db/ folder first, then falls back to cmsCommon/db/)
//
// Errors are logged to both console and the startup debugFile (if provided).
// Successful creates are also logged so startup activity is visible in PM2 logs.

const { existsSync, readFileSync, appendFileSync } = require('fs');
const pg = require('pg');
const FlexJson = require('../FlexJson/FlexJsonClass.js');

const COMMON_DB_PATH = './cmsCommon/db';
const COMMON_DB_JFX  = COMMON_DB_PATH + '/all-sites-db.jfx';

// -----------------------------------------------------------------------
// dbLog — write to console and optionally to the startup debug file
function dbLog(msg, debugFile, toConsole = true) {
    if (toConsole) { console.log(msg); }
    if (debugFile) {
        try { appendFileSync(debugFile, msg + '\n'); } catch {}
    }
}

// -----------------------------------------------------------------------
// parseConnectString — parse postgresql://user:password@host:port/dbname
function parseConnectString(connectStr) {
    try {
        const u = new URL(connectStr);
        return {
            host:     u.hostname,
            port:     parseInt(u.port) || 5432,
            user:     decodeURIComponent(u.username),
            password: decodeURIComponent(u.password),
            database: u.pathname.replace(/^\//, '')
        };
    } catch {
        return null;
    }
}

// -----------------------------------------------------------------------
// dbExists — check if a PostgreSQL database exists (query pg_database)
async function dbExists(client, dbName) {
    const res = await client.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [dbName]
    );
    return res.rows.length > 0;
}

// -----------------------------------------------------------------------
// tableExists — check if a table exists in the public schema
async function tableExists(client, tableName) {
    const res = await client.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1`,
        [tableName.toLowerCase()]
    );
    return res.rows.length > 0;
}

// -----------------------------------------------------------------------
// initSiteDatabase — initialise one site's database
async function initSiteDatabase(siteId, connInfo, debugFile) {
    const prefix = `[DB-INIT][${siteId}]`;

    // --- Read site-db.jfx ---
    const siteDbPath = `./websites/${siteId}/db/site-db.jfx`;
    if (!existsSync(siteDbPath)) { return; } // not configured — skip silently

    let siteDbCfg = new FlexJson();
    siteDbCfg.DeserializeFlexFile(siteDbPath);
    if (siteDbCfg.Status != 0) {
        dbLog(`${prefix} ERROR: Failed to parse ${siteDbPath}: ${siteDbCfg.statusMsg}`, debugFile);
        return;
    }

    // --- Check db_enabled ---
    if (!siteDbCfg.getBool('db_enabled', false)) { return; } // disabled — skip silently

    // --- Derive DB name from SiteID (hyphens → underscores) ---
    const dbName = siteId.replace(/-/g, '_');
    dbLog(`${prefix} db_enabled=true, database=${dbName}`, debugFile);

    // --- Build merged table list (common first, then site-specific) ---
    let allTables = [];

    if (existsSync(COMMON_DB_JFX)) {
        let commonCfg = new FlexJson();
        commonCfg.DeserializeFlexFile(COMMON_DB_JFX);
        if (commonCfg.Status == 0) {
            commonCfg.i('tables').toJsonArray().forEach(t => {
                let name = t.toStr().trim();
                if (name && !allTables.includes(name)) { allTables.push(name); }
            });
        } else {
            dbLog(`${prefix} WARNING: Failed to parse ${COMMON_DB_JFX}`, debugFile);
        }
    }

    siteDbCfg.i('tables').toJsonArray().forEach(t => {
        let name = t.toStr().trim();
        if (name && !allTables.includes(name)) { allTables.push(name); }
    });

    dbLog(`${prefix} Tables to ensure: [${allTables.join(', ')}]`, debugFile);

    // -----------------------------------------------------------------------
    // Step A: Connect to the 'postgres' admin DB to create the site DB if needed
    const adminClient = new pg.Client({ ...connInfo, database: 'postgres' });

    try {
        await adminClient.connect();
    } catch (err) {
        dbLog(`${prefix} ERROR: Cannot connect to postgres admin DB: ${err.message}`, debugFile);
        return;
    }

    try {
        if (await dbExists(adminClient, dbName)) {
            dbLog(`${prefix} Database already exists: ${dbName}`, debugFile, false);
        } else {
            // CREATE DATABASE cannot run inside a transaction; pg uses autocommit by default
            await adminClient.query(`CREATE DATABASE "${dbName}"`);
            dbLog(`${prefix} Created database: ${dbName}`, debugFile);
        }
    } catch (err) {
        dbLog(`${prefix} ERROR: Failed to create database '${dbName}': ${err.message}`, debugFile);
        await adminClient.end();
        return;
    } finally {
        await adminClient.end();
    }

    // -----------------------------------------------------------------------
    // Step B: Connect to the site DB and create any missing tables
    const siteClient = new pg.Client({ ...connInfo, database: dbName });

    try {
        await siteClient.connect();
    } catch (err) {
        dbLog(`${prefix} ERROR: Cannot connect to database '${dbName}': ${err.message}`, debugFile);
        return;
    }

    try {
        for (const tableName of allTables) {
            // Resolve SQL file: site-local folder first, then cmsCommon/db
            const localSql  = `./websites/${siteId}/db/table-${tableName}.sql`;
            const commonSql = `${COMMON_DB_PATH}/table-${tableName}.sql`;
            let sqlPath = null;
            if      (existsSync(localSql))  { sqlPath = localSql; }
            else if (existsSync(commonSql)) { sqlPath = commonSql; }

            if (!sqlPath) {
                dbLog(`${prefix} WARNING: No SQL file found for table '${tableName}'`, debugFile);
                continue;
            }

            // Skip if table already exists
            if (await tableExists(siteClient, tableName)) {
                continue;
            }

            // Create the table
            try {
                const sql = readFileSync(sqlPath, 'utf8');
                await siteClient.query(sql);
                dbLog(`${prefix} Created table: ${tableName} (${sqlPath})`, debugFile);
            } catch (err) {
                dbLog(`${prefix} ERROR: Failed to create table '${tableName}': ${err.message}`, debugFile);
            }
        }
    } finally {
        await siteClient.end();
    }
}

// -----------------------------------------------------------------------
// initSiteDatabases — entry point, iterates siteList sequentially
async function initSiteDatabases(siteList, serverCfg, debugFile) {
    const connectStr = serverCfg.getStr('db1_connect', '');
    if (!connectStr) {
        console.log('[DB-INIT] No db1_connect in server config — skipping DB initialization.');
        return;
    }

    const connInfo = parseConnectString(connectStr);
    if (!connInfo) {
        console.log('[DB-INIT] ERROR: Could not parse db1_connect connection string.');
        if (debugFile) { appendFileSync(debugFile, '[DB-INIT] ERROR: Could not parse db1_connect.\n'); }
        return;
    }

    for (const siteId of siteList) {
        try {
            await initSiteDatabase(siteId, connInfo, debugFile);
        } catch (err) {
            const msg = `[DB-INIT][${siteId}] Unexpected error: ${err.message}`;
            console.log(msg);
            if (debugFile) { try { appendFileSync(debugFile, msg + '\n'); } catch {} }
        }
    }

    console.log('[DB-INIT] Database initialization complete.');
    if (debugFile) { appendFileSync(debugFile, '[DB-INIT] Database initialization complete.\n'); }
}

module.exports = initSiteDatabases;
