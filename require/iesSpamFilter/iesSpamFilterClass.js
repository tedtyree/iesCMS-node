/*  
Copyright 2023 Ted Tyree - ieSimplified.com

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


// iesSpamFilter version 1 - Simple SPAM filter for website Forms
// Copyright 2023 - Ted Tyree - ieSimplified, LLC
//
// Specified folder should be the 'spam' folder of the website containing a spam.cfg and a spam-library.cfg
// spam.cfg indicates the spam configuration, level, and nightly/weekly notifications (or none)
// spam-library.cfg contains a list of Regular Expressions that identify SPAM
// If library is missing, system looks for /spam/spam-library.cfg in the root folder.
//
// Two phase filter:
//    Check for special characters: An abundance of non-text characters indicates SPAM
//    Check for Regex expressions in spam-library.cfg (either local or in root folder)
//    FUTURE: Check for an abundance no non-alpha numeric characters???
//    FUTURE: Keep a log of messages to other websites and compare them (looking for same message sent to multiple websites)
//        (to expand on this: idea to take first 1000 character, break into words, discard if 3 letters or less,
//         discard special characters (or count them for above threshold on special characters) and store as list of words
//         in descending order by length (longest words first) and then alphabetically.  If this list of words is relativley
//         similar to another email, then it is probably spam.  Store in a central table for quick comparisons)
//
// Nightly Report:
//    System checks each folder for /[[worldid]]/spam/spam.cfg and if found, processes the nightly spam routine
//    If message is requested nightly, count of good/spam emails from TODAY is sent to website owner.  Includes link to admin page with all messages listed.
//       (if both counts are zereo, no email is sent)
//    If message is requested weekly and it is 'Friday', count of good/spam emails from Entire Week is sent to website owner.
//       (if both counts are zero, email is only sent if SendWeeklyEvenIfCountZero flag is set to True)
//
// Nightly Report should be intiated for all servers from a central 'master' server that runs a web API to send out the messages.
//    eg.  http://s7.TheWebsiteParkingLot.com/admin/src/NightlySpamNotifications.aspx?pwd=12345
//
// ****************************************************
// CLASS: iesSpamFilter
//

const fs = require('fs');
const StringBuilder = require("string-builder");
const iesJSON = require('../iesJSON/iesJsonClass.js');

class iesSpamFilter {
	
    debugLevel = 0; // Set this to a value of 1-9 to get a LOG of activity in debugMsg.
    debugMsg = "";
    spamFolderSite = "";
    spamFolderCommon = "";
    spamConfigFile = "spam.cfg";
    spamLibFile = "spam-library.cfg";
    FolderSeparator = '/';

    constructor(SpamFolderSite,SpamFolderCommon,SetSpamConfigFile,SetSpamLibFile) {
		if (SpamFolderSite) { this.spamFolderSite = SpamFolderSite; }
        if (SpamFolderCommon) { this.spamFolderCommon = SpamFolderCommon; }
        if (SetSpamConfigFile) { this.spamConfigFile = SetSpamConfigFile; }
        if (SetSpamLibFile) { this.spamLibFile = SetSpamLibFile; }
	}

    newSpamObj(FullMessage = "", SpamLevel = 0, SpamReason = "") {
        return {SpamLevel, SpamReason, FullMessage};
    }

    // CheckMessage() - process FullMessage and determine if it is spam
    // Return: 0=not spam (or spam not checked), 1+ = recognized as spam with higher numbers indicating more likely to be spam.
    // Return: <0 Error/Warning and Spam not checked
    // NOTE: FullMessage is an input and an output.  If MaxMessageLength and ClipIfTooLong are set, this routine may clip the text message.
    // NOTE: SpamObj = {FullMessage, SpamLevel, SpamReason}
    CheckMessage(SpamObj)
    {

        SpamObj.SpamLevel = 0;
        SpamObj.SpamReason = "";
        var reason = "";

        // Attempt to read spam.cfg file - if it does not exist, then this website does not check for spam
        if (this.isNullOrWhiteSpace(this.spamFolderSite))
        {
            SpamObj.SpamLevel = -1;
            SpamObj.SpamReason = "spamFolderSite not specified.";
            if (this.debugLevel > 0) { this.debugMsg = SpamObj.SpamReason; }
            return;
        }
        if (!fs.existsSync(this.spamFolderSite))
        {
            SpamObj.SpamLevel = -2;
            SpamObj.SpamReason = "spamFolderSite not found: " + this.spamFolderSite;
            if (this.debugLevel > 0) { this.debugMsg = SpamObj.SpamReason; }
            return;
        }
        var fullPath = this.spamFolderSite + this.FolderSeparator + this.spamConfigFile;
        if (!fs.existsSync(fullPath))
        {
            SpamObj.SpamLevel = -3;
            SpamObj.SpamReason = "SpamConfig file not found: " + fullPath;
            if (this.debugLevel > 0) { this.debugMsg = SpamObj.SpamReason; }
            return;
        }
        // Load spam.cfg
        var spamCfg = new iesJSON();
        spamCfg.DeserializeFlexFile(fullPath);
        if (spamCfg.Status != 0)
        {
            SpamObj.SpamLevel = -4;
            SpamObj.SpamReason = "SpamConfig did not load correctly: " + fullPath;
            if (this.debugLevel > 0)
            {
                this.debugMsg = SpamObj.SpamReason;
                this.debugMsg += "\r\nDeserializeFlexFile error status: " + spamCfg.Status;
            }
            return;
        }

        // If SpamFilterOn!=TRUE then the filter is turned off and we should exit.
        if (!spamCfg.getBool("SpamFilterOn",false))
        {
            SpamObj.SpamLevel = -5;
            SpamObj.SpamReason = "Spam Filter turned off.  SpamFilterOn=" + spamCfg.getStr("SpamFilterOn");
            if (this.debugLevel > 0) { this.debugMsg = SpamObj.SpamReason; }
            return;
        }

        // Limit length of message?  MaxMessageLength
        // IsSpamIfTooLong/ClipIfTooLong
        var MaxLength = spamCfg.getNum("MaxMessageLength",0);
        if (MaxLength > 0)
        {
            if (SpamObj.FullMessage.Length > MaxLength)
            {
                // Message is too long
                if (spamCfg.getBool("IsSpamIfTooLong",false))
                {
                    // Identified SPAM
                    SpamObj.SpamLevel += 1;
                    reason = "Exceeded MaxMessageLength: " + SpamObj.FullMessage.Length + "\r\n";
                    if (SpamReason.Length > 0) { SpamReason += ","; }
                    SpamReason += reason;
                    if (this.debugLevel > 0) { this.debugMsg += "SPAM: " + reason; }
                }
                if (spamCfg.getBool("ClipIfTooLong",false))
                {
                    // Clip message to MAX length
                    SpamObj.FullMessage = SpamObj.FullMessage.Substring(0, MaxLength);
                    if (this.debugLevel > 0) { this.debugMsg += "CLIP MESSAGE TO MAX LENGTH: " + MaxLength + "\r\n"; }
                }
            }
        }
        else
        {
            if (this.debugLevel > 0) { this.debugMsg += "Do NOT check for MaxMessageLength\r\n"; }
        }

        // If MaxNonTextCharacters>0 then perform check...  Check for a count > the number specified.
        var MinCheckCount = spamCfg.getNum("MaxNonTextCharacters",0);
        if (MinCheckCount > 0)
        {
            if (this.debugLevel > 0) { this.debugMsg += "Check For MaxNonTextCharacters: "; }
            var NonTextCount = 0;
            var txt = SpamObj.FullMessage.replace(/[a-zA-Z0-9! @#$%^~&*()_+\-=\[\]{};':\"\\|,.<>\/?\r\n]/g, "");
            var NonTextCount = txt.length;

            if (this.debugLevel > 0) { this.debugMsg += "Check For MaxNonTextCharacters: " + NonTextCount; }
            if (NonTextCount >= MinCheckCount)
            {
                // Identified SPAM
                SpamObj.SpamLevel += 1;
                reason = "NonTextCharacters=" + NonTextCount + "\r\n";
                if (SpamObj.SpamReason.Length > 0) { SpamObj.SpamReason += ","; }
                SpamObj.SpamReason += reason;
                if (this.debugLevel > 0) { this.debugMsg += "SPAM: " + reason; }
            }
        }
        else
        {
            if (this.debugLevel > 0) { this.debugMsg += "Do NOT Check For MaxNonTextCharacters\r\n"; }
        }

        // Now lets see if we should be checking spam using the spam-library.cfg
        if (spamCfg.getBool("CheckAgainstSpamLibrary",false))
        {
            // Check if local spam folder has its own spam-library.cfg
            var libPath = this.spamFolderSite + this.FolderSeparator + this.spamLibFile;
            if (!fs.existsSync(libPath))
            {
                libPath = this.spamFolderCommon + this.FolderSeparator + this.spamLibFile;
                if (!fs.existsSync(libPath)) { libPath = ""; }
            }
            if (this.isNullOrWhiteSpace(libPath))
            {
                SpamObj.SpamLevel = -7;
                SpamObj.SpamReason = "Spam Library not found: " + this.spamLibFile;
                if (this.debugLevel > 0) { this.debugMsg += "Spam Library not found: " + this.spamLibFile + "\r\n"; }
            }
            else
            {

                //Read Library of SPAM Regex Defintions
                var spamLib = new iesJSON();
                spamLib.DeserializeFlexFile(libPath);
                if (spamLib.Status != 0)
                {
                    reason = "SpamConfig did not load correctly: " + libPath;
                    if (SpamObj.SpamReason.Length > 0) { SpamObj.SpamReason += ","; }
                    SpamObj.SpamReason += reason;
                    if (this.debugLevel > 0)
                    {
                        this.debugMsg += reason;
                        this.debugMsg += "\r\nDeserializeFlexFile error status: " + spamLib.Status;
                    }
                }
                else
                {
                    // PROCESS CONFIG FILE
                    var spamArray = spamLib.toJsonArray(); // Convert iesJSON object to a javascript array
                    for (const rx of spamArray)
                    {
                        var rxID = rx.getStr("id","");
                        var rxMatch = rx.getStr("regex","");
                        if (!this.isNullOrWhiteSpace(rxMatch))
                        {
                            try
                            {
                                if (this.debugLevel > 2) { this.debugMsg += "Check Spam Regex: " + rxID + "\r\n"; }

                                // Instantiate the regular expression object.
                                var r = new RegExp(rxMatch, "i");

                                // Match the regular expression pattern against a text string.
                                var m = SpamObj.FullMessage.match(r);
                                if (m) // check for 1 or more matches
                                {
                                    SpamObj.SpamLevel += 1;
                                    reason = "Found Spam Match: " + rxID + "\r\n";
                                    if (SpamObj.SpamReason.Length > 0) { SpamObj.SpamReason += ","; }
                                    SpamObj.SpamReason += reason;
                                    if (this.debugLevel > 0) { this.debugMsg += reason; }
                                }
                            }
                            catch (regexErr)
                            {
                                if (this.debugLevel > 0)
                                {
                                    this.debugMsg += "ERROR: Regex failed: rxID=" + rxID + " Regex=" + rxMatch + "\r\n";
                                    this.debugMsg += "REGEX ERROR MESSAGE: " + regexErr.message;
                                }
                            }
                        } // end if !this.isNullOrWhiteSpace(rxMatch)
                    } // End foreach
                }
            } // End if (this.isNullOrWhiteSpace(libPath))

        } // End if (spamCfg.getBool("CheckAgainstSpamLibrary",false))

    } // end CheckMessage()

    isNullOrWhiteSpace( input ) {
        return !input || !(input + '').trim();
      }

} // END Class - iesSpamFilter

module.exports = iesSpamFilter;