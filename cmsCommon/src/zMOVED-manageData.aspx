<%@ Page Language="C#" AutoEventWireup="false" Debug="true" ValidateRequest="false"%>
<!-- #include virtual="..\default.cs" -->
<!-- #include virtual="managedataClass.cs" -->
<%
    iesData dClass = new iesData();

    iesJSON reportResults       = new iesJSON("{}"); //Our report results to be returned to the front end
    iesJSON currentUser         = new iesJSON("{}");

    string dataType, reportType;
    dataType = reportType = string.Empty;

    reportType                  = dClass.getParam("rtype").ToLower();

    //Set any variables
    reportResults["errors"].Value = "";

    //Only logged in users with level 5 or high should be able to use this
    string userNO               = dClass.thisUserNo().ToString();

    if(String.IsNullOrWhiteSpace(userNO) || userNO == "-99"){
        reportResults["errors"].Value = "Sorry, you have been logged out.";
        dClass.OutputError(reportResults);
        return;
    }

    if(String.IsNullOrWhiteSpace(reportType)){
        reportResults["errors"].Value = "Sorry, no report type.";
        dClass.OutputError(reportResults);
        return;
    }

	// CUSTOM PROCSSING CAN GO HERE BASED ON reportType and dClass.getParam() for rtype/pageid/tab/type/cmd/etc.
	
	dClass.processRequest(reportType,reportResults);

    dClass.OutputJSON(reportResults);
%>
