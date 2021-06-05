<%@ Page Language="vb" AutoEventWireup="false" Debug="true"%>
<%@ Import Namespace=System.IO %>
<%@ Import Namespace=System.Web %>
<%@ Import Namespace="System.Net.Mail" %>


<%

'*******
'******* wObject Web Engine v0.6 (default.aspx)
'******* Copyright 2009 - Ted Tyree - TheWebsiteParkingLot.com - All rights reserved.
'*******
'******* NOTE: v0.5 expects that <title></title> NOT be included around {page_title} in main.cfg

'*** NOTE: MUST CHANGE THE #INCLUDE REFERENCE BELOW TO USE THE CORRECT PATH
%>

<!-- #include virtual="\sde\default.config" -->

<script language="vb" runat="server">

'**** GLOBAL PARAMETERS
Dim PageID as String, RequestedPage as String, pageState as String, subTab as String 'pageEdit as Boolean
Dim sURL as String, sPath as String, sLink as String, sTitle as String, sHRef as String, sGoto as String
Dim srch as String, sCat as String, sProduct as String
Dim SearchText2 as String
Dim wItem as Object, pEnv as wObjects.wObjEnv=nothing, wWikiPage as Object=nothing
Dim wWiki as Object=nothing, sWiki as String, WikiFound as string="", wMinEditLevel as Integer=DefaultMinEditLevel
Dim URL As String, fFound as Boolean=False, wikiFileName as String
Dim is_tab_flag as Integer=0, wiki_file_flag as Integer=0, inTemplate as String
Dim ContentText as String="", formID as String="", fContentOnly as String
Dim strDefMsg as String, strParams as String, strFieldList as String, objFields as Object
Dim FORM_Subject as String="", FORM_SendTo as String="", FORM_SendFrom as String=""
Dim nGalleryCount as Integer=-1, GalleryID as String, GalleryMode as String, GalleryImg as Integer, sGalleryImg as String
Dim ProdObj as Object  '*** Product-Object code.
Dim g_LeftMenu as String

Dim ErrMsg as String="", wLevel as Integer=0, msg as String=""

'**** FUTURE: Do we need a version for non HTTPS?  Or modify this code for non-HTTPS  (CHANGE URLpref to 'HTTP:')
'**** FUTURE: Check permissions!!!!

'**** FUTURE: ADD CODE THAT KEEPS THIS PAGE FROM BEING OPENNED BY THE WRONG 'WORLD'

'**** FUTURE: PRELOAD IMAGES

</script>
<%

wInit()

