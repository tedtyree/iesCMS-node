var eClass,fDirty,fSingleRecord,urlObj,world,sworld,urlParent,eCmd,SearchConfig,recType,RemoveOK=false,currPageNum="&page=1";

$.extend({
  getUrlVars: function(){
    var vars = [], hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
    for(var i = 0; i < hashes.length; i++)
    {
      hash = hashes[i].split('=');
      vars.push(hash[0]);
      vars[hash[0]] = hash[1];
    }
    return vars;
  },
  getUrlVar: function(name){
    return $.getUrlVars()[name];
  }
});

$(document).ready(function(){
   // On Page Load...
   // Getting eclass URL parameter...
	eClass = $.getUrlVar('eclass');
	sworld="";
	world = $.getUrlVar('world'); if (!(world)) { world=""; } else { sworld="&world=" + world }
	urlObj = $.trim($.getUrlVar('obj'));
	urlParent = $.trim($.getUrlVar('parent'));
	if (eClass) { $('#editlist_search').html("eclass=" + eClass); }
	else { $('#editlist_search').html("&nbsp;<br/>&nbsp;<br/>Class not specified.&nbsp;<br/>&nbsp;<br/>&nbsp;<br/>"); }
	$('#editlist_loading').show();
	$('#editlist_search').hide();
	$('#editlist_form').hide();
	
	//Bind this keypress function to the search field...
	$('#fltSearch').keypress(function (evt) {
		var charCode;     
		if(evt.keyCode) charCode = evt.keyCode; //IE
		else charCode = evt.which; //firefox	  
		if (charCode  == 13) { return false; } //Disable Enter key
		});

	GetSearchFields();  //*** This will keep the form from thinking we entered a search.
		
	// Setup Header
	/* $.post("/admin/EditWObj/EditList-Info.aspx",{ eclass: eClass },
		function(data) { SetHeader(data); }); */
	ts=new Date().getTime();
	$.post("/runcmd?cmd=editlist-info&ts=" + ts,{ eclass: eClass },
		function(data) { SetHeader(data); });

	// Query Initial
	ShowPanel('loading');
	if (urlObj=="") {
	  SendSearch();
	  FormClean();
	  fSingleRecord=false;
	  }
	else {
	  fSingleRecord=true;
	  OpenItem(urlObj,"OBJ")
	  }
 });
 
  function SetHeader(sData) {
    var vData={},s1,s2,k,t,uTableName,vTableName;
	try {
		vData = JSON.parse(sData);
	} catch {}
	vTableName=vData['Title'];
	if ($.getUrlVar('TableName')) {uTableName = unescape($.getUrlVar('TableName') + '');}
	if ($.trim(uTableName)!="") {vTableName=uTableName;}
    $('#editlist_title').html(vTableName);
	if ('AddLink' in vData) {
			$('#editlist_add1').attr('onClick','window.location="' + vData['AddLink'] + '"');
			$('#editlist_add2').attr('onClick','window.location="' + vData['AddLink'] + '"');
		}
	SearchConfig = vData;
	if (!SearchConfig) {SearchConfig = {};}
	if (!SearchConfig.SpecialFlags) {SearchConfig.SpecialFlags = "";}
	RemoveOK=false;
	try {
		if (vData['RemoveOK'].toLowerCase()=='true') { RemoveOK=true; $('#remove_ok').show(); }
	} catch (err3) { }
	
	t="";
	try { t=vData['RecType'];  } catch (err4) { }
	if (t) {recType=t;}
	
	}
	
function SearchPage(npage) {
	ShowPanel('loading');
	SendSearch("",npage); //FUTURE: determine reloadFlag?
}
	
function SendSearch(reloadFlag,newpage) {
	var sReload,ts;
	sReload="";
	//currPageNum is preset to the default and retains the most recent page number
	if (reloadFlag) { sReload="&reload=" + reloadFlag; }
	if (newpage) { currPageNum="&page=" + newpage; }
	//alert(currPageNum);
	ts=new Date().getTime();
	$.post("runcmd?cmd=editlist-json&ts=" + ts + "&eclass=" + eClass + "&parent=" + urlParent + sworld + sReload + currPageNum,$('#editlist_searchform').serialize(),
		function(data) { ReturnSearch(data); });
	//ShowPanel('loading');
}

