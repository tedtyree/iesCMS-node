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

        DR = null; // MySqlDataReader object
        prevJSON = null; // iesJSON object
        currJSON = null; // iesJSON object
        currValid = false;
        AsArray = false;  // Set this to true to get records set as a JSON array instead of a JSON object (useful for Ajax and jquery datatables)
        status = 0;
        statusMessage = "";

        // Read()
        // Move to the next record.
        // If fBuildJSON is TRUE, then the record is automatically converted to JSON.  This is necessary if you want to be able to use 'prevJSON'.
        // FUTURE: Handle case when DR is null.
        Read(fBuildJSON = false)
        {
            let ret = false;
            let currValid = false;
            prevJSON = currJSON;  // Only has a value if currJSON has been "built"
            ret = DR.Read();
            if (fBuildJSON) { this. BuildCurrJSON(); }
            return ret;
        }

        // GetValue()
        // Get a value from the current record.  (without forcing us to create the JSON object)
        GetValue(i) { return DR.GetValue(i); }

        // GetJSON()
        // Return the current record as a JSON object.
        GetJSON()
        {
            if (currValid == false) { this.BuildCurrJSON(); }
            if (currValid == true) { return currJSON; }
            return null;
        }

        // BuildCurrJSON()
        // Translate the current record into a JSON object.
        // NOTE: Typically you do not need to call this routine because it will be called by the GetJSON or other places when needed.
        BuildCurrJSON()
        {
            if (currValid == true) { return; }
            currJSON = iesDB.BuildJSON(DR, AsArray);
            currValid = true;
        }

        Close()
        {
            try
            {
                DR.Close();
            }
            catch { }
        }

} // end Class

module.exports = iesDataReader;