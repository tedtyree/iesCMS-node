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

const iesJSON = require('../iesJSON/iesJsonClass.js');
const iesDataReader = require('./iesDataReaderClass.js');
const fs = require('fs');
const mysql = require('mysql');

class iesDB {
	
    DBClass = "mysql";  // Options: mysql, sqlserver  (The routines below are based on MySQL)
    status = 0;
    statusMessage = "";
    ConnectStatus = 0;
    iesConnection = null;
    ConnectObj = null; // { host, user, password }
    CmdStatus = 0;
    CmdStatusMessage = "";
    // Store table definition for 1 table to make repetitive data writes to the same table faster.
    TableForColumnNames = "";
    columnNames = null; // iesJSON object
    historyTable = "whistory"; // future: populate this parameter from SITE config or SERVER config


	constructor(connectObj,dbClass) {
		if (dbClass) { this.DBClass = dbClass; }
        if (connectObj) { this.ConnectObj = connectObj; }
	}

    //============================================================================== BEGIN HERE 
    
    Open() // async
    {
        return new Promise((resolve,reject) => {
            if (this.ConnectStatus == 1) { resolve(true); }

            // Verify that we have the data needed to connect...
            if (!this.ConnectObj || !this.ConnectObj.host || !this.ConnectObj.user || !this.ConnectObj.password)
            {
                this.status = -9;
                this.statusMessage = "No database connect object specified. [err0009]";
                //throw new Error(this.statusMessage);
                reject(this.statusMessage);
            }

            try {
                this.iesConnection = null;
                // FUTURE: Need to add error handling
                this.iesConnection = mysql.createConnection({
                    host: this.ConnectObj.host,
                    user: this.ConnectObj.user,
                    password: this.ConnectObj.password,
                    database: 'wpl',
                    port: 3306
                });
            } catch {
                this.status = -14;
                this.statusMessage = "ERROR: createConnection failed. [err0014]";
                //throw new Error(this.statusMessage);
                reject(this.statusMessage);
            }

            try {
                // FUTURE: Need to add error handling
                this.iesConnection.connect((err) => {
                    if (err) {
                        this.status = -349;
                        this.statusMessage = "ERROR: Failed to connect to database server: " + err;
                        console.log(this.statusMessage);
                        // throw new Error(this.statusMessage);
                        reject(this.statusMessage);
                    } else {
                        console.log('DEBUGGER: Connect to database server successful!');
                        this.ConnectStatus = 1;
                        this.status = 0;
                        this.statusMessage = "";
                        resolve(true);
                    }
                });
            }
            catch (ex)
            {
                this.status = -7;
                this.statusMessage = "Failed to open database: " + ex.message;
                console.log("ERROR: " + statusMessage);
                this.ConnectStatus = 0;
                this.Close(true, e => undefined);  // Do not await results
                //throw new Error(this.statusMessage);
                reject(this.statusMessage);
            }
        });
    } // end Open()

    Close(ignore = false) { // async
        return new Promise(async (resolve,reject) => {
            try
            {
                if (this.ConnectStatus == 1) { await this.iesConnection.end(); }

                status = 0;
                statusMessage = "";
                this.iesConnection = null;
                this.ConnectStatus = 0;
                resolve(true);
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
                reject("Close failed.");
            }
        });
    }

    setConnectObj(iConnectObj) {  // async
        return new Promise(async (resolve,reject) => {
            try {
                await this.Close();
                this.ConnectObj = iConnectObj;
                resolve(true);
            } catch (err) {
                console.log ("ERROR: setConnectObj(): " + err);
                reject("ERROR: setConnectObj(): failed.");
            }
        });
    }