'*** PROCESS THE 'Page' URL PARAMETER OR THE 'Page.ashx' PATH
'*** FUTURE: This routine and the entire default.aspx needs to be updated
'***   to handle Page,SubPage,Tab,SubTab logic (concept still needs to be designed)
'*** For the time being, the Page is always defined and the 'Tab' is found in the
'***   page parameters within the .cfg file (ie. within the <<< header parameters >>>)
Dim sFile as String, pptr as Integer
PageID=LCase(Trim(Request.QueryString("page") & ""))
'*** Check if we are accessing a page via the URL PageName.ashx
sFile=Trim(request.filepath & "")
If LCase(Right(sFile,5))=".ashx" Then
	sFile=Replace(sFile,"\","/")
	pptr=InStrRev(sFile,"/")
	If pptr>0 Then PageID=Mid(sFile,pptr+1,len(sFile)-pptr-5)
End If
If PageID="" Then PageID=Trim(Context.Items("TransferDefault") & "")  '*** From default.aspx forwards in an ALIAS folder
If PageID="" Then PageID=DefaultTAB
RequestedPage=PageID

subTab=LCase(Trim(Request.QueryString("sub") & ""))
If subTab="" Then subTab=DefaultSUBTAB

If LCase(Trim(Request.QueryString("logout") & ""))="true" Then
	If pEnv is Nothing Then pEnv=new wObjects.wObjEnv(wWorld)
	pEnv.SessionLogout(Session)
	msg="Session logged out."
End If

fContentOnly=LCase(Trim(Request.QueryString("contentonly") & ""))

pageState="PUBLIC"
'pageEdit=False
wLevel=0
Dim flagHTTP as Boolean=false

'*** Wiki to be definable by URL - lookup specified wiki in wikiList
'*** FUTURE: We need to produce an error if not found - rather than proceeding with the default wiki!!!
sWiki=MainWiki
If not(wikiList is nothing) Then 
  Dim tswiki as String
  tsWiki=Trim(Request.QueryString("wiki") & "")
  If tswiki<>"" Then tswiki=Trim(wikiList.Param(tswiki) & "")
  If tswiki<>"" Then sWiki=tswiki
End If
	

URL=MainURL
'If LCase(Trim(Request.ServerVariables("HTTPS"))) = "on" Then
  '*** HTTPS requires that the user be logged in...
	
	If Trim(Session("UserLevel") & "") <> "" AND Trim(Session("UserName") & "") <> "" AND _
		Trim(Session("World") & "") <> "" Then

	  ON ERROR RESUME NEXT
	  wLevel=CInt2(Session("UserLevel"),0)
	  If LCase(Session("World") & "")<>LCase(wWorld) Then wLevel=0
	  If wLevel>=MinHttpsLevel Then 
		pageState="HTTPS"
		URL=URLS
		flagHTTP=true
	  End If
	  'If wLevel>=wMinEditLevel Then pageEdit=True
	  Err.Clear
	  ON ERROR GOTO 0
	End If

'End If '*** - HTTPS

'*** Check 'Host' (ie. domain) in the URL - if not in URLHostList, then forward to the correct host (domain)
Dim fwrd as String=""
If URLForwardHost<3 Then
   '*** Check for match of URLHostList
   Dim oHosts as Object, oHost as Object, sHost as String, fMatch as Boolean=False, fMatch2 as Boolean=False
   Dim fHttps as Boolean=False, sHttp as String="HTTP"

   If LCase(Trim(Request.ServerVariables("HTTPS"))) = "on" Then
	fHttps=True
	sHttp="HTTPS"
   End If

   sHost=LCase(Trim(Request.URL.Host & ""))
   If Left(sHost,4)="www." Then sHost=Mid(sHost,5)
   oHosts=SPLIT(URLHostList)
   For Each oHost in oHosts
	If LCase(Trim(oHost & ""))=sHost Then fMatch=True
   Next
   '*** If fMatch=True then no forwarding is necessary.
   If fMatch=False Then
	If URLForwardHost=0 Then
		'*** Requires URLHost (no AdminHost)... so we MUST forward...
		fwrd=sHttp & "://www." & URLHost & Request.URL.PathAndQuery
	Else
		If LCase(Trim(AdminHost))=sHost Then fMatch2=True
		If fMatch2<>True Then
			'*** Does not match URLHostList or AdminHost... must forward...
			If fHttps=True Then
				fwrd="HTTPS://www." & AdminHost & Request.URL.PathAndQuery
			Else
				fwrd="HTTP://www." & URLHost & Request.URL.PathAndQuery
			End If
		Else
			'*** DOES match. 2=OK no forward, 1=Forward if not HTTPS
			If URLForwardHost=1 AND fHttps=False Then
				fwrd="HTTP://www." & URLHost & Request.URL.PathAndQuery
			End If
		End If
	End If
   End If
End If

ON ERROR RESUME NEXT

'world=Trim(request.querystring("world") & "")
'If world="" Then world=Trim(Session("world"))


Err.Clear
ON ERROR GOTO 0

'******* Process a Form?
ON ERROR RESUME NEXT
formID=LCase(Trim(Request.Form("form_id") & ""))
'*** Note: Request.Form("submit") does not get filled in if the user presses 'Enter'
Err.Clear
ON ERROR GOTO 0
If PageID=LCase(LOGIN_Page) Then
  '*** Store the goto page for use after we login.
  sGoto=Trim(Request.QueryString("goto") & "")
  If sGoto<>"" Then Session("GotoPage")=sGoto
End If

If formID<>"" Then
  FORM_Subject=FORM_Subject_DEFAULT
  FORM_SendTo=FORM_SendTo_DEFAULT
  FORM_SendFrom=FORM_SendFrom_DEFAULT

  '*** GENERIC form...
  If PageID="form_submit" Then
	ReadFormFields()
	SaveFormToLog(FormID)

	'*** Setup for email notification
	'*** Use default for FORM_Subject, FORM_SendTo
	'FORM_Fields=""   '*** FUTURE: if needed
	GoSendEmail()

	'*** FUTURE: Check for errors/Display results
	If ErrMsg="" Then
	  PageID=Trim(objFields("OnSuccessGoTo") & "")
	  If PageID="" Then PageID="form_submit_ok"
	Else
	  PageID=Trim(objFields("OnErrorGoTo") & "")
	  If PageID="" Then PageID="form_submit_error"
	  '*** Leave ErrMsg to be included in the HTML of form_submit_error
	End If

	FormCleanup()
  End If

  '*** LOGIN form...
  If PageID=LCase(LOGIN_Page) Then
	Dim uName as String, uPwd as String

	If pEnv is Nothing Then pEnv=new wObjects.wObjEnv(wWorld)

	'*** Logout (clears all session parameters)
	pEnv.SessionLogout(Session)

	'*** Read Login fields
	uName=Trim(request.form("Username") & "")
	uPwd=Trim(request.form("Password") & "")

	'*** Check against hard coded config parameters  (Future: admin users too?)
	'*** Login Request - User: seta admin
	If Trim(MEMBER_LOGIN)<>"" AND Trim(MEMBER_PWD)<>"" Then
	  If LCase(uName)=LCase(MEMBER_LOGIN) AND _
		Trim(uPwd)=MEMBER_PWD Then
			Session("world")=wWorld
			Session("UserLevel")=MEMBER_ULEVEL
			Session("uID")=1
			Session("UserName")=uName
			wLevel=MEMBER_ULEVEL
	  End If
	End If

	'*** FUTURE: Check against GLOBAL parameters

	'*** Check against Database user list
	If Trim(Session("uID") & "")="" Then
		pEnv.SessionLogin(uName,uPwd,Session)
		wLevel=CInt2(Session("UserLevel"),0)
	End If

	Session.Timeout=wSessionTimeout '*** Timeout if user remains idle # minutes

	'*** IF SUCCESSFUL - Re-route to destination or default page
	If wLevel>0 Then
		sGoto=Trim(Session("GotoPage") & "")
		If sGoto<>"" Then
			Session("GotoPage")=""
			Response.Redirect(sGoto)
		Else
			Response.Redirect(MEMBER_DEFAULT_URL)
		End If
	Else
		ErrMsg="Invalid login."
	End If

  End If

End If

'*** Get GALLERY SPECIFIC INFO
If GALLERY_PAGE<>"" AND PageID=LCase(GALLERY_PAGE) Then
	'*** Read GALLERY Specific URL Parameters: Gallery,img,GalleryMode
	GalleryID=Trim(request.querystring("Gallery") & "")
	GalleryMode=Trim(request.querystring("Mode") & "")
	If GalleryMode="" Then GalleryMode=GALLERY_DEFAULT_MODE
	sGalleryImg=Trim(request.querystring("img") & "")
	GalleryImg=1
	If sGalleryImg<>"" Then 
	  If IsNumeric(sGalleryImg) Then GalleryImg=CInt(sGalleryImg)
	End If

	PageID=GALLERY_FILE_PREFIX & GalleryID & "_" & GalleryImg
	
End If

'*** Process USE_WIKI_FILE and wiki_file_found to determine action...
wikiFileName=genFolder & "\" & PageID & ".cfg"
Select Case USE_WIKI_FILE
	Case "never"
		ContentType="wiki"
	Case "tabs"
		If is_tab_page Then
		  ContentType="file"
		  If not(wiki_file_found) Then 
			ErrMsg="Page file not found. (#112)"
			wikiFound="false"
		  Else
			wikiFound="true"
		  End If
		Else
		  ContentType="wiki"	
		End If
	Case "check"
		ContentType="wiki"
		If wiki_file_found Then 
			ContentType="file"
			wikiFound="true"
		End If
	Case "always"
		ContentType="file"
		If not(wiki_file_found) Then 
			ErrMsg="Page file not found. (#114)"
			wikiFound="false"
		Else
			wikiFound="true"
		End If
	Case ELSE  '**** "check"
End Select


'*** LOOK FOR PRODUCT SPECIFIC QUERY/PARAMETERS
ON ERROR RESUME NEXT
sProduct=""
sProduct=Trim(request.querystring("prod") & "")
srch=""
srch=Trim(request.form("SearchText") & "")
sCat=""
SearchText2=Replace(srch,"'"," ")
SearchText2=Replace(SearchText2,""""," ")
sCat=Trim(request.querystring("cat") & "")
Err.Clear
ON ERROR GOTO 0

'*** Get PRODUCT SPECIFIC INFO
If ((Product_Page<>"") AND (PageID=Product_Page)) Then
	If pEnv is Nothing Then pEnv=new wObjects.wObjEnv(wWorld)
	ContentType="products"
	wWikiPage=pEnv.CreateNewWObject()  '*** Empty wObj to hold a few product parameters

	'*** Single Product Specified...
	If sProduct<>"" Then
	  wItem=pEnv.GetObjByID(sProduct)
	  If not(wItem is Nothing) Then
		sProdTitle="<H1>Product #" & wItem.Param("ProductID") & "</H1>"
		wWikiPage.Param("Page_Title")=wItem.Param("Page_Title") & ""
		wWikiPage.Param("Page_Description")=wItem.Param("Page_Description") & ""
		wWikiPage.Param("Page_Keywords")=wItem.Param("Page_Keywords") & ""
	  End If
	Else
	  If srch="" AND sCat="" Then
		sProdTitle="<H1>Product Categories</H1>"
	  Else
		If srch<>"" Then
		  sProdTitle="<H1>Products</H1><I>(Search Results)</I>"
		Else
		  wItem=pEnv.GetObjByID(sCat)
		  If not(wItem is Nothing) Then
		   If LCase(Trim(wItem.Param("PrimaryType") & ""))<>"productline" Then
			sCat="-1"  '*** Not a valid Category!
		   Else
			sProdTitle="<H1>" & wItem.Param("ProdLineTitle") & "</H1>"
		   End If
		  End If  '*** not(wItem is Nothing)
		End If '*** srch<>""
	  End If '*** srch="" AND sCat=""
	End If '*** sProduct<>""

	'*** NOTE: The 'Products' page should not be treated as a fFound tab!
	fFound=False
	
End If '*** PageID=Product_Page

'***** DEBUG DEBUG DEBUG - NOT SURE WHAT THIS IS HERE FOR?!?!
'If PageEdit=True Then
'	If pEnv is Nothing Then pEnv=new wObjects.wObjEnv(wWorld)
'
'	'*** Get Wiki Object and WikiPage Object
'	wWiki=pEnv.WorldParamObj(sWiki)
'	If not(wWiki is Nothing) Then
'	  wWikiPage=wWiki.ParamObj("'" & PageID & "'")
'	End If
'End If

'**** Process Forwarding (if needed)
If fwrd<>"" Then
	Response.Redirect(fwrd)
	CreateHTMLPage("<br>This page has moved.  Transfer to new page.<br><br><br>" & _
				"DESTINATION: " & fwrd & "<br><br><br>" & _
				"If the webpage does not transfer automatically within 10 seconds, " & _
				"please <a href=""" & fwrd & """>CLICK HERE</a>.<br><br><br>")
End If

If ErrMsg<>"" Then
	ContentType="error"
	ContentText="<B>ERROR:</B> " & ErrMsg & "<br><br>"
End If

'**************************************
'*** Make Content Area...
'**************************************
'Response.Write("DEBUG: ContentType=" & ContentType & "<br>") '*** DEBUG DEBUG DEBUG
ProdObj=Nothing  '*** Product-Object code.
Select Case LCASE(ContentType)
	Case "html","file","wiki"
		Send_Content(ContentType)

	Case "error"
		'*** Get error page and send it to the output WITHIN the main HTML
		ContentText=genFolder & "\error.cfg"
		ContentType="file"
		Send_Content("file")

	Case "products"  '*** We should display CATEGORY or PRODUCT Page...
                ContentText=""
			   ContentText=sProdTitle & "<br>"
                            '*** If Product is specified at all - show ONE product!
                            If sProduct <> "" Then
                                '*** Show 1 Product...
                                ContentText=ShowOneProduct(sProduct,sProdTitle)
                            Else
                                '*** If Search is specified (from search tool) then show results...
                                If srch <> "" Then
                                    '*** Show SEARCH Results
                                    ContentText=ContentText & ShowSearchResults(SearchText2)
                                Else
                                    '*** If Category is specified - show ONE category
                                    If sCat <> "" Then
                                        '*** Show ONE Category (this may include showing sub-categories and products)
                                        ContentText=ContentText & ShowOneCategory(sCat)
                                    Else
                                        '*** Nothing specified... show LIST OF TOP LEVEL CATEGORIES
                                        ContentText=ContentText & ShowCategories()
                                    End If '*** sCat<>""
                                End If '*** srch<>""
                            End If '*** sProduct<>""
		If ContentText<>"" Then
			ContentType="html"
			inTemplate=Trim(Product_Template & "")
			If inTemplate="" Then inTemplate=DEFAULT_TEMPLATE
			Send_Content("content")
		End If

	Case Else  '*** Assume 'none' or 'invalid' - do not display anything about the site... not even the header.
		'*** Just display a BLANK error page.
		CreateHTMLPage("Invalid Content Type. Error #373","none")
		'Dim s as String
		's=Request.ServerVariables("URL")  '*** FUTURE: Get base DOMAIN name
		'ReadFile("\_gen\content\invalid.cfg",ContentText)
		Send_Content("html")
End Select

'*** Cleanup
ProdObj=Nothing  '*** Product-Object code.
wItem=Nothing
wWikiPage=Nothing

%>

<script language="vb" runat="server">
    Function ShowOneProduct(ByVal sProduct As String, sProductTitle as String) as String
	Dim sImg as String, sPrices as String, priceHTML as String="",oPrices as Object, oPrice as Object
	Dim sPurchaseForm as String

        'ON ERROR RESUME NEXT
        'pEnv.world = wWorld
        If (wItem Is Nothing) Then wItem = pEnv.GetObjByID(sProduct)
        If Not (wItem Is Nothing) Then
	    priceHTML="<table border=0 cellpadding=0 cellspacing=1>"
	    sPrices=wItem.Param("PriceList")

	    Dim mTitle as String, mID as String, mPrice as String, dPrice as String, mShipping as String, mDisabled as String
	    Dim nTitle as String, nID as String, nPrice as String, nShipping as String, nDisabled as String
	    Dim nTable as Object, nSafety as Integer, nProdCode as String, ppTitle as String

	    mTitle=Trim(wItem.Param("ProductName") & "")
	    mID=Trim(wItem.Param("ProductID") & "")
	    mPrice=Trim(wItem.Param("Price") & "")
	    mShipping=Trim(wItem.Param("Shipping") & "")
	    mDisabled=LCase(Trim(wItem.Param("Disabled") & ""))
	    sPurchaseForm=LCase(Trim(wItem.Param("PurchaseForm") & ""))

	    dPrice=mPrice
	    If Left(dPrice,1)<>"$" Then dPrice="$" & dPrice

	    If Trim(sPrices) = "" Then
			If Trim(mPrice)<>"" Then  '*** Check if no price... if not price then there should be no BuyNow button...
				'*** Single Price
				'*** Add Text and PayPal tag!
				priceHTML=priceHTML & "<tr><td valign=top>" & dPrice & "&nbsp;&nbsp;&nbsp;</td><td valign=top>" & _
					MakeBuyNow(mID,mTitle,mDisabled,mPrice,mShipping,mShipping,sPurchaseForm,sProduct) & _
					"</td></tr>"
			End If
	    Else
		'*** LIST of Prices
		nTable=Nothing  '*** Safety
		nTable = new pParameters.pTable
		nTable.MajorSeparator="|"
		nTable.MinorSeparator=";"
		nTable.BreakOnCR=True
		nTable.RemoveExtraSeparators=True
		nTable.IgnoreBlankRows=True

		sPrices=Replace(sPrices,vbNewLine,"|")   '*** Remove line feeds
		nTable.AddRows(sPrices,True)  '*** FIRST ROW MUST BE COLUMN HEADINGS
		
		nTable.MoveFirst
		nSafety=999
		Do While Not(nTable.EOF)
		  nID=Trim(nTable.Item("SUBCODE") & "")
		  nTitle=Trim(nTable.Item("TITLE") & "")
		  nPrice=Trim(nTable.Item("PRICE") & "")
		  nShipping=Trim(nTable.Item("SHIPPING") & "")
		  nDisabled=LCase(Trim(nTable.Item("DISABLED") & ""))
		  If nID="" Then
			nDisabled="y"
			nID="?"
			nProdCode=nID
		  Else
			nProdCode=mID & "-" & nID
		  End If
		  If nTitle="" Then nTitle=nID
		  ppTitle=mTitle & " - " & nTitle

		  If nPrice="" Then nPrice=mPrice
		  If nShipping="" Then nShipping=mShipping
		  If nDisabled="" Then nDisabled=mDisabled
	
		  '*** Add Text and PayPal tag!
		  priceHTML=priceHTML & "<tr><td valign=top>" & nTitle & " - " & nPrice & "&nbsp;&nbsp;&nbsp;</td><td valign=top>" & _
				MakeBuyNow(nProdCode,ppTitle,nDisabled,nPrice,nShipping,nShipping,sPurchaseForm,sProduct) & _
				"</td></tr>"
		  nTable.MoveNext

		  nSafety=nSafety-1
		  If nSafety<1 Then Exit Do
		Loop
		nTable=Nothing
	    End If
	    PriceHTML=PriceHTML & "</table>"
	    wItem.Param("prices")=priceHTML


	    sImg=wItem.Param("LargeImgURL")
	    If Trim(sImg & "")="" Then sImg=NoImageAvailable
            If LCase(Trim(wItem.Param("PrimaryType") & "")) = "product" Then
                wItem.Param("FULL_PAGE") = "<table border=0 width=""100%""><col><col width=175><tr><td align=left valign=top>" & sProductTitle & "</td><td align=right valign=top><a href='javascript:history.go(-1);'>Return to Previous Page</a></td></tr></table>" & _
                  "<table border=0><col width=50%><col width=50%><tr><td align=center valign=top><img border=0 src='" & sImg & "'></td>" & _
                  "<td rowspan=2 valign=top><B>{ProductName}</B><br>&nbsp;<br>{FullDesc}<br>{prices}</td></tr>" & _
                  "<tr><td>&nbsp;</td></tr></table>"
                ShowOneProduct = wItem.Param("FULL_PAGE")
            End If
        End If
        wItem = Nothing
        'Err.Clear
        'ON ERROR GOTO 0
    End Function

    Function ShowSearchResults(ByVal srch As String) as String
        Dim FieldObj As Object, SearchObj As Object, sWhere As String
        Dim p1cnt As Integer, p2cnt As Integer, qry As String = ""
        Dim p1 As Object, p2 As Object
	
        srch = Replace(srch, Chr(9), " ")
        SearchObj = SplitStr(srch, ", *%")
        FieldObj = SplitStr(SearchFields, ",")

        '**** Search Criteria for a List of Fields
        If SearchObj.count > 0 Then
            p1cnt = 0
            qry = qry & IfNotNull(qry, " AND ") & " ("
            For Each p1 In SearchObj
                If p1cnt > 0 Then
                    qry = qry & ") AND ("
                End If
                p1cnt = p1cnt + 1
                '*** Fields....
                p2cnt = 0
                For Each p2 In FieldObj
                    If p2cnt > 0 Then qry = qry & " OR "
                    p2cnt = p2cnt + 1
                    qry = qry & p2.Value & " LIKE '%" & p1.Value & "%'"
                Next
            Next
            qry = qry & ")"
        End If

        sWhere = "WHERE WorldID='" & wWorld & "' AND Status='Active' AND " & qry
        ShowSearchResults=ShowProductsByCategory(sWhere, True)
    End Function
  
    Function ShowOneCategory(ByVal sCat As String) as String
        Dim sWhere As String, LeftMenu as String = ""
	If Product_LeftMenu=1 Then ShowCategories()  '*** This builds g_LeftMenu if it is needed
	If Product_MultiLevel=False Then
	        sWhere = "WHERE WorldID='" & wWorld & "' AND Status='Active' AND ProdLine=" & sCat
        	ShowOneCategory=ShowProductsByCategory(sWhere, False)
	Else
		'*** First collect the SubCategories to display
		sWhere = "WHERE WorldID='" & wWorld & "' AND Status='Active' " & _
			" AND ObjID IN (SELECT ObjID2 FROM wObjXRef WHERE WorldID='" & wWorld & "' AND Status='Active' " & _
			" AND ObjID1=" & sCat & ")"
		ShowOneCategory=ShowSubCategories(sWhere, False, LeftMenu, True)
		'*** Second collect the Products to display
		sWhere = "WHERE WorldID='" & wWorld & "' AND Status='Active' AND (ProdLine=" & sCat & _
			" OR ObjID IN (SELECT ObjID2 FROM wObjXRef WHERE WorldID='" & wWorld & "' AND Status='Active' " & _
			" AND ObjID1=" & sCat & "))"
		ShowOneCategory=ShowOneCategory & ShowProductsByCategory(sWhere, False, True)
	End If

	Dim CurrCat as String, oldCat as String, cLevel as Integer, sLevel as String, gObj as Object
	Dim nRS As Object, ssql as String, newMenu as String, sHRef as String, newID as String, mnuT as String
	Dim found as Boolean, safety as Integer
	CurrCat=sCat
	cLevel=1
	safety=999
	Do
		'*** Determine if this Category we just displayed is a lop level category or not...
		on error resume next  '*** This needs to be here!  Otherwise it gets an error when checking the iterative levels!
		sLevel=""
		oldCat=CurrCat
		gObj = pEnv.GetObjByID(CurrCat)
		sLevel=Trim(gObj.Param("catLevel") & "")

		If sLevel="1" OR sLevel="3" Then
			'*** Top level category, list all the other top level categories
			cLevel=cLevel+1
			newMenu=""
			ssql="SELECT * FROM ProductLines WHERE WorldID='" & wWorld & "' AND Status='Active' AND (CatLevel='1' OR CatLevel='3') Order By seq,ProdLineTitle"
			nRS=pEnv.dbSrc.GetRS(ssql)
			Do While nRS.Read()
				mnuT=""
				mnuT = Trim(nRS.fGetS("menuTitle") & "")
				If mnuT="" Then mnuT=Trim(nRS.fGetS("ProdLineTitle") & "")
				newID = nRS.fGetS("ObjID")
				sHRef = "/" & wWorld & "/default.aspx?page=" & Product_Page & "&cat=" & newID
				newMenu=newMenu & "{{" & cLevel & "}}<a href='" & sHRef & "'>" & mnuT & "</a><br>"
				If newID=oldCat Then
					newMenu=newMenu & LeftMenu
				End If
 				newMenu=newMenu & "&nbsp;<br>" 
			Loop
			nRS.Close
			nRS=Nothing
			LeftMenu=newMenu
			Exit Do
		Else
			'*** Attempt to find parent Category
			'*** First look for a PRIMARY PARENT...
			found=false
			ssql="SELECT ObjID1 FROM wObjXRef WHERE WorldID='" & wWorld & "' AND Status='Active' AND ObjID2=" & CurrCat & " AND PrimaryParent='Y'"
			nRS=pEnv.dbSrc.GetRS(ssql)
			If nRS.Read() Then
				CurrCat=nRS.fGetS("ObjID1")
				found=True
			End If
			nRS.Close
			nRS=Nothing

			'*** If not found, look for any parent (we'll take the minimum ObjID)
			If found=False Then
				ssql="SELECT Min(ObjID1) FROM wObjXRef WHERE WorldID='" & wWorld & "' AND Status='Active' AND ObjID2=" & CurrCat
				nRS=pEnv.dbSrc.GetRS(ssql)
				If nRS.Read() Then
					CurrCat=nRS.GetS(0)
					found=True
				End If
				nRS.Close
				nRS=Nothing
			End If 

			'*** If still not found we are done our search and menu creation... can't go no further
			If found=False Then Exit Do

			'*** FOUND: Get a list of menu items from the parent category...
			cLevel=cLevel+1
			newMenu=""
			ssql="SELECT * FROM ProductLines WHERE WorldID='" & wWorld & "' AND Status='Active' " & _
				"AND ObjID IN (SELECT ObjID2 FROM wObjXRef WHERE WorldID='" & wWorld & "' AND Status='Active' " & _
				"AND ObjID1=" & CurrCat & ") Order By seq,ProdLineTitle"
			nRS=pEnv.dbSrc.GetRS(ssql)
			Do While nRS.Read()
				mnuT=""
				mnuT = Trim(nRS.fGetS("menuTitle") & "")
				If mnuT="" Then mnuT=Trim(nRS.fGetS("ProdLineTitle") & "")
				newID = nRS.fGetS("ObjID")
				sHRef = "/" & wWorld & "/default.aspx?page=" & Product_Page & "&cat=" & newID
				newMenu=newMenu & "{{" & cLevel & "}}<a href='" & sHRef & "'>" & mnuT & "</a><br>"
				If newID=oldCat Then
					newMenu=newMenu & LeftMenu
				End If
			Loop
			nRS.Close
			nRS=Nothing
			LeftMenu=newMenu
		End If

		safety=safety-1
		If safety<=0 THen Exit Do
	Loop

	'*** Replace the various levels in the LeftMenu with bullets and such...
	Dim rpStr as String
	LeftMenu=Replace(LeftMenu,"{{" & cLevel & "}}","&bull;&nbsp;")
	rpStr="&nbsp;&nbsp;&gt;&nbsp;"
	Do While cLevel>1
		cLevel=cLevel-1
		LeftMenu=Replace(LeftMenu,"{{" & cLevel & "}}",rpStr)
		rpStr="&nbsp;&nbsp;" & rpStr
	Loop

	If Trim(ShowOneCategory)="" Then ShowOneCategory="No items to display at this time."

	If Product_LeftMenu=2 Then
			ShowOneCategory="<TABLE border=0 width=725><TR><TD width=195 valign=top>" & LeftMenu & "</TD><TD width=5 valign=top><img border=0 height=375 width=3 src='/ecsi/images/vline.gif'></TD><TD width=525 valign=top>" & ShowOneCategory & "</TD></TR></TABLE>"
	End If
	If Product_LeftMenu=1 Then
			ShowOneCategory="<TABLE border=0 width=1025><TR><TD width=250 valign=top>" & g_LeftMenu & "</TD><TD width=5 valign=top><img border=0 height=575 width=3 src='/ecsi/images/vline.gif'></TD><TD width=880 valign=top>" & ShowOneCategory & "</TD></TR></TABLE>"
	End If
	
    End Function
	    
    Function ShowCategories() as String
        Dim nRS As Object, sHRef as String, rsp as String=""
        Dim col As Integer, sImg as String, ssql as String
	Dim LeftMenu as String="", sTitle as String, sMenu as String

        'ON ERROR RESUME NEXT
        'pEnv.world = wWorld

        rsp="<table border=0 width=""95%"">"


	ssql="SELECT * FROM ProductLines WHERE WorldID='" & wWorld & "' AND Status='Active'"
	If Product_MultiLevel=True Then ssql=ssql & " AND (CatLevel='1' OR CatLevel='3')"
	ssql=ssql & " ORDER BY seq,ProdLineTitle"
	
        nRS = pEnv.dbSrc.GetRS(ssql)
        col = 0
        Do While nRS.Read()
            If col = 0 Then rsp=rsp & "<tr>"

	    sImg = Trim(nRS.fGetS("SmallImgURL") & "")
	    If sImg="" Then sImg=NoImageAvailable

	    sTitle=Trim(nRS.fGetS("ProdLineTitle") & "")
	    sMenu=Trim(nRS.fGetS("menuTitle") & "")
	    If sMenu="" Then sMenu=sTitle

	    sHRef = "/" & wWorld & "/default.aspx?page=" & Product_Page & "&cat=" & nRS.fGetS("ObjID")
            rsp=rsp & "<td align=center valign=top><a href='" & sHRef & _
              "'><img border=0 src='" & sImg & "' Alt='Product Line: " & sTitle & "' Title='Click for a list of products.'></a><BR><B><a hRef='" & sHRef & "' Title='Click for a list of products.'>" & sMenu & "</a></B>" & _
              "</td>"
	    LeftMenu=LeftMenu & "&bull;&nbsp;<a href='" & sHRef & "'>" & sMenu & "</a><br>&nbsp;<br>"
            col = col + 1
            If col >= CategoriesPerRow Then
                rsp=rsp & "</tr>"
                col = 0
            End If
        Loop
	nRS.Close
	nRS=Nothing

        '*** Add blank cells to complete the table
        Do While col > 0
            rsp=rsp & "<td></td>"
            col = col + 1
            If col >= CategoriesPerRow Then
                rsp=rsp & "</tr>"
                col = 0
            End If
        Loop

        rsp=rsp & "<tr height=35><td colspan=" & CategoriesPerRow & " align=center valign=bottom><a href='#top'>Back to top</a></td><tr>"
        rsp=rsp & "</table>"
		
	g_LeftMenu=LeftMenu
	If Product_LeftMenu>=1 Then
			rsp="<TABLE border=0 width=725><TR><TD width=195 valign=top>" & LeftMenu & "</TD><TD width=5 valign=top><img border=0 height=375 width=3 src='/DEFAULT-ENGINE/images/vline.gif'></TD><TD width=525 valign=top>" & rsp & "</TD></TR></TABLE>"
	End If
	ShowCategories=rsp

        'Err.Clear
        'ON ERROR GOTO 0

    End Function

    Function ShowSubCategories(ByVal sWhere As String, ByVal ShowCatHead As Boolean, ByRef LeftMenu as String, Optional BlankIfNone as Boolean=False) as String
	Dim nRS As Object, gSQL As String, hRef As String, sImg as String, rsp as String=""
        Dim col As Integer, cnt as Integer, currCat As String = "", sTitle As String, sMenu as String
	Dim lMenu as String=""

	rsp="<table border=0 width=""95%"">"
	gSQL = "SELECT * FROM ProductLines " & sWhere & " ORDER BY seq,ProdLineTitle"
	nRS = pEnv.dbSrc.GetRS(gSQL)
        col = 0
	cnt = 0
        Do While nRS.Read()
            sTitle = nRS.fGetS("ProdLineTitle")
	    sMenu = nRs.fGetS("MenuTitle")
	    If sMenu="" Then sMenu=sTitle	


            If col = 0 Then rsp=rsp & "<tr>"

	    sImg = ""
	    sImg = Trim(nRS.fGetS("SmallImgURL") & "")
	    If sImg="" Then sImg=NoImageAvailable
            hRef = "/" & wWorld  & "/" & Product_Page & ".ashx?Cat=" & nRS.fGetS("ObjID")
            rsp=rsp & "<td align=center valign=top><a href='" & hRef & "'><img border=0 src='" & sImg & "' Alt='Subcategory: " & _
		sMenu & " (" & nRS.fGetS("ObjID") & ")' Title='Click to open subcategory.'></a><br/><a href='" & hRef & "' Title='Click to open subcategory.'>" & _
		sMenu & "</a>" & _
		"<br>&nbsp;</td>"
	    lMenu=lMenu & "{{1}}<a href='" & hRef & "'>" & sMenu & "</a><br>"

            col = col + 1
	    cnt = cnt + 1
            If col >= ProductsPerRow Then
                rsp=rsp & "</tr>"
                col = 0
            End If
        Loop
	nRS.Close
	nRS=Nothing

        '*** Add blank cells to complete the table
        Do While col > 0
            rsp=rsp & "<td></td>"
            col = col + 1
            If col >= ProductsPerRow Then
                rsp=rsp & "</tr>"
                col = 0
            End If
        Loop

        rsp=rsp & "<tr height=35><td colspan=" & ProductsPerRow & " align=center valign=bottom><a href='#top'>Back to top</a></td><tr>"
        rsp=rsp & "</table>"
	If (cnt=0 AND BlankIfNone=True) Then
		rsp=""
		lMenu=""
	End If
	ShowSubCategories=rsp
	LeftMenu=LeftMenu & lMenu

    End Function

    Function ShowProductsByCategory(ByVal sWhere As String, ByVal ShowCatHead As Boolean, Optional BlankIfNone as Boolean=False) as String
        Dim nRS As Object, gSQL As String, hRef As String, sImg as String, rsp as String=""
        Dim col As Integer, cnt as Integer, currCat As String = "", newCat As String

        'ON ERROR RESUME NEXT
        'pEnv.world = wWorld

        rsp="<table border=0 width=""95%"">"
	
        gSQL = "SELECT * FROM Products " & sWhere & " ORDER BY ProdLineTitle, ProductName"
        '*** DEBUG
        'rsp=rsp & "<tr><td colspan=" & ProductsPerRow & ">" & gSQL & "</td><tr>"
        nRS = pEnv.dbSrc.GetRS(gSQL)
        col = 0
	cnt = 0
        Do While nRS.Read()
            newCat = nRS.fGetS("ProdLineTitle")
            If newCat <> currCat Then
                '*** Start a new category...
                currCat = newCat
                '*** Add blank cells to complete the prev category...
                Do While col > 0
                    rsp=rsp & "<td></td>"
                    col = col + 1
                    If col >= ProductsPerRow Then
                        rsp=rsp & "</tr>"
                        col = 0
                    End If
                Loop
                '*** Add a row for the new category...
                If ShowCatHead Then
                    rsp=rsp & "<tr><td bgcolor=#B20036 align=left colspan=" & ProductsPerRow & "><font color=#FFFFFF><B>&nbsp;" & _
                       newCat & "</B></font></td></tr>"
		    '*** FUTURE: <br/>" & nRS.fGetS("ProdLineBrief") & "
                End If
            End If

            If col = 0 Then rsp=rsp & "<tr>"

	    sImg = Trim(nRS.fGetS("SmallImgURL") & "")
	    If sImg="" Then sImg=NoImageAvailable
            hRef = "/" & wWorld  & "/default.aspx?page=" & Product_Page & "&prod=" & nRS.fGetS("ObjID")
            rsp=rsp & "<td align=center valign=top><a href='" & hRef & "'><img border=0 src='" & sImg & _
		"' Alt='Product: " & nRS.fGetS("ProductName") & " (" & nRS.fGetS("ProductID") & _
		")' Title='Click for product details and a larger image.'></a><br/><a href='" & hRef & _
		"' Title='Click for product details and a larger image.'>" & nRS.fGetS("ProductName") & _
		"</a>" & "<br>&nbsp;</td>"

	    cnt = cnt + 1
            col = col + 1
            If col >= ProductsPerRow Then
                rsp=rsp & "</tr>"
                col = 0
            End If
        Loop
	nRS.Close
	nRS=Nothing

        '*** Add blank cells to complete the table
        Do While col > 0
            rsp=rsp & "<td></td>"
            col = col + 1
            If col >= ProductsPerRow Then
                rsp=rsp & "</tr>"
                col = 0
            End If
        Loop

	If cnt=0 Then
	  rsp=rsp & "<tr height=35><td colspan=" & ProductsPerRow & " align=left valign=bottom>No items to display at this time.</td><tr>"
	End If

        rsp=rsp & "<tr height=35><td colspan=" & ProductsPerRow & " align=center valign=bottom><a href='#top'>Back to top</a></td><tr>"
        rsp=rsp & "</table>"
	If cnt=0 AND BlankIfNone=True Then rsp=""
	ShowProductsByCategory=rsp

        'Err.Clear
        'ON ERROR GOTO 0
    End Function

    '*** SplitStr()
    '*** NOTE: NEEDED BECAUSE WE SPLIT BASED ON MORE THAN 1 CHARACTER!
    Function SplitStr(ByVal nString As String, ByVal CharList As String) As Object
        Dim cnt As Integer, LastF As Integer, ListLen As Integer
        Dim px As Integer, f As Integer, s As Integer, newStr As String
	  
        SplitStr = New SortedList(New CaseInsensitiveComparer())
        cnt = 0
        LastF = 1
        ListLen = Len(CharList)
        Do
            px = 1
            f = 99999
            Do While px <= ListLen
                s = InStr(LastF, nString, Mid(CharList, px, 1))
                If s > 0 And s < f Then f = s
                px = px + 1
            Loop
            If f = 99999 Then Exit Do
            newStr = Mid(nString, LastF, f - LastF) & ""
            If Trim(newStr) <> "" Then
                cnt = cnt + 1
                SplitStr.Add(cnt, newStr)
            End If
            LastF = f + 1
        Loop
        newStr = Mid(nString, LastF, 1 + Len(nString) - LastF) & ""
        If Trim(newStr) <> "" Then
            cnt = cnt + 1
            SplitStr.Add(cnt, newStr)
        End If
    End Function

    '**** Utility Routines
    Function IfNotNull(ByVal objVar As Object, ByVal strReturn As String, Optional ByVal strElse As String = "") As String
        If Trim(objVar & "") = "" Then
            IfNotNull = strElse
        Else
            IfNotNull = strReturn
        End If
    End Function

    '*** ReadFile()
    '*** Read the entire text file specified by sFileName into ReadIntoVar
    '*** sFileName should include the full path
    Sub ReadFile(sFileName as String, ByRef ReadIntoVar as String)
	Dim wFile as Object

	ReadIntoVar=""  '**** Default incase the following fails.

	ON ERROR RESUME NEXT
	'*** FUTURE: Provide error trapping/handling and display error messages for developers

	wFile=New StreamReader(sFileName)
	ReadIntoVar=wFile.ReadToEnd()
	wFile.Close()
	Err.Clear
	ON ERROR GOTO 0
    End Sub


    '*********************************************
    '******** PROCESS CONTENT AREA ***************
    '*********************************************

    Sub Send_Content(ByVal cntType as String)
	Dim safety as Integer=99999, ptr as Integer, ptr2 as Integer, tag as String, buffer as String=""
	Dim inBuf(READ_BUFFER_LEN+4) as Char, inCnt as Integer, BufLen as Integer
	Dim inTemplatePath as String, inFile as Object

	'*** FUTURE: Check for cases such as wiki file expected, but file is missing.

	cntType=LCase(Trim(cntType))
	Select Case cntType
	  CASE "file"
		'*** Open the HTML File (for Reading)
		ParseWikiFile(wWikiPage,ContentText,WikiFileName,True)

		'*** FUTURE: check URL/wiki to see if we should use a different template!
		'***   In the URL specify template=name
		'***   In the wiki file, specify a header parameter template=name
		'***   NOTE: The URL template overrides the wiki file template
		'***   FUTURE: Create a wiki header parameter that disables the URL 'template' parameter
		DetermineTemplate()

	  CASE "wiki"

		'*** Get wiki from DB...
		GetWikiPage()

		'*** FUTURE: check URL/wiki to see if we should use a different template!
		'***   In the URL specify template=name
		'***   In the wiki file, specify a header parameter template=name
		'***   NOTE: The URL template overrides the wiki file template
		'***   FUTURE: Create a wiki header parameter that disables the URL 'template' parameter
		DetermineTemplate()

	  CASE "content"
		'*** Set Template (if blank, use the default)
		If Trim(inTemplate & "")="" Then inTemplate=DEFAULT_TEMPLATE
		
	  CASE "html"
		buffer=ContentText

	  CASE ELSE  '**** Invalid ContentType (ie. cntType)
		buffer="<HTML><BODY>Error on page.  Invalid ContentType (#137)</BODY></HTML>"
		cntType="html"

	End Select

	'*** Open the HTML Template file (if specified)
	inFile=Nothing
	'Response.Write("DEBUG: inTemplate=" & inTemplate & "<br>") '*** DEBUG DEBUG DEBUG
	If LCASE(Trim(inTemplate))="none" OR fContentOnly="true" Then
		buffer="{{content_area}}"
	Else
	  If Trim(inTemplate)<>"" Then
		inTemplatePath= TemplateFolder & "\" & inTemplate & ".cfg"
		'Response.Write("DEBUG: inTemplatePath=" & inTemplatePath & "<br>") '*** DEBUG DEBUG DEBUG

		'*** FUTURE: Check if file exists first
		'*** FUTURE: Template may possibly be in the DB as a wObject? (for now it is always a file)
		ON ERROR RESUME NEXT
		inFile=new StreamReader(inTemplatePath)
		If Err.Number>0 Then
			ErrMsg="Failed to open template file: " & inTemplatePath & " (#153)"
			cntType="error"
		End If
	  End If
	End If

		'*** FUTURE: Check for other errors...

	If cntType<>"error" Then
	  Do
		If not(inFile is Nothing) Then
		  BufLen=Len(buffer)
		  inCnt=0
		  If BufLen<READ_BUFFER_LEN Then inCnt=inFile.Read(inBuf,0,READ_BUFFER_LEN-BufLen)
		  If inCnt>0 Then buffer=buffer & Left(inBuf,inCnt)
		End If

		If Len(buffer)<=0 Then Exit Do

		'*** Check if buffer starts with {{
		ptr=-1
		ptr2=-1
		ptr=InStr(buffer,"{{")
		If ptr=1 Then
			tag=""
			ptr2=InStr(3,buffer,"}}")
			If ptr2>0 Then 
				tag=Mid(buffer,ptr+2,ptr2-ptr-2)
				buffer=GenerateTag(tag) & Mid(buffer,ptr2+2)
			Else
				'*** No close }} found!  Just send the {{ as is...
				Response.Write("{{")
				ptr2=1
				tag=""
				buffer=Mid(buffer,ptr2+2)
			End If
			
		Else
			'*** Find next {{
			If ptr>1 Then 
				Response.Write(Left(buffer,ptr-1))
				buffer=Mid(buffer,ptr)
			Else
				'*** No {{ found... send entire buffer minus BUFFER_OVERLAP
				'*** This will keep us from having the first character of the {{
				'*** at the end of one buffer block and the second character
				'*** at the beginning of the next block!
				If Len(buffer)<=(READ_BUFFER_LEN-BUFFER_OVERLAP) Then
				  Response.Write(buffer)
				  buffer=""
				Else
				  Response.Write(Left(buffer,(READ_BUFFER_LEN-BUFFER_OVERLAP)))
				  buffer=Mid(buffer,(READ_BUFFER_LEN-BUFFER_OVERLAP)+1)
				End If
			End If
		End If
			
		safety=safety-1
		If safety<=0 Then Exit Do
	  Loop


	If not(inFile is Nothing) Then inFile.close()
	inFile=Nothing

	End If   '**** cntType<>"error"

	'*** FUTURE: What to do if cntType="error"
    End Sub
 
    '*** GenerateTag()
    '*** MODIFY HERE: This routine may be edited to define new web content tags.
    '***
    '*** Parameters within the web content that are surrounded by {{ }} symbols are
    '*** recognized as tags and this routine is called to generate the HTML to be
    '*** be included in place of the tag.  The HTML generated should be passed back
    '*** to the calling routine as the return value of GenerateTag()
    '***
    '*** NOTE: There is no need to include all tags in every HTML template.
    '*** If some portion of the template (such as page_title) is going to be the
    '*** same on every page, then it can just be included in the actual HTML
    '*** and no {{page_title}} tag is needed
    '***
    Function GenerateTag(ByVal Tag as String) as String
	Dim subTag as String, p as Integer

	wMinEditLevel=DefaultMinEditLevel
	If not(wWikiPage is Nothing) Then _
		wMinEditLevel=CInt2(wWikiPage.Param("MinEditLevel"),DefaultMinEditLevel)

	subTag=""
	p=InStr(Tag,":")
	If p>0 Then
		subTag=Trim(Mid(Tag,p+1))
		Tag=Left(Tag,p-1)
	End If

	'Response.Write("DEBUG: Tag=" & Tag & "<br>") '**** DEBUG DEBUG DEBUG
	GenerateTag=""
	Select Case LCase(Trim(Tag))
	  Case "content_area"
		'*** THIS TAG SHOULD ONLY BE INCLUDED IN THE MASTER HTML FILE!
		'*** It should only be accessed when we are generating a page on
		'*** the fly.  (otherwise, return blank)

		'*** Put the wiki content into the buffer (for processing)
		GenerateTag=ContentText
		ContentText=""

'**** admin_links (old method - use {{admin_block}} instead and be sure to create admin_main.cfg in the TemplatesFolder
'	  Case "admin_links"
'		GenerateTag=GenAdminLinks()

	  Case "admin_block"
		'*** Be sure to create admin_main.cfg in the TemplatesFolder (or if {{admin:alias}} specified then admin_alias.cfg)
		GenerateTag=GenAdminBlock(subTag)

	  Case "edit_page_link"
		'*** This tag is to be used in the admin_block
		GenerateTag=GenEditLink()

	  Case "admin_menu_link"
		'*** This tag is to be used in the admin_block
		GenerateTag=GenAdminLink()

	  Case "err_block"
		'*** Be sure to create admin_main.cfg in the TemplatesFolder (or if {{admin:alias}} specified then admin_alias.cfg)
		GenerateTag=GenErrBlock(subTag)

	  '*** NOTE: USE 'title' FOR TEXT VERSION OF PAGE TITLE
	  Case "page_title"
		'*** Page_Title can either be specified by the WikiPage in the header,
		'*** or specified in the default.config file.  The header parameter overrides.
		If not(wWikiPage is Nothing) Then GenerateTag=Trim(wWikiPage.Param("Page_Title") & "")
		If GenerateTag="" Then GenerateTag=Trim(Page_Title)
		If GenerateTag<>"" Then GenerateTag="<title>" & GenerateTag & "</title>"

	  '*** NOTE: USE 'page_title' FOR <title> TAG IN HEADER CONTAINING PAGE TITLE
	  Case "title"
		'*** Title can either be specified by the WikiPage in the header,
		'*** or specified in the default.config file.  The header parameter overrides.
		If not(wWikiPage is Nothing) Then GenerateTag=Trim(wWikiPage.Param("Title") & "")

	  Case "sitetitle"
		GenerateTag=SiteTitle

	  Case "description", "page_description"    '*** Get from <<<Page Parameters?>>>
		If not(wWikiPage is Nothing) Then GenerateTag=Trim(wWikiPage.Param("Page_Description") & "")
		If GenerateTag<>"" Then GenerateTag="<meta name=""Description"" content=""" & GenerateTag & """>"

	  Case "keywords", "page_keywords"   '*** Get from <<<Page Parameters>>>
		If not(wWikiPage is Nothing) Then GenerateTag=Trim(wWikiPage.Param("Page_Keywords") & "")
		If GenerateTag<>"" Then GenerateTag="<meta name=""Keywords"" content=""" & GenerateTag & """>"

	  Case "logged_in"
		'*** Display User Logged In info
		If Trim(Session("uID") & "")<>"" AND Trim(Session("UserName") & "")<>"" Then
		  GenerateTag="Logged In: " & Session("UserName") & _
		     "&nbsp;&nbsp;<a href='" & URL & "/default.aspx?logout=true'>Logout</a>"
		End If

	  Case "loginmsg"   '***** (MODIFY_HERE - message if NOT logged in!)
		If Trim(Session("uID") & "")<>"" AND Trim(Session("UserName") & "")<>"" Then
		   GenerateTag=""
		Else
		   GenerateTag=subTag
		End If	

	  Case "loggedinmsg"   '***** (MODIFY_HERE - message if user IS logged in!)
		If Trim(Session("uID") & "")<>"" AND Trim(Session("UserName") & "")<>"" Then
		   GenerateTag=subTag
		Else
		   GenerateTag=""
		End If

	  Case "adminmsg"   '***** (MODIFY_HERE - message/link if IS admin!)
		Dim ul as Integer
		ul=0
		ON ERROR RESUME NEXT
		ul=CInt2(Session("UserLevel"),0)
		Err.Clear
		ON ERROR GOTO 0
		If ul>=5 Then
		   GenerateTag=subTag
		Else
		   GenerateTag=""
		End If

	  Case "css"
		'*** Include the main css code or link (can be multiple)
		'*** FUTURE: Create ability to make a LINK instead of including the actual code
		GenerateTag=WriteCss(subTag)

	  Case "js", "javascript"
		'*** Include the main javascript file or link (or multiple if needed)
		'*** FUTURE: Create ability to make a LINK instead of including the actual code
		GenerateTag=WriteJavascript(subTag)

	  Case "track"
		'*** Include track.cfg to track via Google Analytics or other tool
		GenerateTag=WriteTrackScript(subTag)

	  Case "banner"
		'*** Include a banner ad file
		GenerateTag=WriteBanner(subTag)

	  Case "world"
		GenerateTag=wWorld

	  Case "user_name"
		GenerateTag=Trim(Session("UserName") & "")
	  Case "user_id"
		GenerateTag=Trim(Session("uID") & "")
	  Case "user_level"
		GenerateTag=Trim(Session("UserLevel") & "")

	  Case "urlphoto"
		GenerateTag=Trim(Request.QueryString("photo") & "")

	  Case "photopage"  '**** Format: {{photopage:name_of_object}
		GenerateTag=WritePhotoPage(SubTag)

	  Case "menu"   '**** Menu tag (usually "{{menu:main}}
		'*** Generate the menu bar...
		GenerateTag=WriteMenu(subTag)

	  Case "submenu"  '**** Menu tag looks up "mnu_sub_{{PageID}}.cfg"
		Dim SubMenuPage as String=""
		If not(wWikiPage is Nothing) Then SubMenuPage=Trim(wWikiPage.Param("SubMenu") & "")
		If SubMenuPage="" Then SubMenuPage=PageID
		GenerateTag=WriteMenu("sub_" & SubMenuPage)

	  Case "submenuname"  '*** Special coding for highlighting tabs base on the submenu
		If not(wWikiPage is Nothing) Then GenerateTag=Trim(wWikiPage.Param("SubMenu") & "")

	  '*** NEW CONCEPT: FUTURE: Iron out the kinks!
	  Case "submenupage"  '**** Menu tag used to lookup a wiki page and include it as a menu!  "submenu_{{PageID}}.cfg" in content folder
		'*** FUTURE: Handle ability to read Wiki objects here, too (currently, subpage must be a file)
		Dim tWikiPage as Object, tContentText as String, tWikiFileName as String
		Dim SubMenuPage as String=""
		If not(wWikiPage is Nothing) Then SubMenuPage=Trim(wWikiPage.Param("SubMenu") & "")
		If SubMenuPage="" Then SubMenuPage=PageID
		tWikiFileName=genFolder & "\submenu_" & SubMenuPage & ".cfg"
		ParseWikiFile(tWikiPage,tContentText,tWikiFileName,False)
		GenerateTag=Trim(tContentText)
		tWikiPage=Nothing

	  Case "page"
		GenerateTag=PageID

	  Case "subtab"
		GenerateTag=SubTab

	  Case "subpage"
		'*** FUTURE: Handle ability to read Wiki objects here, too (currently, subpage must be a file)
		Dim tWikiPage as Object, tContentText as String, tWikiFileName as String
		tWikiFileName=genFolder & "\" & SubTag & ".cfg"
		ParseWikiFile(tWikiPage,tContentText,tWikiFileName,False)
		GenerateTag=Trim(tContentText)
		tWikiPage=Nothing

	  Case "searchtext"
		GenerateTag=SearchText2

	  Case "page_photo"
		GenerateTag=PagePhoto()

	  Case "random_photo"
		GenerateTag=RandomPhoto(subTag)

'************************ PHOTO GALLERY BEGIN...
	  Case "gallery"
		GenerateTag=GalleryID

	  Case "gallerycount"
		If not(wWikiPage is Nothing) Then GenerateTag=Trim(GetGalleryCount() & "")

	  Case "gallerymode"
		GenerateTag=GalleryMode

	  Case "galleryinvmode"
		If LCase(GalleryMode)="auto" Then
			GenerateTag="pause"
		Else
			GenerateTag="auto"
		End If

	  Case "gallerymenu"   '**** Menu for the current Gallery
		'*** Generate the menu bar...
		GenerateTag=WriteMenu("Gallery_" & GalleryID)

	  Case "imgcurrent"
		GenerateTag=Trim(GalleryImg & "")

	  Case "imgnext"
		Dim nImgVal as Integer
		nImgVal=GalleryImg+1
		If nImgVal>GetGalleryCount() Then nImgVal=1
		GenerateTag=Trim(nImgVal & "")

	  Case "imgprev"
		Dim nImgVal as Integer
		nImgVal=GalleryImg-1
		If nImgVal<1 Then nImgVal=GetGalleryCount()
		GenerateTag=Trim(nImgVal & "")
'************************** ...PHOTO GALLERY END

	  '*************** MODIFY-HERE: Product-Object code...
	  Case "productfield"
		GenerateTag=GetProdField(SubTag)
		
	  Case "productsmainmenu"
	     ShowCategories()  '*** This builds g_LeftMenu if it is needed
		 GenerateTag=g_LeftMenu

	  Case "p", "param", "parameter"
		If not(wWikiPage is Nothing) Then GenerateTag=wWikiPage.Param(subTag)

	  Case "querystring"
	    ON ERROR RESUME NEXT
	    GenerateTag=Request.QueryString(SubTag)
		ERR.CLEAR
		ON ERROR GOTO 0
		
	  Case "formfield"
		ON ERROR RESUME NEXT
	    GenerateTag=Request.Form(SubTag)
		ERR.CLEAR
		ON ERROR GOTO 0
		
	  Case "error_message", "errmsg", "err_msg"
		GenerateTag=ErrMsg

	  'Case ELSE   '*** Blank tag or invalid tag... return null string

	End Select
	
    End Function

''*****************************************************************************  NOTE: NO LONGER USED!!!! (USE GenAdminBlock)
'    Function GenAdminLinks() as String
'	 If wLevel>=1 Then
'
'  '*** IF WE ARE LOGGED IN AND THIS PERSON HAS PRIVILEDGES... Allow edit of Wiki page.  (future, check if page is editable?!)
'  '*** OR have two versions of the page above, one with the EDIT link in it.
'  If wLevel>=wMinEditLevel Then
'    Dim EditURL as String, sCmd as String
'    If wWikiPage is Nothing Then
'    	'*** Wiki Page is missing - link to CREATE it...
'    	EditURL=EWIKI & "&obj=*new*&saveas=" & sWiki & "." & PageID
'    	sCmd="Create Page"
'    Else
'	'*** Wiki Page exists - link to UPDATE it
'	EditURL=EWIKI & "&obj=" & sWiki & "." & PageID
'	sCmd="Edit"
'    End If
'    If PageID="products" Then EditURL="http://www.OrgSauce.org/orgadmin/EditWObj/tbl-edit.aspx?world=" & wWorld & "&table=Products&class=EditClasses.Edit-Products"
'    GenAdminLinks="&nbsp;&nbsp;" & _
'	"<a hRef='" & URLS & "/admin'>Admin</a>&nbsp;&nbsp;<a hRef='" & EditURL & "'>" & sCmd & "</a>" & _
'	"&nbsp;"
'  End If
' End If
'   End Function '**** GenAdminLinks()
'
''*****************************************************************************

'***************************************************************************** 
   '*************** MODIFY-HERE: Product-Object code...
   Function GetProdField(SubTag) as String
	GetProdField=""
	If Trim(SubTag)="" Then Exit Function
	If LoadProdField=False Then Exit Function
	GetProdField=ProdObj.Param(SubTag)
   End Function

   '*************** MODIFY-HERE: Product-Object code...
   '**** Return TRUE if Object loaded OK
   '**** Return False if failed to load object
   '**** (Also returns TRUE if object is already loaded)
   Function LoadProdField() as Boolean
	LoadProdField=True  '*** Default=OK
	If not(ProdObj is Nothing) Then Exit Function
	If Trim(sProduct)="" Then 
		LoadProdField=False
		Exit Function
	End If
	ProdObj=pEnv.GetObjByID(sProduct)
	If ProdObj is Nothing Then
		LoadProdField=False
		Exit Function
	End If
   End Function

'***************************************************************************** 
    Function GenAdminBlock(ByVal sName as String) as String
	Dim sBlockPath as String
	If wLevel>=1 Then

	 '*** IF WE ARE LOGGED IN AND THIS PERSON HAS PRIVILEDGES... Allow edit of Wiki page.  (future, check if page is editable?!)
	 '*** Here we reference admin_main.cfg  (or if {{admin:alias}} specified then admin_alias.cfg)	
	 If wLevel>=wMinEditLevel Then

	   If Trim(sName)="" Then sName=DEFAULT_TEMPLATE

	   GenAdminBlock=""
	   sBlockPath= TemplateFolder & "\admin_" & sName & ".cfg"
	   ReadFile(sBlockPath,GenAdminBlock)

	 End If
	End If
   End Function '**** GenAdminBlock()

'*****************************************************************************

   Function GenEditLink() as String
	'*** IF WE ARE LOGGED IN AND THIS PERSON HAS PRIVILEDGES... Allow edit of Wiki page. 	
	If wLevel>=wMinEditLevel Then
	  Dim EditURL as String, LinkTitle as String,tsWiki as String

	  tsWiki=EWIKI
	  If PopupEditWindow=True Then tsWiki=tsWiki & "&return=close"

	  'If wWikiPage is Nothing Then  'DEBUG DEBUG DEBUG - used wikiFound flag instead...
	  If LCase(Trim(wikiFound & ""))<>"true" Then
		'*** Wiki Page is missing - link to CREATE it...
		EditURL=tsWiki & "&obj=*new*&saveas=" & sWiki & "." & RequestedPage
		LinkTitle="Create Page"
	  Else
		'*** Wiki Page exists - link to UPDATE it
		EditURL=tsWiki & "&obj=" & sWiki & "." & RequestedPage
		LinkTitle="Edit"
	  End If

	  If ((Product_Page<>"") AND (PageID=Product_Page)) Then EditURL=EditProductsURL

	  If PopupEditWindow=True Then
	    GenEditLink="<a hRef=""#"" onClick=""Javascript:pup=window.open('" & EditURL & "','WObjEditor','menubar=no,status=no,width=950,height=700,toolbar=no,scrollbars=yes,location=no,directories=no,resizable=yes');pup.focus();return false;"" >" & LinkTitle & "</a>"
	  Else
	    GenEditLink="<a hRef='" & EditURL & "'>" & LinkTitle & "</a>"
	  End If
	End If
   End Function '**** GenEditLink()

   Function GenAdminLink() as String
	'*** IF WE ARE LOGGED IN AND THIS PERSON HAS PRIVILEDGES... Allow edit of Wiki page. 
	If wLevel>=wMinEditLevel Then

	  GenAdminLink="<a hRef='" & AdminLinkURL & "'>" & AdminLinkTitle & "</a>"

	End If
   End Function '**** GenAdminLink()

'***************************************************************************** 
    Function GenErrBlock(ByVal sName as String) as String
	Dim sBlockPath as String

	 '*** IF THERE WAS AN ERROR MESSAGE GENERATED...	
	 If Trim(ErrMsg & "")<>"" Then

	   If Trim(sName)="" Then sName=DEFAULT_TEMPLATE

	   GenErrBlock=""
	   sBlockPath= TemplateFolder & "\err_" & sName & ".cfg"
	   ReadFile(sBlockPath,GenErrBlock)

	 End If
   End Function '**** GenErrBlock()
'***************************************************************************** 
   Function WriteMenu(ByVal sMenuName as String) as String
	Dim sMenuPath as String

	If Trim(sMenuName)="" Then sMenuName=DEFAULT_MENU
	
	WriteMenu=""
	sMenuPath= TemplateFolder & "\mnu_" & sMenuName & ".cfg"
	If CheckMMenu=True Then
	  Dim sMenuPath2=TemplateFolder & "\mnu_" & sMenuName & "_" & PageID & ".cfg"
	  If File.Exists(sMenuPath2) Then sMenuPath=sMenuPath2
	End If
	ReadFile(sMenuPath,WriteMenu)

   End Function

   Function WriteCss(ByVal sName as String) as String
	'*** This script find the specified .css file and returns its content
	'*** (to be included in the HTML response stream)
	'*** .css file may be in the Template Folder or the Root folder.
	Dim sf as String

	If Trim(sName)="" Then sName=DEFAULT_CSS

	WriteCss=""
	sf=TemplateFolder & "\" & sName & ".css"
	If FILE.Exists(sf) Then
		ReadFile(sf,WriteCss)
	Else
	  sf=baseFolder & "\" & sName & ".css"
	  If FILE.Exists(sf) Then
		ReadFile(sf,WriteCss)
	  End If
	End If
	If WriteCss<>"" Then
	  WriteCss="<style type=""text/css"">" & vbNewLine & _
		"<!" & "--" & vbNewLine & _
		WriteCss & _
		"--" & ">" & vbNewLine & _
		"<" & "/style>" & vbNewLine
	End If
		
   End Function

   Function WriteJavascript(ByVal sName as String) as String
	'*** This script find the specified .js file and returns its content
	'*** (to be included in the HTML response stream)
	'*** .js file may be in the Template Folder or the Root folder.
	Dim sf as String

	If Trim(sName)="" Then sName=DEFAULT_JS

	WriteJavascript=""
	sf=TemplateFolder & "\" & sName & ".js"
	If FILE.Exists(sf) Then
		ReadFile(sf,WriteJavascript)
	Else
	  sf=baseFolder & "\" & sName & ".js"
	  If FILE.Exists(sf) Then
		ReadFile(sf,WriteJavascript)
	  End If
	End If

	If WriteJavascript<>"" Then
	  WriteJavascript="<SCRIPT type=""text/javascript"" LANGUAGE=""JavaScript"">" & vbNewLine & _
		"<!" & "--" & vbNewLine & _
		WriteJavascript & _
		"// --" & ">" & vbNewLine & _
		"<" & "/SCRIPT>" & vbNewLine
	End If
   End Function

   Function WriteTrackScript(ByVal sName as String) as String
	'*** This script find the specified .cfg file and return its contents
	'*** (to be included in the HTML response stream)
	'*** .cfg file may be in the Template Folder or the Root folder.
	Dim sf as String
	WriteTrackScript=""

	If Trim(sName)="" Then sName=DEFAULT_TRACK

	'*** NOTE: The HTTPS protocol does not like the non-secure Google Analytics tracker
        '*** Here we switch between the standard track.cfg and track_https.cfg for HTTPS pages.  
	'*** (ie. It is possible to track HTTPS pages using the SSL Google Analytics script)
	'*** MODIFY-HERE - !!ANOTHER OPTION!! Include http{{loggedinmsg:s}}// in the track.cfg file!!!
	If LCase(Trim(Request.ServerVariables("HTTPS"))) = "on" Then 
		If TRACK_HTTPS=False Then Exit Function
		sName=sName & "_https"
	End If

	sf=TemplateFolder & "\" & sName & ".cfg"
	If FILE.Exists(sf) Then
		ReadFile(sf,WriteTrackScript)
	Else
	  sf=baseFolder & "\" & sName & ".cfg"
	  If FILE.Exists(sf) Then
		ReadFile(sf,WriteTrackScript)
	  End If
	End If
   End Function


   Function WriteBanner(ByVal sName as String) as String
	'*** This script find the specified banner.cfg file and returns its content
	'*** (to be included in the HTML response stream)
	'*** File must be in the Banner folder.
	Dim bf as String

	WriteBanner=""
	If Trim(sName)="" Then Exit Function
	If Trim(BannerFolder)="" Then Exit Function

	bf=BannerFolder & "\" & sName & ".cfg"
	If FILE.Exists(bf) Then
		ReadFile(bf,WriteBanner)
	End If
		
   End Function

'***************************************************
   Function WritePhotoPage(ByVal sObjPage) as String
	Dim sLookup as String, ppObj as Object, f as Object, fList as Object, sFolder as String
	Dim sURL as String, ImageExt as String, sExt as String, sBaseName as String
	Dim FoundType as String, BaseBaseName as String, ImagesPerRow as Integer, CurrCol as Integer
	Dim sGridSize as String, ppMinViewLevel as Integer, ppMinEditLevel as Integer

	ON ERROR RESUME NEXT
	If pEnv is Nothing Then pEnv=new wObjects.wObjEnv(wWorld)
	WritePhotoPage=""

	'*** Get PhotoPage wObj
	sLookup=Trim(PhotoPages & "")
	If sLookup="" Then Exit Function
	ppObj=pEnv.WorldParamObj(sLookup & "." & sObjPage)
'WritePhotoPage=WritePhotoPage & "DEBUG DEBUG DEBUG sObjPage=" & sLookup & "." & sObjPage & "<br>"
	If (ppObj is Nothing) Then Exit Function
'WritePhotoPage=WritePhotoPage & "Found!<br>"
	'*** Get image sizes
	sGridSize=Trim(ppObj.Param("GridImageSize") & "")
'WritePhotoPage=WritePhotoPage & "DEBUG: GridImageSize=" & sGridSize & "<br>"
	'*** Check view level permissions
	ppMinViewLevel=CInt2(ppObj.Param("MinViewLevel"),999)
	If ppMinViewLevel<OverrideMinViewLevel Then ppMinViewLevel=OverrideMinViewLevel
	ppMinEditLevel=CInt2(ppObj.Param("MinEditLevel"),999)
'WritePhotoPage=WritePhotoPage & "DEBUG: ppMinViewLevel=" & ppMinViewLevel & "<br>"
'WritePhotoPage=WritePhotoPage & "DEBUG: ppMinEditLevel=" & ppMinEditLevel & "<br>"
'WritePhotoPage=WritePhotoPage & "DEBUG: wLevel=" & wLevel & "<br>"
	If wLevel<ppMinViewLevel Then Exit Function

	'*** Admin link if permissions allow
	If wLevel>=ppMinEditLevel Then
		WritePhotoPage=WritePhotoPage & "[ <a href='" & ppObj.Param("GenerateURL") & "'>Generate Photos</a> | <a href='" & ppObj.Param("RegenerateURL") & "'>Regenerate All</a> ]<br>"
	End If

	'*** Get list of all images...
	ImagesPerRow=CInt2(ppObj.Param("ImagesPerRow"),3)
	CurrCol=1
	ImageExt=Trim(ppObj.Param("ImageExt") & "")
	If Left(ImageExt,1)<>"." Then ImageExt="." & ImageExt
	sFolder=Trim(ppObj.Param(sGridSize & "_Folder") & "")
	sURL=Trim(ppObj.Param(sGridSize & "_URL") & "")
	fList=Directory.GetFiles(sFolder)
	
	WritePhotoPage=WritePhotoPage & "<table border=0 cellpadding=0 cellspacing=5>"
	For Each f in fList
		sExt=""
		sBaseName=""
		sBaseName=(PATH.GetFileName(f) & "")
		sExt=trim(PATH.GetExtension(f) & "")
		If lcase(sExt)=lcase(ImageExt) Then

		  '*** Display Image
			If CurrCol>ImagesPerRow Then CurrCol=1
			If CurrCol=1 Then WritePhotoPage=WritePhotoPage & "<tr>"
			
			WritePhotoPage=WritePhotoPage & "<td><a href='" & ppObj.Param("ViewPhoto") & _
				"&file=" & sBaseName & "'>" & "<img border=0 src=""" & sURL & "/" & sBaseName & """></a></td>"
			If CurrCol=ImagesPerRow Then WritePhotoPage=WritePhotoPage & "</tr>"
			WritePhotoPage=WritePhotoPage & VbCrLf
			CurrCol=CurrCol+1

		End If
	Next
	Do While CurrCol<=ImagesPerRow
	   If CurrCol=1 Then WritePhotoPage=WritePhotoPage & "<tr>"
	   WritePhotoPage=WritePhotoPage & "<td></td>"
	   If CurrCol=ImagesPerRow Then WritePhotoPage=WritePhotoPage & "</tr>"
	   WritePhotoPage=WritePhotoPage & VbCrLf
	   CurrCol=CurrCol+1
	Loop
	WritePhotoPage=WritePhotoPage & "</table>" & VbCrLf
	Err.Clear
	ON ERROR GOTO 0

   End Function

'***************************************************

   Function PagePhoto() as String
	Dim f as String

	PagePhoto=""
	f=PgPhotoFolder & "\" & PageID & PgPhotoSuffix
	If FILE.Exists(f) Then
		PagePhoto="<img border=0 src='" & PgPhotoURL & "/" & PageID & PgPhotoSuffix & "'>"
		Exit Function
	End If

	'*** Page specific photo not found... try the default photo...
	f=PgPhotoFolder & "\" & Default_Page_Photo & PgPhotoSuffix
	If FILE.Exists(f) Then
		PagePhoto="<img border=0 src='" & PgPhotoURL & "/" & Default_Page_Photo & PgPhotoSuffix & "'>"
		Exit Function
	End If

	'*** Otherwise we are returning nothing.

   End Function

   Function RandomPhoto(ByVal PhotoPrefix as String) as String
	Dim n as Double, i as Integer, c as Integer, f as String, cLast as Integer
	Dim safety as Integer=999

	RandomPhoto=""
	If Trim(PhotoPrefix)="" Then PhotoPrefix=Default_Random_Photo

	RANDOMIZE
	n=((RandomPhotoCount * Rnd) + 1)
	i=CInt(n)
	cLast=RandomPhotoCount+99
	c=RandomPhotoCount
	Do
		
		If i<cLast Then
		  '*** Check for photo 
		  f=PgPhotoFolder & "\" & PhotoPrefix & i & PgPhotoSuffix
		  If FILE.Exists(f) Then
		    RandomPhoto="<img border=0 src='" & PgPhotoURL & "/" & PhotoPrefix & i & PgPhotoSuffix & "'>"
		    Exit Function
		  End If
		  cLast=i
		End If

		'*** Photo not found (move # down to lower 50% - thus looking for a lower number photo)
		c=c/2
		If c<=1 Then Exit Do
		If i>c Then i=i-c

		safety=safety-1
		If safety<=0 Then Exit Do
	Loop

	'*** Check one last time for photo1.gif
		f=PgPhotoFolder & "\" & PhotoPrefix & "1" & PgPhotoSuffix
		If FILE.Exists(f) Then
		  RandomPhoto="<img border=0 src='" & PgPhotoURL & "/" & PhotoPrefix & "1" & PgPhotoSuffix & "'>"
		  Exit Function
		End If

	'*** Check for photo.gif - just in case
		f=PgPhotoFolder & "\" & PhotoPrefix  & PgPhotoSuffix
		If FILE.Exists(f) Then
		  RandomPhoto="<img border=0 src='" & PgPhotoURL & "/" & PhotoPrefix & PgPhotoSuffix & "'>"
		  Exit Function
		End If

	'*** OK - thats it - there is no photo to display!

   End Function

'*****************************************************************************
   Function GetGalleryCount() as Integer
	If nGalleryCount<0 Then 

	  Dim sGalleryCount as String=""
	  nGalleryCount=0
	  If not(wWikiPage is Nothing) Then sGalleryCount=wWikiPage.Param("GalleryCount")
	  If sGalleryCount<>"" Then
	    If IsNumeric(sGalleryCount) Then nGalleryCount=CInt(sGalleryCount)
	  End If
	End If
	GetGalleryCount=nGalleryCount
   End Function

'*****************************************************************************
   Sub WriteSubMenu(sSubMenuName as String)
   End Sub

'*****************************************************************************
   Sub GetWikiPage()


  '****** GET THE WIKI PAGE from wObject database table!
  Dim sParam as String
  Dim sWikiText as String, sPub as String=""
  Dim mViewLevel as Integer=0, mEditLevel as Integer  '*** mEditLevel currently not used!
  Dim allowView as Boolean=False, allowEdit as Boolean=False

  If pEnv is Nothing Then pEnv=new wObjects.wObjEnv(wWorld)

  wikiFound="false" '*** default
  If PageID<>"" Then
    If wWiki is Nothing Then wWiki=pEnv.WorldParamObj(sWiki)

    '*** See if Wiki has a default view level... (0 allows PUBLIC view/edit)
    ON ERROR RESUME NEXT
    sParam=Trim(wWiki.Param("MinViewLevel") & "")
    If sParam<>"" Then
      mViewLevel=CInt2(sParam,999)
    End If
    If mViewLevel<OverrideMinViewLevel and PageID<>LCase(LOGIN_Page) Then mViewLevel=OverrideMinViewLevel
    allowView=False
    If wLevel>=mViewLevel Then allowView=True
    If mViewLevel>0 AND LCase(Trim(wWiki.World))<>LCase(Trim(Session("World") & "")) Then allowView=False

    Err.Clear
    ON ERROR RESUME NEXT

    If not(wWiki is Nothing) Then
	If wWikiPage is Nothing Then wWikiPage=wWiki.ParamObj("'" & PageID & "'")

	'*** See if Wiki has a default view level...
	ON ERROR RESUME NEXT
	sParam=Trim(wWikiPage.Param("MinViewLevel") & "")
	If sParam<>"" Then
	  mViewLevel=CInt2(sParam,999)
	End If
	If mViewLevel<OverrideMinViewLevel and PageID<>LCase(LOGIN_Page) Then mViewLevel=OverrideMinViewLevel
	allowView=False
	If wLevel>=mViewLevel Then allowView=True
	'*** SPECIAL CODE TO ALLOW VIEWER/OWNER TO VIEW PAGE
	If LCase(Trim(wWikiPage.Param("Owner") & ""))=LCase(Trim(Session("uObjID") & "")) Then allowView=True
	If LCase(Trim(wWikiPage.Param("Viewer") & ""))=LCase(Trim(Session("uObjID") & "")) Then allowView=True
	'************ END - ALLOW VIEWER/OWNER TO VIEW
	If mViewLevel>0 AND LCase(Trim(wWiki.World))<>LCase(Trim(Session("World") & "")) Then allowView=False

	Err.Clear
	ON ERROR RESUME NEXT


	  If not(wWikiPage is Nothing) Then

    	    '*** NOTE: Here we add a parameter to wOBJ (DO NOT SAVE wOBJ WITH THIS ADDED PARAMETER!)
	    '*** This parameter enables wObj to toggle between HTTP/HTTPS
	    wWikiPage.Param("URLpref")=pre 
	    wikiFound="true"
	  Else
		ErrMsg="Object not found (wWiki)."
		TransferToPage(INVALID_PAGE)
		Exit Sub
	  End If
    ELSE
	ErrMsg="Object not found (wWikiPage)."
	TransferToPage(INVALID_PAGE)
	Exit Sub
    End If
    
	
    
  End If

  '*** WRITE THE WIKI PAGE...
	sHref=""  '*** IS THIS NEEDED???  FUTURE: KEEP sHREF?!?!?!
	If allowView Then
	  If not(wWikiPage is nothing) Then

	 
	    sTitle=Trim(wWikiPage.Param("Title") & "")
	    If sTitle<>"" Then sTitle="<H1>" & sTitle & "</H1>"  '*** FUTURE: IS THIS USED LATER?!??
	    sWikiText=wWikiPage.Param("WikiHTML") & ""
	    pEnv.PrepWiki(sWikiText,wWiki,pre)
	    ContentText=sWikiText

	    '*** FUTURE: Make sure we have edit permissions!
	    '*** NOTE: Provide an edit page even if Wiki is missing (allows user to create the wiki!)
	    sHref=EWIKI & "&obj=" & sWiki & "." & PageID

	  Else  '*** wWikiPage is Nothing
	    '*** OBJECT IS MISSING - CREATE IT!!!
	    '*** FUTURE: Make sure we have edit permissions!
	    sHref=EWIKI & "&obj=*new*&SaveAs=" & sWiki & "." & PageID
	  End If
	Else   '*** NOT allowView=True

	  GetLoginIf()

	End If  '*** allowView=True

  wWiki = Nothing
  'wWikiPage=Nothing
  Err.Clear
  ON ERROR GOTO 0 
   End Sub   '****** GetWikiPage()

   Sub TransferToPage(sFileName as String)
	If lcase(trim(sFileName))=lcase(trim(PageID)) OR lcase(trim(sFileName))=lcase(trim(RequestedPage)) Then
		'*** ERROR: We cannot transfer to the page we are already on! (could cause a recursive loop!)
		CreateHTMLPage("Page not found: '" & PageID & "'. Error #232")
		Exit Sub
	End If
	PageID=sFileName
	wikiFileName=genFolder & "\" & PageID & ".cfg"
	wiki_file_flag=0  '*** Reset
	
	SELECT CASE USE_WIKI_FILE
	  Case "never"
		GetWikiPage()
	  Case "check","tabs"
		If wiki_file_found Then 
		  'ParseWikiFile()
		  ParseWikiFile(wWikiPage,ContentText,WikiFileName,True)
		Else
		  GetWikiPage()
		End If
	  Case "always"
		'ParseWikiFile()
		ParseWikiFile(wWikiPage,ContentText,WikiFileName,True)
	END SELECT
   End Sub

   Sub CreateHTMLPage(sHTML as String, Optional sErrorTemplate as String=ERROR_TEMPLATE)
	'******* Create an empty wObj for storage of parameters...
	If pEnv is Nothing Then pEnv=new wObjects.wObjEnv(wWorld)

	pEnv.ClearContext()  '*** We must do this since we may have called the routine recursively.
	wWikiPage=Nothing    '*** Clear out previous object (if recursive)
	wWikiPage=pEnv.CreateNewWObject()

	ContentText=sHTML
	If Trim(ErrMsg & "")<>"" Then ContentText=ContentText & "<br><br>" & ErrMsg
	If Trim(sErrorTemplate & "")<>"" Then wWikiPage.Param("template")=TRIM(sErrorTemplate & "")
	ContentType="html"
   End Sub

   Sub ParseWikiFile(ByRef rWikiPage as Object, ByRef rContentText as String, ByRef rWikiFileName as String, AllowTransfer as Boolean)
	Dim p as Integer=1, sWikiContent as String, sWikiHeader as String
	Dim ohParams as Object, ohp as Object, p2 as Integer, sParam aS String, mViewLevel as Integer=0, allowView as Boolean=True

	'******* Create an empty wObj for storage of parameters...
	If pEnv is Nothing Then pEnv=new wObjects.wObjEnv(wWorld)

	pEnv.ClearContext()  '*** We must do this since we may have called the routine recursively.
	rWikiPage=Nothing    '*** Clear out previous object (if recursive)
	rWikiPage=pEnv.CreateNewWObject()

	ReadFile(rWikiFileName, sWikiContent)
	'Response.Write("DEBUG: Read File: Content Length=" & Len(sWikiContent) & "<br>")  '*** DEBUG DEBUG DEBUG

	'*** Read header from "<<<" up to ">>>"
	If Left(sWikiContent,3)="<<<" Then
		'*** Header found... get header info...
		p=InStr(sWikiContent,">>>")
		If p<=0 Then
			p=1
		Else
			sWikiHeader=Mid(sWikiContent,4,p-4)
			'*** Parse parameters in header.
			ohParams=SPLIT(sWikiHeader,"|")
			For Each ohP in ohParams
			  'Response.Write("DEBUG: header: " & ohp & "<br>") '*** DEBUG DEBUG DEBUG
			  p2=InStr(ohp,"=")
			  If p2>=1 Then
				rWikiPage.Param(Left(ohp,p2-1))=pEnv.wUnPakSafe(Mid(ohp,p2+1))
			  Else
				rWikiPage.Param(ohp)="true"
			  End If
			Next
			p=p+3
		End If
	End If

	'*** Check HEADER parameters to see if there is restricted access to this page!
	sParam=Trim(rWikiPage.Param("MinViewLevel") & "")
	If sParam<>"" then mViewLevel=CInt2(sParam,999)
	If mViewLevel<OverrideMinViewLevel and PageID<>LCase(LOGIN_Page) Then mViewLevel=OverrideMinViewLevel
	If mViewLevel>0 Then
	  allowView=False
	  If wLevel>=mViewLevel Then allowView=True
	  '*** SPECIAL CODE TO ALLOW VIEWER/OWNER TO VIEW PAGE
	  If LCase(Trim(rWikiPage.Param("Owner") & ""))=LCase(Trim(Session("uObjID") & "")) Then allowView=True
	  If LCase(Trim(rWikiPage.Param("Viewer") & ""))=LCase(Trim(Session("uObjID") & "")) Then allowView=True
	  '************ END - ALLOW VIEWER/OWNER TO VIEW
	  If mViewLevel>0 AND LCase(Trim(wWorld))<>LCase(Trim(Session("World") & "")) Then allowView=False
	End If
	

	'*** Get remainder of the content area...
	If allowView=True Then
		rContentText=Mid(sWikiContent,p)
	Else
		If AllowTransfer Then 
			GetLoginIf()
		Else
			ErrMsg="Page access restricted."
			CreateHTMLPage("Page not displayed.")
		End If
	End If
   End Sub

   Sub GetLoginIf()
	Dim qrystr as String, s as String

	'**** In this case the user does not have permissions to view the page.
	'**** If they are logged in, display an error message.
	'**** If they are not logged in, display the login page.
	If Trim(Session("UserName") & "")<>"" Then
		ErrMsg="Access to this page has been restricted."
		CreateHTMLPage("Page not displayed.")
	Else
		'*** There is an important check here to make sure we are not trying to access the Login page already
		'*** This may save us from an infinite recursive loop!  (if somehow the login page ends up with restrictive access)
		If LCase(Trim(PageID))<>LCase(Trim(LOGIN_PAGE)) Then 
			'*** Get URL and URL parameters
			qryStr = Request.ServerVariables("URL")
			s = Trim(Request.ServerVariables("Query_String") & "")
			If s<>"" Then qryStr=qryStr & "?" & s
			Session("GotoPage")=qrystr	

			'GetLoginWiki()  '**** old method 1
			'TranferToWikiPage(LOGIN_PAGE)   '***** old method 2
			'**** Here we would rather literally transfer the page to the login page so that the URL at the top changes, too
			Response.Redirect(LOGIN_URL)
			CreateHTMLPage("<br>Transfer to login page.<br><br><br>" & _
				"If the webpage does not transfer automatically within 10 seconds, " & _
				"please <a href=""" & LOGIN_URL & """>CLICK HERE TO GO TO THE LOGIN PAGE</a>.<br><br><br>")
		End If
	End If
   End Sub

'   Sub GetLoginWiki()
'	PageID=LOGIN_PAGE
'	wikiFileName=genFolder & "\" & PageID & ".cfg"
'	wiki_file_flag=0  '*** Reset
'
'	SELECT CASE USE_WIKI_FILE
'	  Case "never"
'		GetWikiPage()
'	  Case "check","tabs"
'		If wiki_file_found Then 
'		  ParseWikiFile()
'		Else
'		  GetWikiPage()
'		End If
'	  Case "always"
'		ParseWikiFile()
'	END SELECT
'   End Sub

   Function wiki_file_found() as Boolean
     If wiki_file_flag=0 Then
	'Response.Write("DEBUG: wiki_file_found(): File=" & wikiFileName & "<br>")  '**** DEBUG DEBUG DEBUG
	If FILE.Exists(wikiFileName) Then
		'Response.Write("&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; File found.<br>")  '**** DEBUG DEBUG DEBUG
		wiki_file_flag=1
	Else
		'Response.Write("&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; File NOT found.<br>")  '**** DEBUG DEBUG DEBUG
		wiki_file_flag=-1
	End If
     End If
    
     If wiki_file_flag=1 Then 
		wiki_file_found=True
     Else
		wiki_file_found=False
     End If
   End Function

   Function is_tab_page() as Boolean

     '*** FUTURE: Somehow we need to know if we are on a tab page or not. !!!
     '*** For now TabList is hard coded.
	
     If is_tab_flag=0 Then
	'*** FUTURE: This is a dangerous way to check because if the PageID is a portion of a tab name,
	'***  it will still be considered a match!  Really need to split the list and check for a
	'***  full match.
	If InStr(LCASE(TabList),TRIM(LCASE(PageID))) Then
		is_tab_flag=1
	Else
		is_tab_flag=-1
	End If
     End If
    
     If is_tab_flag=1 Then 
		is_tab_page=True
     Else
		is_tab_page=False
     End If
   End Function

   Sub DetermineTemplate()
	Dim flagOverride as String

	inTemplate=""
	If wWikiPage is Nothing Then
		inTemplate=DEFAULT_TEMPLATE
	Else
		flagOverride=LCASE(Trim(wWikiPage.Param("override_url_template") & ""))
		If flagOverride<>"true" Then inTemplate=Trim(Request.QueryString("template") & "")
		If inTemplate="" Then inTemplate=Trim(wWikiPage.Param("template") & "")
		If inTemplate="" Then inTemplate=DEFAULT_TEMPLATE
	End If		
   End Sub

   Function MakeBuyNow(ProdID as String,ProdTitle as String,fDisabled as String,ProdPrice as String,Ship1 as String,Ship2 as String,fPurchaseForm as String,ssObj as String) as String

	If fDisabled="y" OR fDisabled="yes" Then
		MakeBuyNow="<img border=0 src=""/" & wWorld  & "/images/BuyNow-d.gif"" style=""margin:2px;"">"
		Exit Function
	End If

	'**** NEW! SPECIAL CODE TO PROVIDE AN INTERIM FORM FOR PRODUCT (for example - get name/address for a business card)
	If Trim(fPurchaseForm)<>"" Then
		MakeBuyNow="<a href=""/" & wWorld & "/form_" & fPurchaseForm & ".ashx?prod=" & ssObj & "&select=" & ProdID & """>" & _
			"<img border=0 src=""/" & wWorld  & "/images/BuyNow.gif"" style=""margin:2px;"" /></a>"
		Exit Function
	End If

	MakeBuyNow=""
	MakeBuyNow=MakeBuyNow & "<form target=paypal action=""https://www.paypal.com/cgi-bin/webscr"" method=post class=Form2a style=""margin:2px;"">"
	MakeBuyNow=MakeBuyNow & "<input type=image src=""/" & wWorld  & "/images/BuyNow.gif"" border=0 name=submit alt=""Purchase this item using PayPal - it's fast, free and secure! – Click here."">"
	MakeBuyNow=MakeBuyNow & "<input type=hidden name=add value=1>"
	MakeBuyNow=MakeBuyNow & "<input type=hidden name=cmd value=""_cart"">"
	MakeBuyNow=MakeBuyNow & "<input type=hidden name=business value=""cprheartstarters@aol.com"">"
	MakeBuyNow=MakeBuyNow & "<input type=hidden name=page_style value=""" & wWorld & """>"
	MakeBuyNow=MakeBuyNow & "<input type=hidden name=item_name value=""" & ProdTitle & """>"
	MakeBuyNow=MakeBuyNow & "<input type=hidden name=item_number value=""" & ProdID & """>"
	MakeBuyNow=MakeBuyNow & "<input type=hidden name=amount value=""" & ProdPrice & """>"
	MakeBuyNow=MakeBuyNow & "<input type=hidden name=shipping value=""" & Ship1 & """>"
	MakeBuyNow=MakeBuyNow & "<input type=hidden name=shipping2 value=""" & Ship2 & """>"
	MakeBuyNow=MakeBuyNow & "<input type=hidden name=currency_code value=""USD"">"
	MakeBuyNow=MakeBuyNow & "<input type=hidden name=no_shipping value=""2"">"   '**** FUTURE: WE MAY NEED TO SET THIS BASED ON ABOVE VALUES
	MakeBuyNow=MakeBuyNow & "<input type=hidden name=cbt value=""CLICK HERE TO COMPLETE YOUR PURCHASE."">"
	MakeBuyNow=MakeBuyNow & "<input type=hidden name=return value=""" & MainURL & "/default.aspx?page=PurchaseComplete"">"
	MakeBuyNow=MakeBuyNow & "<input type=hidden name=cancel_return value=""" & MainURL & "/default.aspx?page=PurchaseCancel"">"
	MakeBuyNow=MakeBuyNow & "</form>"
    End Function

'************************************************
'************************************************ FORM UTILITIES
'************************************************

    Sub ReadFormFields()
        
        '*** Read FORM parameters (Fields should all have the prefix 'fld_')
        Dim fld As Object, pFld As String, pVal As String, pDefMsg As String = ""
	Dim fldList as Object, sBold as String="", sBold2 as String=""
        Const chkBox As String = "_CHECKBOX"

	If pEnv is Nothing Then pEnv=new wObjects.wObjEnv(wWorld)

	If FORM_IsHTML=True Then 
		sBold="<B>"
		sBold2="</B>"
	End If

	strDefMsg = "********************************************************************" & vbNewLine & _
		    "********************************************************************" & vbNewLine & _
		    "*** " & SiteTitle & " - Web Form Submission" & vbNewLine & _
		    "*** " & sBold & Request.Form("form_id") & sBold2 & vbNewLine & _
		    "********************************************************************" & vbNewLine & _
		    "********************************************************************" & vbNewLine & vbNewLine

	objFields=New SortedList(New CaseInsensitiveComparer())
        If Trim(FORM_Fields & "")<>"" Then
	  fldList=SPlit(FORM_Fields,",")
	  For Each fld in fldList
		'pVal = Request.Form.Item("fld_" & fld) & ""
		pVal = Request.Form.Item(fld) & ""

		'*** WORK AROUND FOR CHECK BOX!!!  (should have suffix "_CHECKBOX")
                If UCase(Right(fld, len(chkBox))) = chkBox Then
                    fld = Left(fld, len(fld) - len(chkBox))
                    If pVal <> "" Then
                        pVal = "Yes"
                    Else
                        pVal = ""
                    End If
                End If

		If LCase(fld)<>"form_id" Then    '**** form_id is already included in the header
		  If (Len(fld) + Len(pVal)) > 100 Then
                    '*** LONG STRING VALUE
                    strDefMsg = strDefMsg & vbNewLine & sBold & fld & sBold2 & ":" & vbNewLine & pVal & vbNewLine & vbNewLine
                  Else
                    strDefMsg = strDefMsg & sBold & fld & sBold2 & ": " & pVal & vbNewLine
                  End If
		End If
		If strFieldList<>"" Then strFieldList=strFieldList & ","
		strFieldList=strFieldList & fld
		If strParams<>"" Then strParams=strParams & "|"
		strParams=strParams & fld & "=" & pEnv.wPakSafe(pVal)

                ''*** Also put the fields into the frmObj
                'oForm.Param(pFld) = "" '*** just in case the next line fails, don't want left-over data.
                'oForm.Param(pFld) = Request.Form(pVal)

		objFields(fld)=pVal
	  Next
	End If

	If FORM_IncludeOtherFields=True Then
          For Each fld In Request.Form.Keys
            'If LCase(Left(fld, 4)) = "fld_" Then
	    If LCase(fld)<>"submit" AND LCase(fld)<>"reset" Then
                'pFld = Mid(fld, 5)
		pFld = fld
                pVal = Request.Form.Item(fld) & ""

                
                 '*** WORK AROUND FOR CHECK BOX!!!  (should have suffix "_CHECKBOX")
                 If UCase(Right(pFld, len(chkBox))) = chkBox Then
                    pFld = Left(pFld, len(pFld) - len(chkBox))
                    If pVal <> "" Then
                        pVal = "Yes"
                    Else
                        pVal = ""
                    End If
                 End If

                If not(objFields.ContainsKey(pFld)) Then

		 If LCase(fld)<>"form_id" Then    '**** form_id is already included in the header
                   If (Len(pFld) + Len(pVal)) > 100 Then
                    '*** LONG STRING VALUE
                    strDefMsg = strDefMsg & vbNewLine & sBold & pFld & sBold2 & ":" & vbNewLine & pVal & vbNewLine & vbNewLine
                   Else
                    strDefMsg = strDefMsg & sBold & pFld & sBold2 & ": " & pVal & vbNewLine
                   End If
		 End If

		 If strFieldList<>"" Then strFieldList=strFieldList & ","
		 strFieldList=strFieldList & pFld
		 If strParams<>"" Then strParams=strParams & "|"
		 strParams=strParams & pFld & "=" & pEnv.wPakSafe(pVal)

                 ''*** Also put the fields into the frmObj
                 'oForm.Param(pFld) = "" '*** just in case the next line fails, don't want left-over data.
                 'oForm.Param(pFld) = Request.Form(pVal)

		 objFields(pFld)=pVal

		End If '**** Not(objFields.ContainsKey)
	    End If '*****  If LCase(fld)<>"submit" AND LCase(fld)<>"reset"
            'End If   '**** Left(fld,4)="fld_"
          Next
	End If
        
    End Sub
    
    '*** GoSendEmail() - Sends email to user/email/etc. defined by wObj object
    Sub GoSendEmail()
        Dim objMail As New MailMessage, AddAddr As Object, oNames As Object, oName As Object
        Dim client As New SmtpClient(FORM_SMTP_Server)

        '*** LOGIN WITH EMAIL ACCOUNT CREDENTIALS
	If FORM_Email<>"" OR FORM_EmailPwd<>"" Then
          Dim credential As New System.Net.NetworkCredential(FORM_Email, FORM_EmailPwd)

          On Error Resume Next
          client.Credentials = credential
          On Error GoTo 0

          If Err.Number > 0 Then
            ErrMsg = "Email Credentials failed: " & Err.Description
            Err.Clear()
          End If
	End If

        If ErrMsg = "" Then

            On Error Resume Next

            '*************************************************
            '*** .Net 2.0 - Setup MAIL Object
            AddAddr = New System.Net.Mail.MailAddress(FORM_SendFrom)
            objMail.From = AddAddr
            AddAddr = Nothing

            oNames = Split(FORM_SendTo, ",")
            For Each oName In oNames
                AddAddr = New System.Net.Mail.MailAddress(oName)
                objMail.To.Add(AddAddr)
                AddAddr = Nothing
            Next
            oName = Nothing
            oNames = Nothing

	    If Trim(FORM_cc & "")<>"" Then
              oNames = Split(FORM_cc, ",")
              For Each oName In oNames
                AddAddr = New System.Net.Mail.MailAddress(oName)
                objMail.CC.Add(AddAddr)
                AddAddr = Nothing
              Next
              oName = Nothing
              oNames = Nothing
	    End If

	    If Trim(FORM_Bcc & "")<>"" Then
              oNames = Split(FORM_Bcc, ",")
              For Each oName In oNames
                AddAddr = New System.Net.Mail.MailAddress(oName)
                objMail.Bcc.Add(AddAddr)
                AddAddr = Nothing
              Next
              oName = Nothing
              oNames = Nothing
	    End If

            '*** Set Subject and Email message (BOTH ASPMail and CDONTS)
            objMail.Subject = FORM_Subject
            
            If FORM_IsHTML = true Then
                objMail.Body = Replace(strDefMsg, vbNewLine, "<br>")
                objMail.IsBodyHtml = True
            Else
                '*** DEBUG DEBUG DEBUG
                '*** TEMPORARY WORK AROUND - CONVERT <br> to a line feed...
                '*** FUTURE: Will want to use a standard routine to convert embedded tokens.
                '	objMail.Body = zObj.Param("LetterText")
                objMail.Body = Replace(strDefMsg, "<br>", vbNewLine)
                objMail.IsBodyHtml = False
            End If

            If Err.Number > 0 Then
                ErrMsg = "Failed to send email: " & Err.Description
                Err.Clear()
            End If

        End If


        If ErrMsg = "" Then
            On Error Resume Next
	    'client.Host = FORM_SMTP_Server  '*** This is set when we create the object
	    If FORM_SMTP_Port>=0 Then client.Port = FORM_SMTP_Port
	    client.EnableSSL=FORM_SMTP_SSL  '*** This allows SSL/TLS secure connection
            client.Send(objMail)
            If Err.Number <> 0 Then
                ErrMsg = "An error occurred during relay: " & Err.Description
            End If
        End If

        On Error Resume Next
        objMail.Dispose()
        Err.Clear()
        On Error GoTo 0
    End Sub

    Sub FormCleanup()
	strDefMsg =""
	strParams =""
	strFieldList =""
	objFields =nothing
    End Sub

    Sub SaveFormToLog(strFormID as String)
	Dim DBConnect as Object, db as Object, strContactID as String, ContactID as String
 	Dim sql as String

	ON ERROR RESUME NEXT

	If pEnv is Nothing Then pEnv=new wObjects.wObjEnv(wWorld)

	'*** FUTURE: Add timestamp to record submission?
	sql="INSERT INTO wLog (WorldID, FormID, Params) " & _
		" VALUES ('" & wWorld & "','" & strFormID & "', '" & Replace(strParams,"'","''") & "')"
	
	pEnv.dbSrc.ExecSQL(sql)

	'*** FUTURE: Check for database errors?
	If Err.Number>0 Then
		ErrMsg="Failed to save submission: " & Err.Description
		Err.Clear
	End If

	ON ERROR GOTO 0

    End Sub

    '*** Converts a number to Integer... ignores errors (on error set integer to the default value)
    Function CInt2(sObj as Object, optional nDefault as Integer=0) as Integer
	CInt2=nDefault
	ON ERROR RESUME NEXT
	CInt2=CInt(sObj)
	Err.Clear
	ON ERROR GOTO 0
    End Function

</script>

<!-- #include virtual="\logout.aspx" -->
