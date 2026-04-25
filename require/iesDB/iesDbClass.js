/*
Copyright 2019 Ted Tyree - ieSimplified.com

Permission is hereby granted, free of charge, to any person obtaining a copy of this
software and associated documentation files (the "Software"), to deal in the Software
without restriction, including without limitation the rights to use, copy, modify,
merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to the
following conditions:

The above copyright notice and this permission notice shall be included in all copies
or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE
OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

// iesDB version 1.0 JS - Simple light-weight DB Interface Class for .js
// Allows JSON to be passed into DB records and also read from DB records.
// Copyright 2021 - Ted Tyree - ieSimplified, LLC - All rights reserved.
// ****************************************************

// **************************************************************************
// ***************************  iesDB  **************************************
// **************************************************************************
//
// NOTE: Current version of iesDB only supports one set of db connection credentials
// FUTURE: Allow multiple named databases (sets of credentials)
//
// NOTE: Two approaches to using this library/factory
//  1) cms.db should be set to a single instance of this factory.
//     Upon the first call to read/write from/to the database, this factory will create
//     a connection object and keep it open.
//     subsequent calls use the same connection.
//     When the cms object is destroyed, the connection is closed and destroyed
//  2) You can call cms.db.createConnection to get a new/separate db connection object
//     Use that object to interact with the database 1 or more times
//     Close/destroy the object
//     (this approach allows various sections of the code to act independant of each other
//     but also may cause multiple "connect to database" actions in a single call)

// FUTURE FUTURE FUTURE: DO NOT USE FlexJson in DB methods - return plain JS objects instead
// PostGres returns JSONB as JS objects, so it already has the flexibilty we were trying to create

const FlexJson = require('../FlexJson/FlexJsonClass.js');
const iesDataReader = require('./iesDataReaderClass.js');
const fs = require('fs');
const pg = require('pg');

class iesDB {

    DBClass = "pg";
    DefaultDB = ""; // There can no longer be a default DB
    status = 0;
    statusMessage = "";
    ConnectStatus = 0;
    iesConnection = null;
    ConnectObj = null; // CONNECT CREDENTIALS: { host, [db], user, password }
    dbName = "";
    CmdStatus = 0;
    CmdStatusMessage = "";
    // Store table definition for 1 table to make repetitive data writes to the same table faster.
    TableForColumnNames = "";
    columnNames = null; // FlexJson object
    historyTable = "whistory"; // future: populate this parameter from SITE config or SERVER config
    debugMode = 0; // set to 9 to get all error messages & detail (FUTURE: need to develop this further)

	constructor(dbName, connectObj, dbClass) {
        // Accept either:
        //   Separate args    → new iesDbClass(dbName, connectObj, dbClass)
        //   Plain JS object  → new iesDbClass({ dbName, host, user, password, [port], [dbClass] })
        //   FlexJson object  → new iesDbClass(flexJsonCfg)  — dbName from 'dbName' or legacy 'databasename'
        if (dbName && typeof dbName === 'object') {
            let cfg = dbName;
            if (typeof cfg.getStr === 'function') {
                // FlexJson — extract named fields and convert to plain object
                cfg = cfg.toNative();
                if (!cfg.dbName) { cfg.dbName = cfg.databasename; } // some older site.cfg files specify databasename instead of dbName
            }
            // cfg is now a plain JS object
            dbName  = cfg.dbName  || '';
            dbClass = cfg.dbClass || dbClass;
            const { dbName: _n, dbClass: _c, ...connFields } = cfg;
            connectObj = connFields;
        }
		if (dbClass) { this.DBClass = dbClass; }
        if (connectObj) {
            // Accept FlexJson as connectObj — normalize to plain object
            this.ConnectObj = (typeof connectObj.toNative === 'function') ? connectObj.toNative() : connectObj;
            if (!this.ConnectObj.db) { this.ConnectObj.db = this.DefaultDB; }
        }
        console.log("DEBUG: iesDB.constructor.dbName='" + dbName + "'");
        this.dbName = (dbName || '').replace(/-/g, '_');
	}

    //============================================================================== BEGIN HERE

    Open() // async - may be used with .Then()
    {
        return new Promise(async (resolve,reject) => {
            if (this.ConnectStatus == 1) { resolve(false); return; } // indicate we were already open: needToClose=false

            // Verify that we have the data needed to connect...
            if (!this.ConnectObj || !this.ConnectObj.host || !this.ConnectObj.user || !this.ConnectObj.password)
            {
                this.status = -9;
                this.statusMessage = "No database connect object specified. [err0009]";
                //throw new Error(this.statusMessage);
                reject(this.statusMessage); return;
            }

            try {
                this.iesConnection = null;
                this.iesConnection = new pg.Client({
                    host: this.ConnectObj.host,
                    user: this.ConnectObj.user,
                    password: this.ConnectObj.password,
                    database: this.dbName, // not from ConnectObj
                    port: 5432
                });
                await this.iesConnection.connect();
            } catch (ex) {
                this.status = -14;
                this.statusMessage = "ERROR: createConnection failed. [err0014]";
                //throw new Error(this.statusMessage);
                reject(this.statusMessage); return;
            }

            this.ConnectStatus = 1;
            resolve(true); return;
        });
    } // end Open()

    // Close() - only call this after we are done all DB work
    // modified code to close the connection after all processing is complete (in app.js)
    Close(ignore = false) { // async
        return new Promise(async (resolve,reject) => {
            try
            {
                if (this.ConnectStatus == 1) { await this.iesConnection.end(); }

                this.status = 0;
                this.statusMessage = "";
                this.iesConnection = null;
                this.ConnectStatus = 0;
                resolve(true); return;
            }
            catch (ex)
            {
                this.iesConnection = null;
                this.ConnectStatus = 0;
                if (!ignore) {
                    this.status = -23;
                    this.statusMessage = "Close failed: " + ex.message;
                    throw new Error(this.statusMessage);
                }
                reject("Close failed."); return;
            }
        });
    }

    setConnectObj(iConnectObj) {  // async
        return new Promise(async (resolve,reject) => {
            try {
                //await this.Close();
                this.ConnectObj = iConnectObj;
                resolve(true); return;
            } catch (err) {
                console.log ("ERROR: setConnectObj(): " + err);
                reject("ERROR: setConnectObj(): failed."); return;
            }
        });
    }

    dbStr(strVal, maxLength = -1, addQuotes = true)
    {
        let newVal = strVal.replace(/'/g, "''"); // Single quotes must be doubled; backslashes are literal in PostgreSQL
        if (maxLength > 0) { if (newVal.length > maxLength) { newVal = newVal.substring(0, maxLength); } }
        if (addQuotes) { newVal = "'" + newVal + "'"; }
        return newVal;
    }

        // GetDataReader()
        // Runs a SQL statement and returns an iesDataReader (recordset)
        // NOTE! If we OPEN the connection here, the calling function needs to CLOSE the connection!
        // FUTURE: REMOVE THIS FUNCTION OR THE ONE AFTER IT...
        GetDataReader_OLD(sql) { // async
            return new Promise(async (resolve,reject) => {
                const func="GetDataReader()";
                try {
                    if (this.ConnectStatus != 1) { await this.Open(); }
                    if (this.ConnectStatus == 1)
                    {
                        let dr = await this.iGetDataReader(this.iesConnection, sql);
                        if (dr) { resolve(dr); return; }
                        return;
                    }
                    reject(this.errPipe(func,"[ERR7455]")); return;
                } catch (err) {
                    reject(this.errPipe(func,"[ERR7453]",err)); return;
                }
            });
        }

        GetDataReader(sql, asJS = false) { // async
            return new Promise(async (resolve,reject) => {
                const func="GetDataReader()";
                this.Open()
                    .then( needToClose => {
                        this.iGetDataReader(this.iesConnection, sql, asJS)
                            .then( dr => {
                                resolve(dr); return;
                            })
                            .catch(err2 => {
                                reject(this.errPipe(func,"ERR7553",err2)); return;

                            });

                    });
            });
        }


        // FUTURE: Is this needed? Why not just call query?
        iGetDataReader(iConnect, sql, asJS = false) { // async
            return new Promise(async (resolve,reject) => {
                iConnect.query(sql, (err, result) => {
                    if (err) {
                        this.status = -377; // query error
                        this.statusMessage = "ERROR: Query failed: " + err.message;
                        console.log(this.statusMessage);
                        reject(this.statusMessage); return;
                        }
                    const rows = result.rows;
                    if (asJS) { resolve(rows); return; }
                    let newDR = new iesDataReader(this, rows);
                    resolve(newDR); return;
                });
            });
        }

        //DEFAULT-PARAMETERS
        //public FlexJson GetDataReaderAll(string sql) { return GetDataReaderAll(sql, false); }
        //public FlexJson GetDataReaderAll(string sql, bool AsArray) {
            // Instead of this function, use "GetAllRecords" in iesDataReaderClass
        GetDataReaderAll(sql, AsArray = false) { // sync
            throw new Error("ERROR: DO NOT USE iGetDataReaderAll() [ERR9991]");

        }

        //DEFAULT-PARAMETERS
        //public FlexJson GetDataReaderAll(MySqlConnection iConnect, string sql) { return GetDataReaderAll(iConnect,sql,false); }
        //public FlexJson GetDataReaderAll(MySqlConnection iConnect, string sql, bool AsArray) {
            // Instead of this function, use "GetAllRecords" in iesDataReaderClass
        static iGetDataReaderAll(iConnect, sql, AsArray = false, ReturnPartial = false) { // async
            throw new Error("ERROR: DO NOT USE iGetDataReaderAll() [ERR9992]");
        }

        GetFirstRow(sql, asJS = false) { // async
            return new Promise(async (resolve,reject) => {
                try {
                    let ret = null;
                    if (this.ConnectStatus != 1) { await this.Open(); }
                    if (this.ConnectStatus == 1) { ret = await this.iGetFirstRow(this.iesConnection, sql, asJS); }
                    resolve(ret);  return; // Error
                } catch (err) {
                    console.log("ERROR: GetFirstRow(): " + err);
                    //throw new Error('ERROR: GetFirstRow(): failed.');
                    reject('ERROR: GetFirstRow(): failed.'); return;
                }
            });
        }

        iGetFirstRow(iConnect, sql, asJS = false) { // async
            return new Promise(async (resolve,reject) => {
                try
                {
                    let jDR = await this.iGetDataReader(iConnect, sql, asJS);
                    if (jDR && jDR.length > 0)
                    {
                        if (asJS) { resolve(jDR[0]); return; }
                        let newRow = jDR.Read();
                        resolve (newRow); return;
                    }
                    if (asJS) { resolve({}); return; }
                    resolve( new FlexJson("{}")); return;
                }
                catch (err) {
                    console.log("ERROR: iGetFirstRow(): " + err);
                    reject('ERROR: iGetFirstRow(): failed.'); return;
                }
            });
        }

        GetCount(sTable, strWhere) { // async
            return new Promise(async (resolve,reject) => {
                try {
                    let sqlWhere = strWhere.trim();
                    if (!sqlWhere) { if (sqlWhere.slice(0,5).toUpperCase() != "WHERE") { sqlWhere = " WHERE " + sqlWhere; } }
                    let sql = "SELECT COUNT(*) FROM " + sTable + " " + sqlWhere;
                    let rs = await this.GetFirstRow(sql,true); // js object
                    // PostgreSQL returns COUNT(*) as column named 'count' (lowercase)
                    if (rs)
                    {
                        try
                        {
                            let rowCount = parseInt(rs['count']);
                            resolve(rowCount); return;
                        }
                        catch {
                            reject('ERROR: GetCount(): toNum failed.'); return;
                        }
                    }
                    reject('ERROR: GetCount(): data not found.'); return;
                } catch (err) {
                    console.log("ERROR: GetCount(): " + err);
                    reject('ERROR: GetCount(): failed.'); return;
                }
            });
        }

        // This function should be modeled after this.GetDataReader
        ExecuteSQL(sql) {
            return new Promise(async (resolve,reject) => {
                const func="ExecuteSQL()";
                this.Open()
                    .then( needToClose => {
                        this.iExecuteSQL(this.iesConnection, sql)
                            .then( dr => {
                                resolve(dr); return;
                            })
                            .catch(err2 => {
                                reject(this.errPipe(func,"ERR7753",err2)); return;
                            });
                    });
            });
        }

        // This function should be modeled after iGetDataReader()
        iExecuteSQL(iConnect, sql) {
            return new Promise(async (resolve,reject) => {
                iConnect.query(sql, (err, result) => {
                    if (err) {
                        this.status = -477; // query error
                        this.statusMessage = "ERROR: Query failed: " + err.message;
                        console.log(this.statusMessage);
                        reject(this.statusMessage); return;
                        }
                    resolve(result); return;
                });
            });
        }

        isNullOrWhiteSpace( input ) {
            return !input || !(input + '').trim();
          }

       errPipe(func,errId,errMessage = "") {
        let errmsg = "ERROR: " + func + " [" + errId + "]";
        console.log(errmsg + " " + errMessage);
        if (this.debugMode > 5) { errmsg += " " + errMessage; }
        return(errmsg);
       }

} // end Class

module.exports = iesDB;
