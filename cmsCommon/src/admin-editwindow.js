var fDirty,fAfterSave,fldFileBrowse;

$(document).ready(function(){
   // On Page Load...
   fDirty=false;
   
   $("input[type='text'],input[type='radio'],input[type='checkbox'],input[type='hidden'],input[type='file'],select,textarea")
		.not(".ignore-changes")
		.change(function() { fDirty = true; });
	
	//NOTE: Instances of CKEditor do NOT exist at this point!
	// statements like this will not work -> for ( instance in CKEDITOR.instances ) { ...
	/*
	CKEDITOR.on('instanceReady',
      function( evt )
      {
         var editor = evt.editor;
		 editor.on('blur', function() { 
			if(this.checkDirty()){fDirty = true;}
			});
	
      });
	*/
	
	// Restore scroll position
	try {
		var posScroll=sessionStorage["iesRefreshPosition"];
		$(window).scrollTop(posScroll);
		sessionStorage.removeItem("iesRefreshPosition");
	} catch (errscroll) { }
  });
  
function RefreshPage() {
	StoreRefreshPosition();
	document.location.reload(true);
}

function StoreRefreshPosition() { sessionStorage["iesRefreshPosition"] = $(window).scrollTop(); }
  
function docmd(oThis) {
	var s = oThis.name.toLowerCase();
	var p = s.indexOf("-");
	if (p>0) { s = s.substring(0,p); }

	switch (s){
		case "cancel": CloseWindow(false); break;
		case "save": SaveItem('show'); break;
		case "saveclose": SaveItem('close'); break;
		case "copy": MakeCopy(); break;
		}
}

// THE SaveItem() function is now included in admin-edit-form.js (in the dialog iFrame) - is it still needed here? (maybe for the admin page?)
function SaveItem_old(sAfterSave) {
	fAfterSave=sAfterSave;

    //**** NOTE: eClass and Item must be included it the form as a field (usually hidden).
	try {
	
	for ( instance in CKEDITOR.instances ) { 
		CKEDITOR.instances[instance].updateElement(); 
		}

	$.post("/admin/EditWObj/EditList-Save.aspx",$('#EditForm').serialize(),
		function(data) { SaveComplete(data); })
		 .error(function (jqXHR, status, error) {alert('Failed to save record. (err243): ' + error); }
);
		 }
	catch (err) {
		alert('Failed to save record. (err312) '+err.message);
		}
	//**** FUTURE: we need some type of indicator that we are 'saving'... and also an indicator if there is an error.
}

function SaveComplete(sData) {
if (sData.substr(0,20).toLowerCase().indexOf("successful")>=0) {
	//alert('DEBUG:success:sData='+sData);
	fDirty=false;
	if(fAfterSave=='close') {CloseWindow(true);} 
	}
 else { 
	//alert('DEBUG:failed:sData='+sData); 
	alert("Error occured attempting to save this record. (err249)"); }
}

function CloseWindow(ForceFlag) {
	if (ForceFlag==false) {
	  for ( instance in CKEDITOR.instances ) { 
		if(CKEDITOR.instances[instance].checkDirty()){fDirty = true;}
		}
	  if (fDirty==true) { if (confirm("Are you sure you would like to cancel all changes?")!=true) { return false; } }
	  }
	try{window.opener.location.reload();}catch(e){};
	if(closeMode=="back") {history.back();} else { window.close(); }
}

function MakeCopy() {
	/* Set the COPY flag on the form */
	var f=document.getElementsByName('hid_copy_flag');
	if (f) {f.value='TRUE';}
	else {alert("Unable to create copy. (298t)");return;}
	
	/* Change the Record ID to *new* (safety + indicator to user) */
	
	
	alert('Form has been set with a copy of record.');
}

var fldFileBrowse="";
function FileBrowse(fldID,fldType,StartPath) {
	fldFileBrowse=fldID;
	
	// login to ASPX to enable CKFinder (which only works with ASPX)
	$.ajax({
		type: "POST",
		url: "/CKFinder/iesLogin.aspx",
		data: {userObjID:userObjID,world:world,sid:sid},
		success: function(data) { FileBrowseLaunch(fldID,fldType,StartPath); }
	});
}

function FileBrowseLaunch(fldID,fldType,StartPath) {				
	var finder = new CKFinder() ;
	finder.basePath = '/ckfinder/' ;
	finder.selectActionFunction = setFilePath ;
	if (StartPath) { 
		finder.rememberLastFolder=false;
		finder.startupFolderExpanded = true;
		finder.startupPath=StartPath;
		//CKFinder.setupCKEditor( finder, { basePath : '/ckfinder/', id:'123', startupPath : "Images:/Archive/Test/", startupFolderExpanded : true, rememberLastFolder : false } ) ;
	}
	finder.popup();
}
	
function setFilePath(sURL,data) {
	var e = document.getElementsByName(fldFileBrowse);
	if (e[0]) { e[0].value=sURL; }
	}

var $dialog;
this.dialogCmd=function(cmd,refreshFlag) { 
	$dialog.dialog(cmd); 
	if (refreshFlag) { RefreshPage(); }
	}

function modalPopup(url, title){
    //window.showModalDialog( url, '_blank', "menubar=0,location=0,height=700,width=700,scrollbars=yes,sizeable=yes" );
    $dialog = $('#dialog')
        .html('<iframe style="border: 0px; " src="' + url + '" width="900" height="700"></iframe>')
        .dialog({
            title: title,
            autoOpen: false,
            dialogClass: 'dialog_fixed,ui-widget-header',
            modal: true,
            width: 'auto',
            height: 'auto',
            minWidth: 'auto',
            minHeight: 'auto',
            draggable:true,
            resizable: true,
            autoResize:true,
            /*close: function () { $(this).remove(); },*/
            buttons: { /* "Save": function() {
                            return true;
                        },
                        "Save/Close": function() {
                            $(this).dialog("close");
                        }
						,*/
                        "Close": function() {
                            $(this).dialog("close");
                        }
                    }
        });
    $dialog.dialog('open');
}