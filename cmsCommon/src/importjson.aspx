<%@ Language="c#" runat="server"%>
<%@ Import Namespace="System.Collections" %>
<%@ Import Namespace="System.Globalization" %>
<%@ Import Namespace="iesJSONlib" %>
<%@ Import Namespace="System.IO" %>
<%@ Import NameSpace="iesDBlib" %>
<%


//create json object with nothing in it
iesJSON jObj = new iesJSON(); //use default constructor to build empty object
//tell json object to read json file
jObj.stats=new iesJSON("{}");

jObj.DeserializeFile("D:\\CustomerData\\webspaces\\webspace_00103338\\wwwroot\\icn\\upload.txt");
if (!File.Exists("D:\\CustomerData\\webspaces\\webspace_00103338\\wwwroot\\icn\\upload.txt")) { Response.Write("ERROR: Did not find file: " + "D:\\CustomerData\\webspaces\\webspace_00103338\\wwwroot\\s12\\icn\\upload.txt" + "<br>");
}
if(jObj._status == -32)
{
	Response.Write("Failed to open the file correctly" + "<br>");
	Response.Write(jObj.stats.jsonString);
}
//else
//{
//	Response.Write(jObj.jsonString);
//}

//create json object with nothing in it
iesJSON seriesObj = new iesJSON(); //use default constructor to build empty object
//tell json object to read json file
seriesObj.stats=new iesJSON("{}");

seriesObj.DeserializeFile("D:\\CustomerData\\webspaces\\webspace_00103338\\wwwroot\\icn\\sermonSeries.txt");
if (!File.Exists("D:\\CustomerData\\webspaces\\webspace_00103338\\wwwroot\\icn\\sermonSeries.txt")) { Response.Write("ERROR: Did not find file: " + "D:\\CustomerData\\webspaces\\webspace_00103338\\wwwroot\\s12\\icn\\sermonSeries.txt" + "<br>");
}
if(seriesObj._status == -32)
{
	Response.Write("Failed to open the file correctly" + "<br>");
	Response.Write(seriesObj.stats.jsonString);
}
//else
//{
//	Response.Write("<br>" + "<br>" + "<br>" + seriesObj.jsonString);
//}

iesDB myDB=new iesDB();
string myConnString = "Persist Security Info=False;database=db1007762_wpl12;server=mysql.site.infoquest.com;user id=u1007762_wpl_s12;pwd=#orang3froG";
myDB.setConnectString(myConnString);
myDB.Open();
//myDB.ExecuteSQL(sqlPrep);

//loop through file as if its a record from database, one record at a time
foreach(iesJSON jsonSeg in jObj)
{
	//Makes neccessary changes in json
	int r = jsonSeg.RenameItem("aTitle", "title");
	jsonSeg.Add("category","");
	jsonSeg.Add("status","Active");
	foreach(iesJSON seriesSeg in seriesObj)
	{
		if(jsonSeg["ParentObjID"].CString() == seriesSeg["ObjID"].CString())
		{
			jsonSeg["category"]._value = seriesSeg["aTitle"]._value;
			jsonSeg["status"]._value = seriesSeg["status"]._value;
			break;
		}

	}
	jsonSeg.Add("WorldID","icn");
	jsonSeg.Add("mediatype","Sermon");
	jsonSeg.Add("PublishDate","");
	jsonSeg["PublishDate"]._value = jsonSeg["aDate"]._value + " " + jsonSeg["aTime"]._value;
	jsonSeg.RemoveAtBase(0);
	jsonSeg.RemoveAtBase(0);
	Response.Write("<br>" + "<br>" + jsonSeg.jsonString + "<br>"); 
	//Response.Write(r + "<br>");
	//database creates the primary key 
	
	//Send altered data to database
	myDB.SaveRecord(jsonSeg, "media","pk1");
}

//make more dynamic in the future


/*What is changed:
	aDate and aTime -> PublishDate
	aTitle -> title 
	note -> category
	
	whileID <- icn
	mediaType <- sermon
	status <- active
	
	Fields from params to be left in _json field (no equivalent in media):
		ParentObjID
		speaker 
		writeto
	Fields remaining to be filled in media:
		category (all but 2 "note"s were empty)
		description
*/	

%>