<%@ Page Language="vb" AutoEventWireup="false" Debug="true"%>
<%@ Import Namespace=System.IO %>
<%@Import Namespace="System.Drawing.Imaging" %>

<!-- #include virtual="\sde\default.config" -->

<%
'*** genCalendar.aspx
'*** Developed for Town & Country (world=sde)
'***
'*** NOTE: Must be run as an ADMIN!!!!

CONST ADMIN_WORLD="sde"

Dim strWorld as String, strWorld2 as String, typeFlag as String, strOut as String, uLevel as Integer
ON ERROR RESUME NEXT
strWorld=""
strWorld=Trim(Session("World") & "")
uLevel=0
uLevel=CInt(Trim(Session("UserLevel") & ""))  '*** iTeaCup/OrgSauce    (MODIFY-HERE)
'uLevel=CInt(Trim(Session("AccountAdmin") & ""))  '*** DeltaNet    (MODIFY-HERE)
Err.Clear
ON ERROR GOTO 0

Dim PostDate as String, PostDate2 as String, d as Date

PostDate=Trim(Request.Form("fldPostDate") & "")
If PostDate="" Then PostDate=Now().ToString("MM/dd/yyyy")
d=CDate(PostDate)
PostDate2=Year(d) & "-" & Right("00" & Month(d),2)& "-" & Right("00" & Day(d),2)

If uLevel<5 Then
%>
<HTML><BODY>You do not have permissions to run this utility.</BODY></HTML>
<%
Else
	Dim fromFile as String, toFile as String
	Response.Write("<HTML><BODY><br><h1>POST ROLLING BANNERS</h1><br>Copying banner definitions...<br>")
	Response.Flush
	
	fromFile=genFolder & "\mainbannerimages.cfg"
	toFile=genFolder & "\mainbannerimages2.cfg"
	
	'ON ERROR RESUME NEXT
	File.Delete(toFile)
	File.Copy(fromFile,toFile)
	
	Response.Write("...<br>...<br>... Done.<br><br><br></BODY></HTML>")
	Response.Flush
End If  '***** uLevel<5
%>