    dbStr(strVal, maxLength = -1, addQuotes = true)
    {
        let newVal = strVal.replace(/'/g, "''").replace(/\\/g, "\\\\"); // Single Quotes and Backslashes must be doubled in an INSERT string
        if (maxLength > 0) { if (newVal.length > maxLength) { newVal = newVal.substring(0, maxLength); } }
        if (addQuotes) { newVal = "'" + newVal + "'"; }
        return newVal;
    }

    /* HERE HERE HERE ============================================================

        public static string dbDateTime(string strVal, string includeDateTime = "DT", string DefaultError = "NULL", bool addQuotes = true)
        {
            DateTime dDate = Convert.ToDateTime(strVal);
            return dbDateTime(dDate, includeDateTime, DefaultError, addQuotes);
        }

        public static string dbDateTime(DateTime dVal, string includeDateTime = "DT", string DefaultError = "NULL", bool addQuotes = true)
        {
            string ret = DefaultError;  // Value to return upon ERROR or as DEFAULT value
            try
            {
                switch (includeDateTime.ToUpper())
                {
                    case "D":
                        ret = dVal.ToString("yyyy-MM-dd");
                        break;
                    case "T":
                        ret = dVal.ToString("HH:mm:ss");
                        break;
                    case "DT":
                        ret = dVal.ToString("yyyy-MM-dd HH:mm:ss");
                        break;
                        // no default - leave default value in ret
                }
            }
            catch (System.Exception)
            {
            }
            if (addQuotes) { ret = "'" + ret + "'"; }
            return ret;
        }

        public static string Left(string val, int numChars)
        {
            if (val == null) return val;
            if (numChars <= 0) return "";
            if (numChars >= val.Length) return val;
            return val.Substring(0, numChars);
        }

        // UNLIKE VB - "start" IS ZERO BASED
        public static string Mid(string val, int start)
        {
            if (val == null) return val;
            if ((start < 0) || (start >= val.Length)) return "";
            return val.Substring(start);
        }
        public static string Mid(string val, int start, int numChars)
        {
            if (val == null) return val;
            if ((numChars <= 0) || (start < 0) || (start >= val.Length)) return "";
            if ((start + numChars) <= val.Length) return val.Substring(start, numChars);
            return val.Substring(start);
        }

        // GetDataReader()
        // Runs a SQL statement and returns an iesDataReader (recordset)
        // NOTE! If we OPEN the connection here, the calling function needs to CLOSE the connection!
        public iesDataReader GetDataReader(string sql)
        {
            if (ConnectStatus != 1) { Open(); }
            if (ConnectStatus == 1) { return GetDataReader(iesConnection, sql); }
            return null;  // Error
        }
*/
        // FUTURE: Is this needed? Why not just call query?
        iGetDataReader(iConnect, sql) { // async
            return new Promise(async (resolve,reject) => {
                iConnect.query(sql, (err,data) => {
                    if (err) { 
                        this.status = -377; // query error
                        this.statusMessage = "ERROR: Query failed: " + err.message;
                        console.log(this.statusMessage);
                        reject(this.statusMessage);
                        }
                    resolve(data);
                });
            });
        }
/*
        //DEFAULT-PARAMETERS
        //public iesJSON GetDataReaderAll(string sql) { return GetDataReaderAll(sql, false); }
        //public iesJSON GetDataReaderAll(string sql, bool AsArray) {
        public iesJSON GetDataReaderAll(string sql, bool AsArray = false)
        {
            bool NeedToClose = false;
            if (ConnectStatus != 1) { Open(); NeedToClose = true; }
            if (ConnectStatus == 1)
            {
                iesJSON jAll = GetDataReaderAll(iesConnection, sql, AsArray);
                if (jAll.Status != 0) { this.status = jAll.Status; }
                if (NeedToClose) { Close(); }
                return jAll;
            }
            if (NeedToClose) { Close(); }
            return null;  // Error
        }

        //DEFAULT-PARAMETERS
        //public iesJSON GetDataReaderAll(MySqlConnection iConnect, string sql) { return GetDataReaderAll(iConnect,sql,false); }
        //public iesJSON GetDataReaderAll(MySqlConnection iConnect, string sql, bool AsArray) {
        public static iesJSON GetDataReaderAll(MySqlConnection iConnect, string sql, bool AsArray = false, bool ReturnPartial = false)
        {
            iesJSON jAll = new iesJSON("[]");
            try
            {
                iesDataReader jDR = GetDataReader(iConnect, sql);
                jDR.AsArray = AsArray;  // Allows data to be returned as a JSON Array rather than a JSON Object
                if (!(jDR == null))
                {
                    iesJSON jRow;
                    while (jDR.Read())
                    {
                        jRow = jDR.GetJSON();
                        jAll.AddToArrayBase(jRow);
                    }
                    jDR.Close();
                    return jAll;
                }
            }
            catch { }
            if (ReturnPartial == false) { jAll = new iesJSON("[]"); }
            jAll.InvalidateStatus(-34); // Indicate there was an error during processing (but still return array... which may be empty or have partial data)
            return jAll;
        }

        // GetDataObjFromRows()
        // This routine selects a set of rows and converts them into a single iesJSON Object where the 'key' value of each row becomes the key values in the object.
        // If SingleValueField!="" then the specified field is the value of each key/value pair (rather than making each attribute a row-object)
        // Example: sql="SELECT UserID as Key, LastName, FirstName, Age FROM UserTable"
        // 			iesJSON jObj=db.GetDataObjFromRows(sql,"Key",true);
        //   Returns {11:{"LastName":"Smith","FirstName":"John","Age":41},
        //				12:{"LastName":"Smith","FirstName":"Frank","Age":29},
        //				13:{"LastName":"Jones","FirstName":"Jannette","Age":45} }
        // Example 2: sql="SELECT UserID, FullName FROM UserTable"
        //          iesJSON jObj=db.GetDataObjFromRows(sql,"UserID",false,"FullName");
        //   Returns: {11:"John Smith",12:"Frank Smith",13:"Jannette Jones"}
        public iesJSON GetDataObjFromRows(string sql, string KeyField = "Key", bool removeKeyField = false, string SingleValueField = "")
        {
            bool NeedToClose = false;
            if (ConnectStatus != 1) { Open(); NeedToClose = true; }
            if (ConnectStatus == 1)
            {
                iesJSON jAll = GetDataObjFromRows(iesConnection, sql, KeyField, removeKeyField, SingleValueField);
                if (jAll.Status != 0) { this.status = jAll.Status; }
                if (NeedToClose) { Close(); }
                return jAll;
            }
            if (NeedToClose) { Close(); }
            return null;  // Error
        }
        public static iesJSON GetDataObjFromRows(MySqlConnection iConnect, string sql, string KeyField = "Key", bool removeKeyField = false, string SingleValueField = "")
        {
            bool isSingleValue = false;
            if (SingleValueField != "") { isSingleValue = true; }
            iesJSON jAll = new iesJSON("{}");
            try
            {
                iesDataReader jDR = GetDataReader(iConnect, sql);
                if (!(jDR == null))
                {
                    iesJSON jRow;
                    string Key;
                    while (jDR.Read())
                    {
                        jRow = jDR.GetJSON();
                        Key = jRow.GetStr(KeyField);
                        if (removeKeyField == true) { jRow.RemoveFromBase(KeyField); }
                        if (isSingleValue)
                        {
                            string jItem = jRow.GetStr(SingleValueField);  /// FUTURE handle data types other than String
                            jAll.AddToObjBase(Key, jItem);
                        }
                        else
                        {
                            jRow.Key = Key;
                            jAll.AddToObjBase(Key, jRow);
                        }
                    } // end while
                    jDR.Close();
                    return jAll;
                } // end if (!(jDR == null))
            } // end try
            catch { }
            jAll = new iesJSON("{}");  // FUTURE: Allow return of partial data in obj?
            jAll.InvalidateStatus(-37); // Indicate there was an error during processing (but still return array... which may be empty or have partial data)
            return jAll;
        }
*/
        GetFirstRow(sql) { // async
            return new Promise(async (resolve,reject) => {
                try {
                    let ret = null;
                    let NeedToClose = false;
                    if (this.ConnectStatus != 1) { await this.Open(); NeedToClose = true; }
                    if (this.ConnectStatus == 1) { ret = await this.iGetFirstRow(this.iesConnection, sql); }
                    if (NeedToClose) { await this.Close(); }
                    resolve(ret);  // Error
                } catch (err) {
                    console.log("ERROR: GetFirstRow(): " + err);
                    //throw new Error('ERROR: GetFirstRow(): failed.');
                    reject('ERROR: GetFirstRow(): failed.');
                }
            });
        }

        iGetFirstRow(iConnect, sql) { // async
            return new Promise(async (resolve,reject) => {
                try
                {
                    let jAll = new iesJSON("[]");
                    let jDR = await this.iGetDataReader(iConnect, sql);
                    if (jDR)
                    {
                        let jRow; // iesJSON object
                        if (jDR.Read())
                        {
                            jRow = jDR.GetJSON();
                            jAll.AddToArrayBase(jRow);
                        }
                        await jDR.Close();
                        resolve(jAll.i(0));  // NOTE: If no record was found, this will return an iesJSON "null" with no parent defined
                    }
                    reject("Error iGetFirstRow()");
                }
                catch (err) {
                    console.log("ERROR: iGetFirstRow(): " + err);
                    reject('ERROR: iGetFirstRow(): failed.');
                }
            });
        }
/*
        //Ran into trouble thinking of a nice way to do a single row return based 
        //DEFAULT-PARAMETERS
        //public iesDataReader GetTable(string tablename) { return GetTable(tablename,"",""); }
        //public iesDataReader GetTable(string tablename, string where) { return GetTable(tablename,where,""); }
        //public iesDataReader GetTable(string tablename, string where, string orderby) {
        // NOTE! If we OPEN the connection here, the calling function needs to CLOSE the connection!
        public iesDataReader GetTable(string tablename, string where = "", string orderby = "")
        {
            if (ConnectStatus != 1) { Open(); }
            if (ConnectStatus == 1) { return GetTable(iesConnection, tablename, where, orderby); }
            return null;  // Error
        }

        //DEFAULT-PARAMETERS
        //public static iesDataReader GetTable(MySqlConnection iConnect, string tablename) { return GetTable(iConnect,tablename,"",""); }
        //public static iesDataReader GetTable(MySqlConnection iConnect, string tablename, string where) { return GetTable(iConnect,tablename,where,""); }
        //public static iesDataReader GetTable(MySqlConnection iConnect, string tablename, string where, string orderby) {
        public static iesDataReader GetTable(MySqlConnection iConnect, string tablename, string where = "", string orderby = "")
        {
            iesDataReader iDR = new iesDataReader();
            MySqlCommand sCmd;
            MySqlDataReader dr;
            string sql = "SELECT * FROM " + tablename;

            if (!String.IsNullOrEmpty(where))
            {
                sql += " WHERE " + where;
            }

            if (!String.IsNullOrEmpty(orderby))
            {
                sql += " ORDER BY " + orderby;
            }

            sCmd = new MySqlCommand(sql, iConnect);
            dr = sCmd.ExecuteReader();
            iDR.DR = dr;
            return iDR;
        }

        // === Lookup DB Record and retrieve more ONE field value - GET FIRST ROW ONLY
        public string LookupField(string sTable, string sField, string sWhere, string defaultVal = null)
        {
            iesJSON rs = null;
            rs = LookupFields(sTable, sField, sWhere);
            if (!(rs == null))
            {
                if ((rs.Status == 0) && (rs.jsonType != "null"))
                {
                    return rs[sField].CString();
                }
            }

            // Failed - return default value (usually null)
            return defaultVal;
        }

        // === Lookup DB Record and retrieve more than one field value (return as iesJSON object) - GET FIRST ROW ONLY
        public iesJSON LookupFields(string sTable, string sFields, string sWhere)
        {
            string sql = "";
            iesJSON rs = null;

            string ssWhere = sWhere.Trim();
            if (!String.IsNullOrWhiteSpace(ssWhere)) { if (Left(ssWhere, 5).ToUpper() != "WHERE") { ssWhere = " WHERE " + ssWhere; } }
            sql = "SELECT " + sFields + " FROM " + sTable + ssWhere;
            rs = GetFirstRow(sql);
            if (!(rs == null))
            {
                if ((rs.Status == 0) && (rs.jsonType != "null"))
                {
                    return rs;
                }
            }

            // Failed - return empty record
            return new iesJSON("{}");
        }

        // === Lookup DB Record and retrieve more ONE field value - GET FIRST ROW ONLY
        public string QueryField(string sQuery, string sField, string defaultVal = null)
        {
            iesJSON rs = null;
            rs = QueryFields(sQuery, sField);
            if (!(rs == null))
            {
                if ((rs.Status == 0) && (rs.jsonType != "null"))
                {
                    return rs[sField].CString();
                }
            }

            // Failed - return default value (usually null)
            return defaultVal;
        }

        // === Lookup DB Record and retrieve more than one field value (return as iesJSON object) - GET FIRST ROW ONLY
        // NOTE: sFields is not used?  This function is the same as GetFirstRow - except that it returns {} upon failure?
        public iesJSON QueryFields(string sQuery, string sFields)
        {
            string sql = "";
            iesJSON rs = null;

            sql = sQuery;
            rs = GetFirstRow(sql);
            if (!(rs == null))
            {
                if ((rs.Status == 0) && (rs.jsonType != "null"))
                {
                    return rs;
                }
            }

            // Failed - return empty record
            return new iesJSON("{}");
        }
*/
        GetCount(sTable, strWhere) { // async
            return new Promise(async (resolve,reject) => {
                try {
                    let sqlWhere = strWhere.trim();
                    if (!sqlWhere) { if (sqlWhere.slice(0,5).toUpperCase() != "WHERE") { sqlWhere = " WHERE " + sqlWhere; } }
                    let sql = "SELECT Count(*) FROM " + sTable + " " + sqlWhere;
                    let rs = await this.GetFirstRow(sql); // iesJSON object
                    if (rs)
                    {
                        if ((rs.Status == 0) && (rs.jsonType != "null"))
                        {
                            try
                            {
                                resolve(rs[0].toNum());
                            }
                            catch { 
                                reject('ERROR: GetCount(): toNum failed.');
                            }
                        }
                    }
                    reject('ERROR: GetCount(): data not found.');
                } catch (err) {
                    console.log("ERROR: GetCount(): " + err);
                    reject('ERROR: GetCount(): failed.');
                }
            });	
        }
/*
        // NOTE! If we OPEN the connection here, the calling function needs to CLOSE the connection!
        public bool ExecuteSQL(string sql)
        {
            if (ConnectStatus != 1) { Open(); }
            if (ConnectStatus == 1) { return ExecuteSQL(iesConnection, sql); }
            return false;  // Error
        }

        public static bool ExecuteSQL(MySqlConnection iConnect, string sql)
        {
            bool success = true;

            MySqlCommand sCmd;
            sCmd = new MySqlCommand(sql, iConnect);
            try
            {
                sCmd.ExecuteNonQuery();
            }
            catch (Exception)
            {
                success = false;
            }

            return success;
        }

        // ***********
        // ***********  
        // *********** SaveRecord()
        // ***********
        // ***********
        // Return: false=failed, true=success
        // NOTE: Upon failure, CmdStatus will be <0 and CmdStatusMessage will contain information about the error.
        //       If no update was necessary, return=true, CmdStatus=1, and CmdStatusMessage will indicate no operation.
        // MergeMode: See options specified in SaveRecordSQL() below
        // NOTE: set primarykey="" to lookup primary key from table definition in database
        public bool SaveRecord(iesJSON jSON, string table, string primarykey, int newrec = -1, bool pkIsNumeric = true, bool SpecifyPK = false, bool GetNewPK = true, int MergeMode = 0, bool SaveToHistory = true)
        {
            return SaveRecord(jSON, table, primarykey.Split(','), newrec, pkIsNumeric, SpecifyPK, GetNewPK, MergeMode, SaveToHistory);
        }
        public bool SaveRecord(iesJSON jSON, string table, string[] primarykeys, int newrec = -1, bool pkIsNumeric = true, bool SpecifyPK = false, bool GetNewPK = true, int MergeMode = 0, bool SaveToHistory = true)
        {
            iesJSON keys = new iesJSON("[]");
            foreach (string strKey in primarykeys) {
                if (!string.IsNullOrWhiteSpace(strKey)) { keys.Add(strKey); }
            }
            return SaveRecord(jSON, table, keys, newrec, pkIsNumeric, SpecifyPK, GetNewPK, MergeMode, SaveToHistory);
        }
        public bool SaveRecord(iesJSON jSON, string table, iesJSON primarykeys, int newrec = -1, bool pkIsNumeric = true, bool SpecifyPK = false, bool GetNewPK = true, int MergeMode = 0, bool SaveToHistory = true)
        {
            bool success = false;
            CmdStatus = 0; CmdStatusMessage = "";

            bool NeedToClose = false;
            if (ConnectStatus != 1) { Open(); NeedToClose = true; }
            if (ConnectStatus == 1)
            {

                MySqlCommand sCmd;
                string sql = SaveRecordSQL(jSON, table, primarykeys, newrec, pkIsNumeric, SpecifyPK, MergeMode);
                // DEBUG: Write SQL to log file - only for debugging - not for normal operation - debugger
                // this.WriteLogTo("iesDBLib", "iesDBLib.SaveRecord: Debug: SQL=" + sql + "\n");  // DEBUG
                // this.WriteLogTo("iesDBLib", "iesDBLib.SaveRecord: Debug: JSON=" + jSON.jsonString + "\n");  // DEBUG
                string pre = "";
                try
                {
                    pre = sql.Substring(0, 6);
                }
                catch
                {
                    //Ha Ha...noop is not 6 characters....
                    pre = sql.Trim();
                }

                if (pre == "UPDATE" || pre == "INSERT")
                {
                    try
                    {
                        sCmd = new MySqlCommand(sql, iesConnection);
                        sCmd.ExecuteNonQuery();
                        success = true;
                        // Get PK if requested
                        if (pre == "INSERT" && GetNewPK == true)
                        {
                            string pk = primarykeys[0].ToStr();
                            string pkPrefix = Left(pk, 1);
                            if (pkPrefix == "$") { pkIsNumeric = false; pk = Mid(pk, 1); }
                            if (pkPrefix == "#") { pkIsNumeric = true; pk = Mid(pk, 1); }
                            if (pkIsNumeric)
                            {
                                long newPKn = sCmd.LastInsertedId;
                                jSON[pk].Value = newPKn;
                            }
                            else
                            {
                                string newPKs = sCmd.LastInsertedId.ToString();
                                jSON[pk].Value = newPKs;
                            }
                        } // end if (pre=="INSERT")
                    } // try 
                    catch (Exception ex)
                    {
                        success = false;
                        CmdStatus = -1;
                        //CmdStatusMessage="ERROR: SQL command failed. err[5519]";
                        CmdStatusMessage = "ERROR: SQL command failed. err[5519][" + sql + "][" + ex.ToString() + "]";//DEBUG
                    }
                } // end if
                else
                {
                    if (pre == "NOOP")
                    {
                        // NOOP = No Operation = No fields needed to be updated.
                        success = true;
                        CmdStatus = 1;
                        CmdStatusMessage = "Success. No operation necessary.";
                    }
                    else
                    {
                        success = false;
                        CmdStatus = -2;
                        CmdStatusMessage = "ERROR: Unable to create sql command. " + sql;
                    }
                }  // end else
            }
            else
            {
                // Not connected to DB
                success = false;
                CmdStatus = -92;
                CmdStatusMessage = "ERROR: Connection to DB invalid. [ERR5696]";
            }
            // Save to whistory table if specified
            // FUTURE: TODO: Problem with this logic is that the NEW record might be a MERGE
            //   between the fields in JSON and the fields that were already in the DB
            //   May need to capture the MERGED record to save to HISTORY
            if (SaveToHistory) {
                this.SaveToHistory(jSON,table,primarykeys);
            }
            if (NeedToClose) { Close(); }
            return success;
        }

        // ***********
        // ***********
        // *********** SaveToHistory()
        // ***********
        // ***********
        public void SaveToHistory(iesJSON jRec, string table,string primarykeys) {
            SaveToHistory(jRec,table,primarykeys.Split(","));
        }
        public void SaveToHistory(iesJSON jRec, string table, string[] primarykeys) {
            iesJSON keys = new iesJSON("[]");
            foreach (string strKey in primarykeys) {
                if (!string.IsNullOrWhiteSpace(strKey)) { keys.Add(strKey); }
            }
            SaveToHistory(jRec,table,keys);
        }
        public void SaveToHistory(iesJSON jRec, string table,iesJSON primarykeys) {
            if (string.IsNullOrWhiteSpace(historyTable)) { return; } // Cannot save to history if table not specified

            bool NeedToClose = false;
            if (ConnectStatus != 1) { Open(); NeedToClose = true; }
            if (ConnectStatus == 1)
            {
                string histWorld = dbStr(jRec["worldid"].ToStr().Trim(),40,true);
                iesJSON id = new iesJSON("{}");
                string histSql = "";

                // Add tablename and worldid if missing
                try {
                    // Get Primary Key
                    foreach (iesJSON ipk in primarykeys) {
                        string iipk = ipk.ToStr();
                        string prefix = iipk.Substring(0,1); // TEMP PATCH BANDAID - FUTURE EACH FIELD SHOULD ALREADY BE PROPER TYPE
                        iipk = iipk.Replace("$","").Replace("#","");
                        if (prefix == "#") {  // TEMP PATCH BANDAID - FUTURE EACH FIELD SHOULD ALREADY BE PROPER TYPE
                            id.Add(iipk,jRec[iipk].ToInt());  // TEMP PATCH BANDAID - FUTURE EACH FIELD SHOULD ALREADY BE PROPER TYPE
                        } else  {
                            id.Add(iipk,jRec[iipk].Value);
                        }
                    }
                    string idStr = dbStr(id.jsonString);

                    histSql = "INSERT INTO " + historyTable 
                        + " (worldid,tablename,_id,_json,modified) "
                        + " VALUES (" 
                            + histWorld + "," 
                            + dbStr(table) + "," 
                            + idStr + "," 
                            + dbStr(jRec.jsonString) + "," 
                            + dbStr(dbDateTime(DateTime.Now.ToString(),"DT"))
                        + ")";
                    MySqlCommand histCmd = new MySqlCommand(histSql, iesConnection);
                    histCmd.ExecuteNonQuery();
                } catch (Exception errHistory) {
                    Console.Write("ERROR: [ERR-17147] " + errHistory.ToString() + "\n");
                    Console.Write("SQL: " + histSql + "\n");
                }
            }
            if (NeedToClose) { Close(); }
        }

        // NewRec: -1=lookup to determine, 0=false (not a new record), 1=true (new record)
        // SpecifyPK: false=DB AutoAssigns primary key, true=User (or application) specifies the PK manually
        // MergeMode: 0 (default)=merge: only overwrite fields if field is found in jSONin object (do not update jSONin)
        //       1=overwrite all fields in record and null out fields if they are missing from jSONin (do not update jSONin)
        //       2=merge+update: same as option 0 but we also read fields from the DB and update jSONin (typically so we can write it to the History table)
        public string SaveRecordSQL(iesJSON jSONin, string table, iesJSON primarykey_in, int newrec_in, bool pkIsNumeric, bool SpecifyPK, int MergeMode = 0)
        {
            iesJSON jSON = jSONin.Clone();  // Make a copy so we can delete fields as we process them.
            // iesJSON jSON = new iesJSON(jSONin.jsonString);  // This does not handle nulls properly
            // DEBUG: Only include LOG for debugging - not for regular operation - debugger;
            // this.WriteLogTo("iesDBLib", "iesDBLib.SaveRecord: Debug: jSON.statusMessage: " + jSON.Status + ", " + jSON.StatusMessage + "\n");
            // this.WriteLogTo("iesDBLib", "iesDBLib.SaveRecord: Debug: jSON=" + jSON.jsonString + "\n");  // DEBUG
            // this.WriteLogTo("iesDBLib", "iesDBLib.SaveRecord: Debug: jSONin=" + jSONin.jsonString + "\n");  // DEBUG

            bool jsonField = false;  // indicates if the record contains a field "_json"
            iesJSON drData;
            System.Text.StringBuilder pieces = new System.Text.StringBuilder();
            string updateSQL = "";
            int newrec = newrec_in;

            int dataDiff = 0;

            if (table == "") { return "ERROR: Table name not specified.  [err8112]"; }
            //We now allow for the calling function to "not define" the primary key - in which case we look it up
            //if (primarykey_in.Length == 0) { return "ERROR: Primary Key not defined. [err8113]"; }

            //Let's get the columns (this is db specific)
            if (TableForColumnNames.ToLower() != table.ToLower())
            {
                TableForColumnNames = table;
                columnNames = new iesJSON();
                //string columnSQL = "SELECT `COLUMN_NAME`, `DATA_TYPE` FROM `INFORMATION_SCHEMA`.`COLUMNS` WHERE `TABLE_NAME`='" + table + "' AND TABLE_SCHEMA=database();";
                string columnSQL = "SHOW COLUMNS FROM " + table;

                columnNames = this.GetDataReaderAll(columnSQL);

            } // if (TableForColumnNames.ToLower()!=table.ToLower())

            // If primarykey_in is 0 length, then we need to figure out the primary key from the selected columns
            if (primarykey_in.Length == 0) {
                foreach (iesJSON thisCol in columnNames) {
                    if (thisCol["Key"].ToStr().ToUpper() == "PRI") {
                        // This column is part of the primary key... add it as a string or numeric
                        if (Left(thisCol["Type"].ToStr(),7).ToLower() == "varchar") {
                            // Primary Key as string
                            primarykey_in.Add("$" + thisCol["Field"].ToStr());
                        } else {
                            // Primary Key as numeric
                            primarykey_in.Add("#" + thisCol["Field"].ToStr());
                        }
                    }
                }
            }
            
            //Let's see if we have the primary key
            iesJSON keyInfo = new iesJSON("{}");
            string[] primarykey = new string[primarykey_in.Length];
            System.Text.StringBuilder pkWhere = new System.Text.StringBuilder();
            bool pkFound = true;
            for (int jk = 0; jk < primarykey_in.Length; jk++)
            {
                string pk = primarykey_in[jk].ToStr();
                string ki = "";
                bool pkn = pkIsNumeric;
                if (Left(pk, 1) == "$") { pk = Mid(pk, 1); pkn = false; }
                if (Left(pk, 1) == "#") { pk = Mid(pk, 1); pkn = true; }
                if (pkn) { ki = jSON[pk].CString(); }
                else { ki = dbStr(jSON[pk].CString()); }

                if (ki == "" || ki == "''") { pkFound = false; }
                keyInfo[pk].Value = ki;
                primarykey[jk] = pk.ToLower();
                if (jk == 0) { jSON.RemoveFromBase(pk); } // ONLY REMOVE FIRST pk VALUE - Other parts of primary key are not auto-generated (such as WorldID)
                if (jk > 0) { pkWhere.Append(" AND "); }
                pkWhere.Append(pk + "=" + ki);
            }

            // If pk was not found and newrec=-1 (determine) AND SpecifyPK=false, then we can determine that we need to create a new record (set newrec=1)
            if ((pkFound == false) && (newrec == -1) && (SpecifyPK == false)) { newrec = 1; }
            // You don't need pk if it is a NEW record AND SepcifyPK is false
            if (!(newrec == 1 && SpecifyPK == false))
            {
                if (pkFound == false) { return "ERROR: Primary key not specified.  [err8114] [" + string.Join(",", keyInfo) + "][" + string.Join(",", primarykey) + "]" + jSONin.jsonString; }
            }

            // DEBUG: Only include LOG for debugging - not for regular operation - debugger;
            // this.WriteLogTo("iesDBLib", "iesDBLib.SaveRecord: Debug: columnNames=" + columnNames.jsonString + "\n");  // DEBUG

            //Let's create the sql query
            if (pkFound && (newrec < 1))
            {

                string selectSQL = "SELECT * FROM " + table + " WHERE " + pkWhere + " LIMIT 1";
                // DEBUG: Only include LOG for debugging - not for regular operation - debugger;
                // this.WriteLogTo("iesDBLib", "iesDBLib.SaveRecord: Debug: SQL=" + selectSQL + "\n");  // DEBUG
                drData = null;
                try
                {
                    drData = GetFirstRow(selectSQL); // returns an array of 1 record
                }
                catch { drData = null; }
                if (drData != null)
                {
                    if (drData.Status != 0 || drData.jsonType != "object") { drData = null; }
                }
                if (drData != null)
                {
                    // drData = drData[0]; // Get first record in the array.  - NO LONGER NEEDED - CHANGE TO GetFirstRow()  TKT 5/13/2016
                    //Let's compare
                    foreach (iesJSON colNameRec in columnNames)
                    {
                        string colName = colNameRec["Field"].ToStr();
                        if (colName.ToLower() == "_json") { jsonField = true; }
                        else
                        {
                            if (jSON.Contains(colName))
                            { // Only need to update fields that are contained in the jSON object (pk fields are excluded)
                                string val1 = "", val2 = "";
                                string vType = jSON[colName].jsonType.ToLower();
                                if (Right(colName.ToLower(), 5) == "_json")
                                {
                                    vType = "string";
                                    val1 = jSON[colName].jsonString;
                                    val2 = drData[colName].jsonString;
                                }
                                else
                                {
                                    val1 = jSON[colName].CString();
                                    val2 = drData[colName].CString();
                                }
                                if (val1 != val2)
                                { // Only need to update fields where the data has changed
                                    if (dataDiff > 0) { pieces.Append(","); }
                                    dataDiff++;
                                    if (vType == "string") { val1 = dbStr(val1); }
                                    if (jSON[colName].jsonType.ToLower() == "null")
                                    {
                                        pieces.Append(colName + " = NULL");
                                    }
                                    else
                                    {
                                        pieces.Append(colName + " =" + val1);
                                    } //else
                                }
                            } //if (jSON.Contains(colName))
                            else
                            {
                                // MergeMode 0 - do nothing
                                // MergeMode 1 - change the DB record value to NULL
                                if (MergeMode == 1)
                                {
                                    if (dataDiff > 0) { pieces.Append(","); }
                                    dataDiff++;
                                    pieces.Append(colName + " = NULL");
                                }
                                // MergeMode 2 - write the DB value into jSONin
                                if (MergeMode == 2)
                                {
                                    jSONin.AddToObjBase(colName, drData[colName].Value);
                                }
                            } // end else
                            jSON.RemoveFromBase(colName);
                        } // end else _json field
                    } // end for

                    // if MergeMode = 0 or 2 then we need to KEEP fields that already exist in _json
                    iesJSON recJson = null;
                    if (jsonField && (MergeMode == 0 || MergeMode == 2))
                    {
                        recJson = drData["_json"];
                        foreach (iesJSON recField in recJson)
                        {
                            if (!jSON.Contains(recField.Key))
                            {
                                // Field exists in DB record, but not in jSONin
                                jSON.AddToObjBase(recField.Key, recField.Value);
                                // If MergeMode=2 then we also need to capture this in the original object
                                if (MergeMode == 2)
                                {
                                    jSONin.AddToObjBase(recField.Key, recField.Value);
                                }
                            }
                        }
                    }

                    if ((jSON.Length > 0) && (jsonField))
                    {
                        // There are still fields left in the JSON object - they need to be written into the _json field
                        // But only if the old/new values differ
                        if (jSON.jsonString != recJson.jsonString)
                        {
                            if (dataDiff > 0) { pieces.Append(","); }
                            dataDiff++;
                            pieces.Append("_json=" + dbStr(jSON.jsonString));
                        } // end if (jSON.jsonString != recJson.jsonString)
                    } // end if ((jSON.Length>0) && (jsonField))
                    if (dataDiff == 0)
                    {
                        //try { drData.Close(); } catch {}
                        return "NOOP";
                    }

                    updateSQL = "UPDATE " + table + " SET " + pieces.ToString() + " WHERE " + pkWhere;

                    //try { drData.Close(); } catch {}
                    return updateSQL;
                }
                else
                {
                    //try { drData.Close(); } catch {}
                    if (newrec == 0) { return "ERROR: Record not found.  [err8113] [" + string.Join(",", keyInfo) + "][" + string.Join(",", primarykey) + "]"; }
                    newrec = 1;
                }
            }// end if
            int cnt3 = 0;
            if (newrec == 1)
            {
                System.Text.StringBuilder insertString = new System.Text.StringBuilder();
                System.Text.StringBuilder valuesString = new System.Text.StringBuilder();

                //string lastCol = columnNames[columnNames.Length - 1];
                foreach (iesJSON colNameRec in columnNames)
                {
                    string colName = colNameRec["Field"].ToStr();
                    string colNameLower = colName.ToLower();
                    // Need to determine if this field is a primary key
                    bool isPK = false;
                    // NOTE! For INSERT ONLY - if the user DOES NOT specify a primary key, it is only the FIRST
                    // value of the PK that they do not specify.  For example if it is AutoNumber,WorldID
                    // the WorldID must still be specified
                    //for (int jk = 0; jk < primarykey.Length; jk++) { if (colNameLower == primarykey[jk]) { isPK = true; break; } }
                    if (colNameLower == primarykey[0]) { isPK = true; }

                    if (SpecifyPK == true || !isPK)
                    {  // skip PK if user does not specify PK
                        if (colNameLower == "_json") { jsonField = true; }
                        else
                        {
                            // only attempt to enter fields if they have been specified in the JSON
                            // Leaving them out of the INSERT will typically insert a NULL (or default value)
                            if (jSON.Contains(colName)) {
                                if (cnt3 > 0)
                                {
                                    insertString.Append(",");
                                    valuesString.Append(",");
                                }
                                insertString.Append(colName);
                                if (!isPK)
                                {
                                    if (Right(colName.ToLower(), 5) == "_json")
                                    {
                                        valuesString.Append(dbStr(jSON[colName].jsonString));
                                    }
                                    else
                                    {
                                        valuesString.Append(dbStr(jSON[colName].CString()));
                                    }
                                    jSON.RemoveFromBase(colName);
                                }
                                else
                                {  // This is a primary key field
                                    valuesString.Append(keyInfo[colName].CString());
                                }
                                // DEBUG: Only include LOG for debugging - not for regular operation - debugger;
                                // this.WriteLogTo("iesDBLib", "iesDBLib.SaveRecord: Debug: colName=" + colName + " [" + cnt3 + "]\n");  // DEBUG
                                cnt3++;
                            }
                        } // else
                    } // if (SpecifyPK==true || !isPK)
                } // foreach                 
                if ((jSON.Length > 0) && (jsonField))
                {
                    if (cnt3 > 0)
                    {
                        insertString.Append(",");
                        valuesString.Append(",");
                    }
                    // There are still fields left in the JSON object - they need to be written into the _json field
                    insertString.Append("_json");
                    valuesString.Append(dbStr(jSON.jsonString));
                }
                string insertSQL = "INSERT INTO " + table + " (" + insertString.ToString() + ") VALUES (" + valuesString.ToString() + ")";
                return insertSQL;
            }
            //           } else {
            //              return "ERROR: Primary key value not found.  [err3342] [" + keyInfo + "][" + primarykey + "]";
            //				}          
            return "NOOP[newrec=" + newrec + "]";  // NOOP = No Operation = Record did not change, no INSERT/UPDATE needed.
        }


        // BuildJSON()
        // This static routine accepts a DataReader that is ALREADY POSITIONED AT THE RECORD TO BE CONVERTED
        // It returns a newly created JSON object with the parameters from the 'current' data record.
        //DEFAULT-PARAMETERS
        //public static iesJSON BuildJSON(MySqlDataReader DR) { return BuildJSON(DR,false); }
        //public static iesJSON BuildJSON(MySqlDataReader DR, bool AsArray) {
        public static iesJSON BuildJSON(MySqlDataReader DR, bool AsArray = false)
        {
            string j, nm, newSJ;
            iesJSON newJ = null, tmpJ;

            //Let's get the _JSON value first
            j = "";
            try
            {
                j = DR["_json"].ToString();  // If field does not exist, an error will be thrown
            }
            catch { }
            try
            {
                if (j != "")
                {
                    newJ = new iesJSON(j); // Parse _json
                    if ((newJ.Status != 0) || (newJ.jsonType == "null")) { newJ = null; }
                }
            }
            catch { } // FUTURE: flag error

            if (newJ == null) { newJ = new iesJSON("{}"); }  // Blank Object because parse of JSON failed.  
            // FUTURE: Check status of newJ and decide what to do if not OK (0)
            // FUTURE: error handling below
            int cnt = DR.FieldCount;
            for (int k = 0; k < cnt; k++)
            {
                nm = "";
                nm = DR.GetName(k);
                if (Right(nm, 5).ToLower() == "_json")
                {
                    if (nm != "_json")
                    {
                        newSJ = "";
                        try
                        {
                            newSJ = DR.GetValue(k).ToString();
                        }
                        catch { }  //Invalid date values throw an error.  Here we ignore them.
                        if (newSJ.Trim() != "")
                        {
                            tmpJ = new iesJSON(newSJ);
                            if (tmpJ.Status == 0) { newJ[nm] = tmpJ; }
                            else { newJ[nm] = iesJSON.CreateItem(null); } // FUTURE: Indicate warning/error here?
                            tmpJ = null;
                        }
                        else
                        {
                            newJ[nm] = iesJSON.CreateItem(null);
                        }
                    }
                }
                else
                {
                    try
                    {
                        switch (DR.GetDataTypeName(k).ToLower())
                        {
                            case "date":
                            case "datetime":
                                string ss = DR.GetValue(k).ToString();
                                tmpJ = iesJSON.CreateItem(ss);
                                break;
                            default:
                                tmpJ = iesJSON.CreateItem(DR.GetValue(k));
                                break;
                        } // End Switch

                    }
                    catch { tmpJ = iesJSON.CreateNull(); }  //Invalid date values throw an error.  Here we ignore it and use NULL.
                    if (tmpJ.Status == 0) { newJ[nm] = tmpJ; }
                    else { newJ[nm] = iesJSON.CreateItem(null); } // FUTURE: Indicate warning/error here?
                    tmpJ = null;
                }
            } // end for

            // Here we cheat - because a JSON ARRAY is not any different than a JSON OBJECT - only we ignore the field names.
            // So we convert the JSON OBJECT to an ARRAY if the AsArray flag is set.  FUTURE: More elegant method?
            if (AsArray == true)
            {
                newJ.ConvertToArray();
                newJ.InvalidateJsonString();
            }

            return newJ;
        }

        // Right()
        // Return right <length> characters, or entire string if <length> is longer than string length
        public static string Right(string str, int length)
        {
            if (length <= 0) { return ""; }
            if (length > str.Length) { return str; }
            return str.Substring(str.Length - length, length);
        }

        static readonly object padLock = new object();
        public void WriteLogTo(string strFilePrefix, string strTextToWrite, bool Overwrite = false)
        {
            string strFilePathName = @"logs\" + strFilePrefix + "_log.txt";
            lock (padLock)
            {
                try
                {
                    if (Overwrite)
                    {
                        File.WriteAllText(strFilePathName, strTextToWrite);
                    }
                    else
                    {
                        File.AppendAllText(strFilePathName, strTextToWrite);
                    }
                }
                catch (Exception logEx)
                {
                    File.WriteAllText("iesDBLib_ERROR.txt", "ERROR: iesBBDLib: Failed to write log file. [ERR1456]\n" + logEx.ToString());
                }
            }
        }

        */

} // end Class

module.exports = iesDB;