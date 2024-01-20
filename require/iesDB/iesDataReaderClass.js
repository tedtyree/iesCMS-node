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

// iesDataReader version 1.0 JS - Simple light-weight DataReader Interface class for .js 
// Even though data from MySQL interface is returned as a complete JS array, we may need the Data Reader to 
//    handle a pointer within the records or to convert the _json field and overlay other fields.
// To be used with iesDB.
// This class mimicks the MySqlDataReader (and contains a MySqlDataReader within it).
// This class is returned from iesDB.GetDataReader(). You should not directly create an instance of this class.
// Copyright 2021 - Ted Tyree - ieSimplified, LLC - All rights reserved.
// ****************************************************

// **************************************************************************
// ***************************  iesDataReader  ******************************
// **************************************************************************
//

const iesJSON = require('../iesJSON/iesJsonClass.js');
const fs = require('fs');

class iesDataReader {

        DR = null; // Array object returned from MySQL query
        db = null; // Parent iesDB object
        prevJSON = null; // iesJSON object
        currJSON = null; // iesJSON object
        currValid = false;
        AsArray = false;  // Set this to true to get records set as a JSON array instead of a JSON object (useful for Ajax and jquery datatables)
        currentIdx = -2;
        status;
        statusMessage;

        constructor(parentDB,currentDR) {
            this.db = parentDB;
            this.DR = currentDR;
            this.currentIdx = -1;
            this.status = 0;
            this.statusMessage = "";
        }

        get length() {
            if (!this.DR) { return 0; }
            return this.DR.length;
        }

        // Read()
        // Move to the next record. Returns the next record if fBuildJSON is true. Otherwise returns 'true'.
        // If fBuildJSON is TRUE, then the record is automatically converted to JSON.  This is necessary if you want to be able to use 'prevJSON'.
        // FUTURE: Handle case when DR is null.
        Read(fBuildJSON = true)
        {
            if (this.currentIdx >= this.DR.length - 1) {
                return null; // we are at the end of the array
            }
            this.currentIdx++;
            
            this.currValid = false;
            this.prevJSON = this.currJSON;  // Only has a value if currJSON has been "built"
            this.currJSON = null;
            
            if (fBuildJSON) { 
                this.BuildCurrJSON(); 
                return this.currJSON;
                }
            return true;
        }

        // GetValue()
        // Get a value from the current record.  (without forcing us to create the JSON object)
        GetValue(key) { return DR[this.currentIdx][key]; }

        // GetJSON()
        // Return the current record as a JSON object.
        GetJSON()
        {
            if (this.currValid == false) { this.BuildCurrJSON(); }
            if (this.currValid == true) { return this.currJSON; }
            return null;
        }

        // BuildCurrJSON()
        // Translate the current record into a JSON object.
        // NOTE: Typically you do not need to call this routine because it will be called by the GetJSON or other places when needed.
        BuildCurrJSON()
        {
            if (this.currValid == true) { return; }
            this.currJSON = this.BuildJSON();
            this.currValid = true;
        }

        // Returns all records as a iesJSON object
        GetAllRecords(AsObject = false, ReturnPartial = false) {
            if (this.status != 0) { return null; }
            let errStat = -34;  // Indicate there was an error during processing
            try {
                var jAll;
                if (AsObject) { jAll = new iesJSON("{}"); }
                else { jAll = new iesJSON("[]"); }

                if (this.DR === null) { return jAll; }

                var jRow;
                let idx = 0;
                while (this.Read())
                {
                    jRow = this.GetJSON();
                    jAll.addToBase(jRow, idx + '');
                    idx++;
                    if (idx>99999) { 
                        errStat = -37; // Indicates that there were too many records (over 99999)
                        throw new Error("ERROR: GetAllRecords() [ERR-37]"); // forces the catch below
                        }
                }
                return jAll;
            }
            catch (ee7) { console.log("ERROR: " + ee7); }
            if (ReturnPartial == false) { 
                if (AsObject) { jAll = new iesJSON("{}"); }
                else { jAll = new iesJSON("[]"); } 
            }
            this.status = errStat; // Indicate there was an error during processing (but still return array... which may be empty or have partial data)
            return jAll;
        }

        Close()
        {
            try
            {
                DR.Close();
            }
            catch { }
        }

        // BuildJSON()
        // This static routine accepts a DataReader that is ALREADY POSITIONED AT THE RECORD TO BE CONVERTED
        // It returns a newly created JSON object with the parameters from the 'current' data record.
        //DEFAULT-PARAMETERS
        //public static iesJSON BuildJSON(MySqlDataReader DR) { return BuildJSON(DR,false); }
        //public static iesJSON BuildJSON(MySqlDataReader DR, bool AsArray) {
            BuildJSON(AsObject = true)
            {
                var j;
                var nm;
                var newSJ;
                let newJ = null;
                var tmpJ;
    
                //Let's get the _JSON value first
                j = "";
                try
                {
                    if ((this.DR[this.currentIdx]) && (this.DR[this.currentIdx]["_json"])) {
                      j = this.DR[this.currentIdx]["_json"] + "";  // If field does not exist, an error will be thrown
                        
                    }
                }
                catch { }
                try
                {
                    if (j)
                    {
                        newJ = new iesJSON(j); // Parse _json
                        if ((newJ.Status != 0) || (newJ.jsonType == "null")) { newJ = null; }
                    }
                }
                catch { } // FUTURE: flag error
    
                if (newJ == null) { newJ = new iesJSON("{}"); }  // Blank Object because parse of JSON failed.  
                // FUTURE: Check status of newJ and decide what to do if not OK (0)
                let nRow = this.DR[this.currentIdx];
                for (const [k,v] of Object.entries(nRow))
                {
                    if (this.Right(k, 5).toLowerCase() == "_json")
                    {
                        if (k != "_json")
                        {
                            newSJ = "";
                            try
                            {
                                newSJ = this.DR[this.currentIdx][k] + "";
                            }
                            catch { } 
                            if (newSJ.trim() != "")
                            {
                                tmpJ = new iesJSON(newSJ);
                                if (tmpJ.Status == 0) { newJ.add(tmpJ,k); }
                                else { newJ.add( new iesJSON("null"), k ); } // FUTURE: Indicate warning/error here?
                                tmpJ = null;
                            }
                            else
                            {
                                newJ.add( new iesJSON("null"), k);
                            }
                        }
                    }
                    else
                    {
                        try
                        {
                            newJ.add(v,k);
                        }
                        catch { newJ.add(new iesJSON("null"), k); }  //Invalid date values throw an error.  Here we ignore it and use NULL.
                        tmpJ = null;
                    }
                } // end for
    
                // Here we cheat - because a JSON ARRAY is not any different than a JSON OBJECT - only we ignore the field names.
                // So we convert the JSON OBJECT to an ARRAY if the AsArray flag is set.  FUTURE: More elegant method?
                if (AsObject == false)
                {
                    newJ.ConvertToArray();
                    newJ.InvalidateJsonString();
                }
    
                return newJ;
            }

        // Right()
        // Return right <length> characters, or entire string if <length> is longer than string length
        Right(str, len)
        {
            if (len <= 0) { return ""; }
            if (len > str.length) { return str; }
            return str.substring(str.length - len, str.length);
        }
  
} // end Class

module.exports = iesDataReader;