function ReturnSearch(sData) {
	let newHtml = '<table width="100%" class="tabletext" style="with:100%;">';
	let rows = 0;
	try {
		if (SearchConfig.SearchList) {
			// first build header row
			newHtml += '<tr class="EditListTitles">';
			for (var k of SearchConfig.SearchList) {
				let alias = k.Alias || k.Field;
				// future: hide column if width=0? Or special flag set?
				newHtml += '<th>' + $('<div>').text(alias).html() + '</th>';
			}
			newHtml += '</tr>';
			if (sData.data) {
				// build each data row
				for (var row of sData.data) {
					newHtml += '<tr>';
					// build link to open/edit record
					let pk = "";
					if (SearchConfig.PrimaryKey) { pk = row[SearchConfig.PrimaryKey]; }
					let link1a = "";
					let link1b = "";
					if (pk) { 
						link1a = '<a href="#" onclick="OpenItem(\'' + pk + '\',\'ROW\');return false;">';
						link1b = '</a>'; 
					}
					let link2a = "";
					let link2b = "";
					for (var k of SearchConfig.SearchList) {
						let field = (k.Field + '').replace(/\`/g,'');
						let j = row[field];
						if (j) { j = j + ''; } else { j = ''; }
						if (k.Flags && k.Flags.toLowerCase().indexOf('l')>0) {
							link2a = link1a;
							link2b = link1b;
						} else {
							link2a = "";
							link2b = "";
						}
						newHtml += '<td>' + link2a + $('<div>').text(j).html() + link2b + '</td>';
					};
					newHtml += '</tr>';
					rows=rows +1;
				}
			} // end if sData.data
		} // end if SearcList
		newHtml += '</table>';
	} catch (e) { console.log(e); rows=0;}
	if (rows == 0) {newHtml = '<table><tr><td>No rows found.</td></tr></table>';}

	$('#editlist_search').html(newHtml);
	ShowPanel('search');	
}
var vSearch,vHistory;
var RepeatTimer=false, SameCount=0, DirtyFlag=false, TimerID=-1;

function SetSearchTimer(SetRepeatTimer) {
	// Set timer to check the filter value every .2 seconds ...
	ResetSearchTimer();
	RepeatTimer=SetRepeatTimer;
	TimerID = setInterval("CheckSearch();",200);
	SameCount=0;
   }

   function ResetSearchTimer() {
	// Reset timer
	if (TimerID != -1) {
		// Clear Timer
		clearInterval(TimerID);
	}
   }

   function CheckSearch() {
	var changed=false, ResetTimer=false;

	ResetSearchTimer();
	if (vSearch != $('#fltSearch').val()) { changed=true; }
	if (vHistory != $('#fltHistory').is(':checked')) { changed=true; }
	if (changed) {
		SameCount=0;
		DirtyFlag=true;
		GetSearchFields();
		} 
	else {SameCount=SameCount+1;}
	if (SameCount>=4) {
		//*** Time to requery...
		if (DirtyFlag) {SendSearch();}
		SameCount=0;
		DirtyFlag=false;
		//Only restart timer if we are in continuous mode (cursor is in Search text box)
		if (RepeatTimer) {ResetTimer=true;}
		}
	else { ResetTimer=true; }  //We always have to reset timer if the .8 sec is not up yet.
	if (ResetTimer) {TimerID = setInterval("CheckSearch();",200);}
   }
   
   function GetSearchFields() {
   		vSearch = $('#fltSearch').val(); 
		vHistory = $('#fltHistory').is(':checked');
		}
		
function OpenItem(sItem,sType,worldOpt) {
	var ts;
	$('#editlist_form').html("");
	ShowPanel('loading');	
	if (arguments.length < 3) {worldOpt="";}
	if (worldOpt=="") {worldOpt=sworld;}
	//FUTURE: Account for multiple primary key fields.  Current method only allows for one primary key field.
	if(sType) {recType=sType;}
	ts=new Date().getTime();
	if (recType=="OBJ") {
	  $.post("/runcmd?cmd=editlist-obj&ts=" + ts,{ "objworld": worldOpt, "eclass": eClass, "id": sItem, "parent": urlParent },
		function(data) { SetItem(data); });
	} else {
	  $.post("runcmd?cmd=editlist-record&ts=" + ts,{ "objworld": worldOpt, "eclass": eClass, "id": sItem, "parent": urlParent },
		function(data) { SetItem(data); });
	}
}

function SetItem(sData,sItem) {
	// FUTURE: pass defaults from eclass*.cfg (Defaults field) so new records pre-populate correctly
	var form = GenForm(sData.editfields, sData.data, sData.PrimaryKey, sData.id, {});
	$('#editlist_form').html(form);
	$('#editobjform > *').change( function() {FormDirty();} );   // DEBUG DEBUG DEBUG - fix here!!! WORK FUTURE

	//*** REPLACE/CONVERT all rt_ text boxes to become a CKEditor...
	var $textareas = $("textarea");
	if ($textareas.length) {
       $textareas.each(function () {
	     if (this.id.substring(0,3)=='rt_') {
		  		try { var cke = CKEDITOR.replace(this.id); // Convert text area to CKEDITOR
					CKFinder.setupCKEditor( cke, '/ckfinder/' ); // Attach the CKFinder to the Editor (enables 'Browse Server' button)	
					if (!(typeof(ckConfigCSS) === "undefined")) { cke.config.contentsCss = ckConfigCSS; }
					if (!(typeof(ckConfigToolbar) === "undefined")) { cke.config.toolbar = ckConfigToolbar; }
					} catch (err) { }
			}
       });
	}
	
	FormClean();
	eCmd="Save";

	ShowPanel('form');
	//alert('sflags=' + SearchConfig.SpecialFlags); //*** DEBUG
	if (SearchConfig.SpecialFlags) {
	  if ((SearchConfig.SpecialFlags.toLowerCase().indexOf('copybutton')>0) && (sItem!="*new*")) {
			$('#copy_panel1').show();
			$('#copy_msg1').show();
			$('#copy_msg1').html("");
		}}
	if (sItem!="*new*") {
		// Item is not 'new' so allow 'delete' or 'remove'
		$('#btn_delete1').removeAttr('disabled'); 
		$('#btn_delete2').removeAttr('disabled'); 
		if (RemoveOK==true) { $('#remove_ok').show(); } else { $('#remove_ok').hide(); }
		// FUTURE: need to fix this, but for now, SAVE is enabled here or disabled below
		$('#btn_save1').removeAttr('disabled');
		$('#btn_save2').removeAttr('disabled');
	} else {
		// Item is 'new' so there is no 'delete'/'remove' (just cancel form if you don't want to save new record)
		$('#btn_delete1').attr('disabled', 'disabled'); 
		$('#btn_delete2').attr('disabled', 'disabled');
		$('#remove_ok').hide();
		// FUTURE: Currently cannot support 'save' feature for a NEW item! (we would need the ObjID returned to us!)
		$('#btn_save1').attr('disabled','disabled');
		$('#btn_save2').attr('disabled','disabled');
	}
}

function gotoTop() {
	$('html, body').animate({ scrollTop: 160 }, 'fast');  // Scroll to the top
}

function ShowPanel(sPanel) {
    //First we hide everything
	$('#editlist_loading').hide();
	$('#editlist_search').hide();
	$('#editlist_form').hide();
	
	//Then we show what was requested
	switch(sPanel) {
		case "loading": //Loading panel - leave buttons - leave search
			$('#editlist_loading').show();
			break;
		case "search": //Load search panel and associated buttons + search form
			$('#editlist_search').show();
			$('#buttons_search1').show();
			$('#buttons_search2').show();
			$('#editlist_searchform').show();
			$('#buttons_save1').hide();
			$('#buttons_save2').hide();
			$('#copy_panel1').hide();
			$('#copy_msg1').hide();
			gotoTop();
			break;
		case "form": //Load form panel and associated buttons - NO search form
			$('#editlist_form').show();
			$('#buttons_save1').show();
			$('#buttons_save2').show();
			$('#editlist_searchform').hide();
			$('#buttons_search1').hide();
			$('#buttons_search2').hide();
			//$('#buttons_save1 > :input[name="Delete"]').attr('disabled', 'disabled'); // CURRENTLY NO DELETE - Change status=delete - FUTURE add this feature.
			//$('#buttons_save2 > :input[name="Delete"]').attr('disabled', 'disabled'); // CURRENTLY NO DELETE - Change status=delete - FUTURE add this feature.
			gotoTop();
			break;
		}

}

function clear_CKeditor() {
	//*** First destroy all instances of the CKEditor...
	var $textareas = $("textarea");
	if ($textareas.length) {
       $textareas.each(function () {
	     if (this.id.substring(0,3)=='rt_') {
		  try { CKEDITOR.instances[this.id].destroy(); } catch (err) { }
			}
       });
	}
}

function SaveItem(CloseAfter) {
    //**** NOTE: eClass and Item must be included it the form as a field (usually hidden).
	try {
	//*** First capture RichText text boxes and copy the content into the corresponding hidden field
	//*** In the future this is not needed if we upgrade to the latest CKEditor and use the jQuery connector
		var $textareas = $("textarea");
		if ($textareas.length) {
			$textareas.each(function () {
				if (this.id.substring(0,3)=='rt_') {
					var instance = CKEDITOR.instances[this.id];
					if (instance) { $(this).val(instance.getData()); }
					}
				});
			}
		if (recType=="OBJ") {
			$.post("/admin/EditWObj/EditList-SaveObj.aspx?cmd=" + eCmd + "&eclass=" + eClass + sworld,$('#editobjform').serialize(),
				function(data) { SaveComplete(data,CloseAfter); })
					.error(function(jqXHR, status, error) { alert("Failed to save record. (err247)");
				//alert(status + ": " + error);
				});
			} else {
				// POST to runcmd — eclass in body, sworld dropped (server uses cms.siteId)
				var saveData = $('#editobjform').serialize() + '&cmd=admin/saveRecord&eclass=' + encodeURIComponent(eClass);
				$.post('/runcmd', saveData,
					function(data) { SaveComplete(data, CloseAfter); })
					.error(function() { alert('Failed to save record. (err248)'); });
			}
		}
	catch (err) {
		alert('Failed to save record. (err312) '+err.message);
		}
	//**** FUTURE: we need some type of indicator that we are 'saving'... and also an indicator if there is an error.
}

function SaveComplete(sData,CloseAfter) {
	let ok = false;
	let errMsg = '';
	if (sData && typeof sData === 'object') {
		// JSON response from runcmd handler
		ok = (sData.success === true);
		if (!ok) { errMsg = sData.error || 'Unknown error'; }
	} else {
		// Legacy fallback: old ASPX returned plain text beginning with "Successful"
		ok = (typeof sData === 'string' && sData.substring(0,20).toLowerCase().indexOf('successful') >= 0);
		if (!ok) { errMsg = ('' + sData).replace('<br>','\n'); }
	}
	if (!ok) {
		alert('Error attempting to ' + eCmd + ' this record. (err249)\n' + errMsg);
		if (eCmd=='Delete' || eCmd=='Remove') { eCmd='Save'; }
		return;
	}
	eCmd="Save"; //*** Keeps us from making another 'copy' of the record.
	if (CloseAfter==false) { FormClean(); return; }
	if (fSingleRecord==false) {
	  ShowPanel('loading');
	  clear_CKeditor();
	  SendSearch();  //*** requery incase the data changed while we were away.
	  FormClean();
	  }
	else { history.back(); }
}

function CancelEdit() {
 if (fDirty==true) { if (confirm("Are you sure you would like to cancel all changes?")!=true) { return false; } }
 if (fSingleRecord==false) {
   ShowPanel('loading');
   clear_CKeditor();
   SendSearch();  //*** requery incase the data changed while we were away.
   }
 else { history.back(); }
}
 
function MakeCopy() {
	/* "Save" function will make the 'copy' based on eCmd */
	eCmd="Copy";
	
	$('#copy_panel1').hide(); // Don't need to copy this a second time.
	$('#copy_msg1').show();		
	$('#copy_msg1').html("*** COPY MADE *** &nbsp;");
	
	// *** You can't delete/remove a copy ***
	$('#btn_delete1').attr('disabled', 'disabled'); 
	$('#btn_delete2').attr('disabled', 'disabled');
	$('#remove_ok').hide();
	FormDirty(); // Indicates that we must 'save' the record before leaving the form
	
	alert('Copy made. New item will not be stored in the database until you "save" the item.');
	
	// FUTURE: Currently cannot support 'save' feature for a COPIED item! (we would need the ObjID returned to us!)
	$('#btn_save1').attr('disabled','disabled');
	$('#btn_save2').attr('disabled','disabled');
	
	/* FUTURE: WE NEED TO DISABLE THE COPY BUTTON HERE - IF IT IS VISIBLE */
}
function DeleteItem() {
			if (confirm("Are you sure you would like to DELETE this item?")!=true) { return false; }
			eCmd="Delete"; 
			SaveItem(true);
}

function RemoveItem() {
			if (confirm("Are you sure you would like to REMOVE this item?")!=true) { return false; }
			eCmd="Remove"; 
			SaveItem(true);
}

function FormDirty() {
	fDirty=true;
	$('#btn_save1').css('background','#90FF90');
	$('#btn_save2').css('background','#90FF90');
	$('#btn_saveclose1').css('background','#90FF90');
	$('#btn_saveclose2').css('background','#90FF90');
}

function FormClean() {
	fDirty=false;
	$('#btn_save1').css('background','');
	$('#btn_save2').css('background','');
	$('#btn_saveclose1').css('background','');
	$('#btn_saveclose2').css('background','');
}
// ****************************************************
// *** Routines to handle image select, etc.
// ****************************************************
var sFlag,sMid,iDist,sNext;
var iHist="";

  function RefreshMe() {
	if (self.document.RefreshForm.RefreshFlag.value=="CLOSED") { 
		// Using history.back is here to resolve a major Mozzila bug!
		if (iHist==1) { history.back(); }
		else { history.go(-iHist); }
}}

  function fullRefresh() {
  ShowPanel('loading');SendSearch('Y');
  }
  
  function CloseForm() {
	self.document.RefreshForm.RefreshFlag.value="CLOSED";
  }

  var whichbox="";

  function SetUrl(url) { 
    var txtBox=document.getElementById(whichbox);
    txtBox.value=url; 
  }

  function SetBox(theBox) {
    whichbox=theBox;
  }
  
 var fldFileBrowse;
  function FileBrowse(fldID,fldType) {
	fldFileBrowse=fldID;
						
	var finder = new CKFinder() ;
	finder.basePath = '/ckfinder/' ;
	finder.selectActionFunction = setFilePath;
	finder.popup() ;
	}
	
function setFilePath(sURL,data) {
	var e = document.getElementsByName(fldFileBrowse);
	if (e[0]) { e[0].value=sURL; }
	}

function NoBracket(sString) {  // remove qualifiers
  let noBracket=('' + sString).trim();
  //*** FOR MYSQL DATABASES...
  if (noBracket.substr(0,1)=="`") {
	  noBracket=noBracket.substr(1);
  		}
  if (noBracket.substr(noBracket.length -1,1)=="`") { noBracket=noBracket.substr(0,noBracket.length -1); }
  return noBracket;
	}

function cleanStr(sVal) {
	if (!sVal) { return ''; }
	return ('' + sVal).trim();
}
	
function GenForm(editFields, fieldData, primaryKey, id, defaults) {
	if (!defaults) { defaults = {}; }
	var ret = "";
debugger;
	//**********************************
	//******* GENERATE EDIT FORM
	//**********************************
	var bViewOnly=true;
    //If PermGen>1 Then bViewOnly=False
	bViewOnly=false; // FUTURE REMOVE THIS LINE
  	//If PermGen>1 AND (ErrMsg="") Then ... FUTURE CHECK FOR ERROR MESSAGE? IS THIS A FAILED SUBMIT?
	ret += "<table border=0 width=550 cellpadding=0><TBODY>";
	//If InStr(gParams.Param("SpecialFlags"),"CopyButton")>0 AND f_Key<>"*new*" Then _
	//Response.Write("<tr><td colspan=2 align=right>" & _
	//"<input type=submit name=Copy value='Copy to new record'>" & _
	//"</td></tr>")
	if (id.toLowerCase().trim() == "*new*") {
		ret += "<tr><td colspan=2 align=left>" +
			"<Font size=3 color=#309040><B>*** NEW RECORD ***</B>" +
			"</td></tr>";
	}

	// Hidden id field — included in serialized POST so the save handler knows which record to update
	ret += '<input type="hidden" name="id" value="' + id + '">';

    var safety=99999;
    for (const dFld1 of editFields) {
		let dValue="";
		let ShowField=true;
		let dFieldName=NoBracket(cleanStr(dFld1.Field));
		let sFlags=cleanStr(dFld1.Flags);
		if (id.toLowerCase().trim() != "*new*") { dValue=cleanStr(fieldData[dFieldName]); }
//	If ReshowForm=True Then
//		dValue=Request.Form("fld" & dFieldName)
//		If f_Key="*new*" AND InStr(sFlags,"p")>0 _
//			AND gUserEntersNewKey=False Then dValue="*new*"
//	End If
	if (id.toLowerCase().trim() == "*new*") {
//	   If ReshowForm<>True Then
		//*** Set PrimaryKey=*new*
		if (sFlags.indexOf("p")>=0 && gUserEntersNewKey==false) { dValue="*new*"; }
		for (const [zKey, zVal] of Object.entries(defaults)) {
		  if (NoBracket(zKey.toLowerCase().trim()) == dFieldName.toLowerCase().trim()) { dValue = zVal; }
		}
//	   End If
	   if (sFlags.indexOf("p")>=0 && gUserEntersNewKey==false) { ShowField=false; }
	   //if (('' + gParams.SpecialFlags).indexOf("ShowNew")>=0) { ShowField=true; } // DEBUG FUTURE PUT THIS BACK
	} // End If *new*

	if (ShowField==true) { ret += MakeEditRow(dFld1,dValue,"",null /*aEnv*/,null /*gParams*/,"both",bViewOnly,true); }
	
	safety=safety-1;
	if (safety<=0) { break; }
} // end for

// Additional admin fields
/* DEBUG FUTURE ADD THIS BACK INTO LOGIC
    if PermPriv >= 3 Then
      dFld2.MoveFirst
      Safety=99999
      Do While Not(dFld2.EOF)
	dValue=""
	If f_Key<>"*new*" Then dValue=rs.fGetS(NoBracket(dFld2.Item("FieldName") & "")) & ""
	If f_Key="*new*" Then
		For each zPair in Split(sDefaults,";")
		  zArr=Split(zPair,"=",2)
		  If NoBracket(lcase(trim(zArr(0))))=NoBracket(lcase(trim(dFld2.Item("FieldName") & ""))) Then dValue=zArr(1)
		Next
	End If
	'*** Assume that the primray key is not in this set.
	MakeEditRow(dFld2,dValue,"",aEnv,gParams,,bViewOnly,True)
	
        dFld2.MoveNext
	Safety=Safety-1
	If Safety<=0 Then Exit Do
      Loop
	  
    End If

	} // end do
) // end if PermPriv >= 3
*/
    ret += "</TBODY></table><br>";
	return ret;

} // end Function


//*** MakeEditRow()
//*** aFlds can be a SortedList of Parameter/Value pairs or a pParameters.pTable object
//*** also with Parameter/Value pairs available through the 'Item' method.
//***
//*** sCmd="field" - Create the field with no data
//*** sCmd="data" - add data to existing field
//*** sCmd="both" - Create the field and populate the data
//***
//*** NOTE: useFormatContent is the new method of creating fields (all text based)... EditList-Record.aspx uses this (EditList-Obj.aspx does not)
//***
function MakeEditRow(aFlds,dValue, sInterpret, objEnv, ggParams, 
	sCmd="both", bReadOnly=true, useFormContent=false) {
		defaultWidth = "150px";
		defaultHeight = "32px";
  var bld1;
  var bld2;
  var sAlias;
  var sFlags;
  var dField;
  var dField2;
  var nWidth;
  var nHeight;
  var sFieldType;
  var rsList;
  var zFlds;
  var sOpts;
  var sOpts2;
  var zObj;
  var newObj;
  var nOpt;
  var sCmd2;
  var safety;
  var eWorld;
  var mEditRow;


  bld1="";
  bld2="";
  sOpts="";
  sOpts2="";

  let ret = "";

  sCmd2=cleanStr(sCmd).trim();
// ret += "scmd=" + scmd + ", dValue=" + dValue + "<br>"; //DEBUG DEBUG DEBUG
  dField=NoBracket(aFlds.Field);
  dField2="fld" + dField;
  sFlags=cleanStr(aFlds.Flags);

  if (sFlags.indexOf("b")>=0) {
    bld1="<b>";
    bld2="</b>";
  }
  sAlias=cleanStr(aFlds.Alias);
  if (sAlias=="") { sAlias=dField; }

  sFieldType=cleanStr(aFlds.Type).toLowerCase();

  if (sFieldType != "question-yesno") {
    mEditRow="<tr><td width=200 valign=top>" + bld1 + sAlias + ":" + bld2 + "</td>";
  }

/*
  If Left(sFieldType,5)="lkup-" Then
	ON ERROR RESUME NEXT
	sOpts=""
	zFlds=Split(sFieldType,"-",3)  '*** Format: lkup-<WorldID>-<Lookup Set>
	rsList=objEnv.dbSrc.GetRS("SELECT Param, Title FROM wLookup " & _
		" WHERE WorldID='" & zFlds(1) & "' AND LookupSet='" & zFlds(2) & "' " & _
		" ORDER BY seq,Title")
	safety=999
	Do While rsList.Read()
	  If sOpts<>"" Then sOpts=sOpts & ","
                sOpts = sOpts & rsList.GetS(0) & ":" & rsList.GetS(1)
	  
	  safety=safety-1
	  If safety<=0 Then Exit Do
	Loop
	rsList.Close
	rsList=Nothing
	sFieldType="lkup"
	Err.Clear
	ON ERROR GOTO 0
  End If
  
  If sCmd2="field" OR sCmd2="both" Then
   If Left(sFieldType,6)="qlist-" or Left(sFieldType,7)="qlist2-" Then
	Dim s as string, v as String
	v=LCase(Trim(dValue & ""))
	'*** NOTE: List always starts with a blank row for qList
	sOpts2="<select name='fld" & dField & "'><option value=''></option>"
	ON ERROR RESUME NEXT
	zFlds=ggParams.Param(sFieldType)  '*** Get the SQL Statement from the specified qList parameter
	If Left(sFieldType,6)="qlist-" Then
		rsList=objEnv.dbSrc.GetRS(zFlds)  '*** Get the SQL list from the CONFIG DB
	Else
		rsList=wEnv.dbSrc.GetRS(zFlds) '*** Get the SQL list from the TARGET DB
	End If
	'sOpts="SQL=" & zFlds & "<br>" & sOpts   '**** DEBUG DEBUG DEBUG
	'sOpts="Current Value=" & v & "<br>" & sOpts   '**** DEBUG DEBUG DEBUG
	safety=999
	Do While rsList.Read()
		s=""
		If LCase(Trim(rsList.GetS(0) & ""))=v Then s=" Selected "
        sOpts2 = sOpts2 & "<option value='" & rsList.GetS(0) & "'" & s & ">" & rsList.GetS(1) & "</option>"
	  safety=safety-1
	  If safety<=0 Then Exit Do
	Loop
	rsList.Close
	rsList=Nothing
	Err.Clear
	ON ERROR GOTO 0
	sOpts2=sOpts2 & "</select>"
	sFieldType="opt2"
   End If 'Left(sFieldType,6)="qlist-" or Left(sFieldType,7)="qlist2-"
  End If ' sCmd2="field" OR sCmd2="both" 
  
  If Left(sFieldType,6)="class-" Then
	'*** Determine WORLD for EDIT CLASS (based on SESSION)
	'*** May differ from the objEnv World IF we are ADMIN
	eWorld=f_World
	If LCase(eWorld)<>LCase(Trim(Session("World") & "")) Then
		eWorld=Trim(Session("World") & "")
		'*** This is only allowed if we are using the ADMIN_WORLD
		If LCase(eWorld)<>LCase(ADMIN_WORLD) Then
			eWorld="!WORLD_NOT_FOUND!"
			'**** FUTURE: Normally there would be an error message here!
			'**** For now, we just plug ahead and let the rest fail because of the invalid eWorld
		End If
	End If

	zFlds=Split(sFieldType,"-",2)  '*** Format: class-<Class>  
	'*** Note for above: class must be in same world, but the class itself could certainly reference a class in another world

	'*** The class object can either have a hard coded list
	'*** or it can have a command to generate the list into the format...
	'***    <param>:<alias>,<param>:<alias>,...
	ON ERROR RESUME NEXT
	sOpts=""
	zObj=Nothing
 	If IsNumeric(zFlds(1) & "") Then 
		zObj=objEnv.GetObjByID(zFlds(1),eWorld)
	Else
		zObj=objEnv.WorldParamObj(zFlds(1),eWorld)
	End If
	sOpts=zObj.Param("Options")
	sFieldType="class"
	Err.Clear
	ON ERROR GOTO 0
  End If
  If Left(sFieldType,6)="plist-" Then
	sOpts=ggParams.Param(sFieldType)
	sFieldType="list"
  End If
*/
  //*** NOTE: bReadOnly may already be True (but that is OK - that means we must lock the field)
  if (sFlags.indexOf("l")>=0) { bReadOnly=true; }
  nWidth=cleanStr(aFlds.Width);
  if (nWidth=="" ) { nWidth=defaultWidth + ""; }
  nHeight=cleanStr(aFlds.Height);
  if (nHeight=="") { nHeight=defaultHeight; }

  //*** For most drop-down lists we process them the same way but with a different list of options...
  //*** Here we set the option string and then change the field type to simply 'list'
  switch (sFieldType) {
    case "list-office":
		sOpts="AO,RES,CC,FAM";
		sFieldType="list";
		break;
    case "list-psn":
		sOpts="Primary,Secondary,No";
		sFieldType="list";
		break;
    case "list-yesno":
		sOpts="Yes,No";
		sFieldType="list";
		break;
    case "list-status2":
		sOpts="Active,Deleted";
		sFieldType="list";
		break;
    case "list-status3":
	case "list-status":
		sOpts="Active,Inactive,Deleted";
		sFieldType="list";
		break;
    case "list-status4":
		sOpts="New,Active,Inactive,Deleted";
		sFieldType="list";
		break;
    case "list-viewlevels1":
		sOpts="7:Hidden (Admin Only),3:Members Only,1:Members and Friends,0:Public (all website visitors)";
		sFieldType="list";
		break;
    case "list-wings-status":
		sOpts="New,GiveWings,Pending,Sold,Gone,WeKeep,Discard,Deleted";
		sFieldType="list";
		break;
  } // End switch
// ret += ">>>Add " + sFieldType + ", dValue=" + dValue + "<br>"; //DEBUG DEBUG DEBUG
  if (sCmd2=="field" || sCmd2=="both") {
   switch (sFieldType) {
    case "hidden":
		//*** NOTE: We are not creating a row this time (do not use mEditRow)
		ret += fAddHid(dValue,dField2);
		break;
    case "text":
		ret += mEditRow + "<td>";
// ret += "Add text box, dValue=" + dValue + "<br>"; //DEBUG DEBUG DEBUG
		ret += fAddTxtBox(dValue,dField2,nWidth,bReadOnly);
		ret += "</td>" + sInterpret + "</tr>";
		break;
	case "params":
		ret += mEditRow + "<td>";
		ret += fAddTxtBox(Replace(dValue,"|","<br>"),"fld" & dField,nWidth,bReadOnly);
		ret += "</td>" + sInterpret + "</tr>";
		break;
	case "password":
		ret += mEditRow + "<td>";
		ret += fAddTxtBox("*******",dField2,nWidth,bReadOnly);
		ret += "</td>" + sInterpret + "</tr>";
		break;
		/*
	case "date"
		fAddLit(mEditRow & "<td>")
		fAddTxtBox(FldDate(dValue),dField2,nWidth,bReadOnly)
		fAddLit("</td>" & sInterpret & "</tr>")
		*/
    case "list", "lkup", "class":
		ret += mEditRow + "<td>";
		if (useFormContent && sOpts2=="") { 
			sOpts2=GenerateOpts2(sOpts,dValue);
			fAddDDown(dField2, sOpts2, nWidth);
		} else {
			newObj=fAddDDown(dField2, sOpts, nWidth);
			GenerateOpts(newObj,sOpts,dValue);
			ret += "</td>" + sInterpret + "</tr>";
		}
		break;
		/*
	case "opt2"
		fAddLit(mEditRow & "<td>" & sOpts2 )
'		newObj=fAddDDown("fld" & dField, sOpts, nWidth)
'		GenerateOpts(newObj,sOpts,dValue)
		fAddLit("</td>" & sInterpret & "</tr>")
    case "question-yesno"
	'*** DOES NOT USE mEditRow
	fAddLit("<tr><td colspan=2 align=left valign=top>" & bld1 & sAlias & bld2 & "&nbsp;")
		sOpts="Yes,No"
		If useFormContent AND sOpts2="" Then 
			sOpts2=GenerateOpts2(sOpts,dValue)
			fAddDDown(dField2, sOpts2, nWidth)
		Else
			newObj=fAddDDown(dField2, sOpts, nWidth)
			GenerateOpts(newObj,sOpts,dValue)
			fAddLit("</td>" & sInterpret & "</tr>")
		End If 
		*/
    case "note": // *** NOTE: TITLE GOES ABOVE TEXT BOX
		ret += "<tr><td colspan=2 valign=top>" + bld1 + sAlias + ":" + bld2 + "<br>";
		ret += fAddNoteBox(dValue,dField2,nWidth,nHeight,bReadOnly);
		ret += "</td>" + sInterpret + "</tr>";
		break;
		/*
	case "note2"  '*** NOTE: TITLE GOES TO THE LEFT OF TEXT BOX
		fAddLit(mEditRow & "<td>")
		fAddNoteBox(dValue,dField2,nWidth,nHeight,bReadOnly)
		fAddLit("</td>" & sInterpret & "</tr>")
	case "paramnote" '*** NOTE BOX w/ Vertical Bars "|" changed to carriage returns
		fAddLit("<tr><td colspan=2 valign=top>" & bld1 & sAlias & ":" & bld2 & "<br>")
		fAddNoteBox(Replace(dValue,"|",vbNewLine),dField2,nWidth,nHeight,bReadOnly)
		fAddLit("</td>" & sInterpret & "</tr>")
    case "richtext"  '*** NOTE: TITLE GOES ABOVE RICH TEXT BOX
	'*** DOES NOT USE mEditRow
	fAddLit("<tr><td colspan=2 valign=top>" & bld1 & sAlias & ":" & bld2 & "<br>")
'DEBUG EXPERIMENT WITH AJAX - TKT 12/2012 - FUTURE put this back or finish the new idea
dField2="rt_fld" & dField
fAddNoteBox(dValue,dField2,nWidth,nHeight,bReadOnly)
'	fAddHid(dValue,dField2)
'	fAddRichText(dValue,"rt_" & dField, _
'		"paragraphmenu,fontsizesmenu;bold,italic,underline|bulletedlist,numberedlist", _
'		nWidth, nHeight)
	fAddLit("</td>" & sInterpret & "</tr>")
    case "richtext2" '**** NOTE: TITLE GOES TO THE LEFT OF THE RICH TEXT BOX
	fAddLit(mEditRow & "<td>")
'DEBUG EXPERIMENT WITH AJAX - TKT 12/2012 - FUTURE put this back or finish the new idea
dField2="rt_fld" & dField
fAddNoteBox(dValue,dField2,nWidth,nHeight,bReadOnly)
'	fAddHid(dValue,dField2)
'	fAddRichText(dValue,"rt_" & dField, _
'		"paragraphmenu,fontsizesmenu;bold,italic,underline|bulletedlist,numberedlist", _
'		nWidth, nHeight)
	fAddLit("</td>" & sInterpret & "</tr>")
    case "imgurl"
	fAddLit(mEditRow & "<td>")
	fAddURL(dValue,dField2,nWidth,bReadOnly,"Image")
	fAddLit("</td>" & sInterpret & "</tr>")
	case "fileurl"
	fAddLit(mEditRow & "<td>")
	fAddURL(dValue,"fld" & dField,nWidth,bReadOnly,"File")
	fAddLit("</td>" & sInterpret & "</tr>")
	*/
    default:
		ret += mEditRow + "<td>";
//DEBUG DEBUG DEBUG
ret += "INVALID TYPE: '" + sFieldType + "'<br>";
ret += fAddTxtBox(dValue,dField2,nWidth,bReadOnly);
ret += "</td>" + sInterpret + "</tr>";
   } // End switch
 } // End If

 /*  FUTURE: IS THIS NEEDED? WE FILLED THE VALUE IN WHILE BUILDING THE FORM, CORRECT?
    if (sCmd2=="data" || sCmd2=="both") {
	//*** Populate the field with data...
	switch (sFieldType) {
	  case "hidden":
		newObj=editobjform.FindControl(dField2);
		newObj.Value=dValue;
		newObj=Nothing;
		break;
	  case "text", "note":
		newObj=editobjform.FindControl(dField2);
		newObj.Text=dValue;
		newObj=Nothing;
		break;
	case "password":
		newObj=editobjform.FindControl(dField2);
		newObj.Text="*******";
		newObj=Nothing;
		break;
	case "date":
		newObj=editobjform.FindControl(dField2);
		newObj.Text=FldDate(dValue);
		newObj=Nothing;
		break;
	case "richtext", "richtext2":
		dField2="rt_fld" & dField;
		newObj=editobjform.FindControl(dField2);
//DEBUG TKT 12/2012 - TEMP WORK AROUND
//ON ERROR RESUME NEXT
//		newObj.Value=dValue
		newObj.Text=dValue;
//ON ERROR GOTO 0
		newObj=Nothing;
		break;
	  case "list", "lkup", "class", "question-yesno":
		newObj=editobjform.FindControl(dField2);
		var bSel=false;
		for (const nOpt of newObj.Items) {
			nOpt.Selected=false;
			if (cleanStr(nOpt.Value).toLowerCase()==cleanStr(dValue).toLowerCase() && bSel==false) {
				nOpt.Selected=true;
				bSel=true;
			} // End If
  		} // end for
  		break;
  } // End switch 
} // End If
*/
	return ret;
} // End function

/* AddLit() no longer needed - just adds the literal HTML to the output
function AddLit(sText="", sID="") {
}
*/


function fAddBtn(sText="", sID="", sCommand="", 
		sCommandArg="", bVisible=true) {
			return "AddBtn";
			/*
	Dim vObj as New Button()

	AddHandler vObj.Command, AddressOf CommandBtn_Click

	If sCommand<>"" Then vObj.CommandName=sCommand
	If sCommandArg<>"" Then vObj.CommandArgument=sCommandArg
	vObj.Visible=bVisible
	If sID<>"" Then vObj.ID=sID
	If sText<>"" Then vObj.Text=sText
	editobjform.Controls.Add(vObj)
	'vObj=Nothing
	*/
		} // End function

function fAddURL(sText="", sID="", nCols=45,
		bReadOnly=false, fType="File") {
			return "fAddURL";
			/*
	//*** Create IMAGE URL TEXT BOX
	Dim vObj as New TextBox()
	
	vObj.TextMode=TextBoxMode.SingleLine
	vObj.Columns=nCols
	vObj.Wrap=False
	vObj.ReadOnly=bReadOnly
	If bReadOnly=True Then vObj.BackColor=System.Drawing.Color.LightGray
	If sText<>"" Then vObj.Text=sText
	If sID<>"" Then vObj.ID=sID
	editobjform.Controls.Add(vObj)
	vObj=Nothing

	'*** Create 'SELECT IMAGE' BUTTON
	Dim vObj2 as New LiteralControl()
	vObj2.Text="<input onClick=""Javascript:FileBrowse('" & sID & "','" & fType & "');"" type=button Value=""Select..."" name='Browse_" & sID & "' class='FileBrowse'>"
	editobjform.Controls.Add(vObj2)
	vObj2=Nothing
	*/
		} // End function

function fAddTxtBox(sText="", sID="",nCols=45, bReadOnly=false) {
			
			var readonly = "";
			if (bReadOnly) { readonly = " readonly "; }
			let ret="<input type='text' id='" + sID + "' name='" + sID + "' cols=" + nCols + " value='" + sText + "'" + readonly + ">"; // FUTURE HANDLE QUOTES AND SPECIAL CHARACTERS
			return ret;
			/*
	Dim vObj as New TextBox()
	
	vObj.TextMode=TextBoxMode.SingleLine
	vObj.Columns=nCols
	vObj.Wrap=False
	vObj.ReadOnly=bReadOnly
	If bReadOnly=True Then vObj.BackColor=System.Drawing.Color.LightGray
	If sText<>"" Then vObj.Text=sText
	If sID<>"" Then vObj.ID=sID
	editobjform.Controls.Add(vObj)
	vObj=Nothing
	*/
		} // End function

function fAddNoteBox(sText="", sID="", nCols=45, nRows=5, bReadOnly=false) {
			let ret = "";
			let readonly = "";
			if (bReadOnly) { readonly = " readonly "; }
			ret = "<textarea id='" + sID + "' name='" + sID + "' cols=" + nCols + " rows=" + nRows + "'" + readonly + ">" + sText + "</textarea>"; // FUTURE HANDLE QUOTES AND SPECIAL CHARACTERS
			return ret;
} // End function

function fAddHid(sText="", sID="") {
	return "fAddHid";
/*
'MODIFY-HERE: .Net 2.0 uses HiddenField???
'	Dim vObj as New HiddenField()
	Dim vObj as New HtmlInputHidden()
	If sID<>"" Then vObj.ID=sID
	If sText<>"" Then vObj.Value=sText
	editobjform.Controls.Add(vObj)
	vObj=Nothing
	*/
} // End function

function fAddDDown(sID="", sOpts=[{}], width=35) {
	var ret="<select id='" + sID + "' name='" + sID + "' style='width: " + width + "px;'>";
	for (var i = 0; i < sOpts.length; i++) {
		ret += "<option value='" + sOpts[i].value + "'>" + sOpts[i].text + "</option>";
	}
	ret += "</select>";
	return ret;
} // End function

function fAddRichText(sText="", sID="", sCtlConfig="", nCols=45, nHeight=5) {
			return "fAddRichText";
/*
	'*** NOTE: Leaving sCtlConfig blank does not create a box with no controls, but
	'*** instead it uses the default set of controls.
	Dim vObj as New FredCK.FCKeditorV2.FCKeditor, sToolbar as String
	'Dim CKFinderObj as new CKFinder.FileBrowser()

	'CKFinderObj.BasePath = "/ckfinder/"
	'CKFinderObj.SetupCKEditor(vObj)
	
'*** Set CKEditor config parameters
ckPATH=Trim(gParams.Param("ckConfig") & "")
ckCSS=Trim(gParams.Param("ckConfigCss") & "")

ckTOOLBAR=Trim(gParams.Param("ckToolbarSet") & "")
If ckTOOLBAR="" Then ckTOOLBAR="Basic"

'*** FUTURE: WORK NEEDED TWEEKING HEIGHT/WIDTH/LAYOUT definitions!
	'vObj.config.Toolbar=ckTOOLBAR
	vObj.Width=Unit.pixel(nCols)
	vObj.Height=Unit.pixel(nHeight)
'	If sText<>"" Then vObj.Text=sText
	If sID<>"" Then vObj.ID=sID


	editobjform.Controls.Add(vObj)
	vObj=Nothing
		
	*/
} // End function

function GenerateOpts(newObj,sOpts,dValue) {
	debugger;
	return [{}];
	/*
	'*** NOTE: sOpts is NOT used in this version
	'*** NOTE: dValue is NOT used in this version
	*/
} // End function

function GenerateOpts2(newObj,sOpts,dValue) {
	debugger;
	return [{}];
	/*
	'*** NOTE: sOpts is NOT used in this version
	'*** NOTE: dValue is NOT used in this version
	*/
} // End function