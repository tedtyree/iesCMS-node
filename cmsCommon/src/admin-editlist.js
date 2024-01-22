var eClass,fDirty,fSingleRecord,urlObj,world,sworld,urlParent,eCmd,SearchList,SpecialFlags,recType,RemoveOK=false,currPageNum="&page=1";

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
	SpecialFlags=vData['SpecialFlags'];
	SearchList=vData['SearchList'];
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
		if (SearchList) {
			// first build header row
			newHtml += '<tr class="EditListTitles">';
			for (var k of SearchList) {
				let alias = k.Alias || k.Field;
				// future: hide column if width=0? Or special flag set?
				newHtml += '<th>' + $('<div>').text(alias).html() + '</th>';
			}
			newHtml += '</tr>';
			if (sData.data) {
				
				// build each data row
				for (var row of sData.data) {
					newHtml += '<tr>';
					for (var k of SearchList) {
						let field = (k.Field + '').replace(/\`/g,'');
						let j = row[field];
						if (j) { j = j + ''; } else { j = ''; }
						newHtml += '<td>' + $('<div>').text(j).html() + '</td>';
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
	  $.post("/admin/EditWObj/EditList-Obj.aspx?ts=" + ts,{ "objworld": worldOpt, "eclass": eClass, "item": sItem, "parent": urlParent },
		function(data) { SetItem(data); });
	} else {
	  $.post("/admin/EditWObj/EditList-Record.aspx?ts=" + ts,{ "objworld": worldOpt, "eclass": eClass, "item": sItem, "parent": urlParent },
		function(data) { SetItem(data); });
	}
}

function SetItem(sData,sItem) {
	$('#editlist_form').html(sData);
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
	//alert('sflags=' + SpecialFlags); //*** DEBUG
	if (SpecialFlags) {
	  if ((SpecialFlags.toLowerCase().indexOf('copybutton')>0) && (sItem!="*new*")) {
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
			$.post("/admin/EditWObj/EditList-SaveRec.aspx?cmd=save&eclass=" + eClass + sworld,$('#editobjform').serialize(),
				function(data) { SaveComplete(data); })
					.error(function(jqXHR, status, error) { alert("Failed to save record. (err248)");
				//alert(status + ": " + error);
				});
			}
		}
	catch (err) {
		alert('Failed to save record. (err312) '+err.message);
		}
	//**** FUTURE: we need some type of indicator that we are 'saving'... and also an indicator if there is an error.
}

function SaveComplete(sData,CloseAfter) {
//alert(sData); // DEBUG DEBUG DEBUG
if (sData.substr(0,20).toLowerCase().indexOf("successful")>=0) {
	//alert('save successful sData=' + sData);  //DEBUG DEBUG DEBUG
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
 else { 
	alert("Error occured attempting to " + eCmd + " this record. (err249)\n" + sData.replace('<br>','\n'));
	if (eCmd=="Delete" || eCmd=="Remove") { eCmd="Save"; }
 }
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
	