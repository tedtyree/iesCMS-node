var fDirty=false;

$( document ).ready(function() {
    //Look for all the text areas and turn them into ckeditors
	/* $('.richtext').each(function(){
		CKEDITOR.replace($(this).attr('id'));
	}); */
	
	fDirty=false;
	$("input[type='text'],input[type='radio'],input[type='checkbox'],input[type='hidden'],input[type='file'],select,textarea")
		.not(".ignore-changes")
		.change(function() { fDirty = true; });
	
	$('.richtext').ckeditor({
		filebrowserBrowseUrl : '/ckfinder/ckfinder.html',
		filebrowserImageBrowseUrl : '/ckfinder/ckfinder.html?type=Images',
		filebrowserFlashBrowseUrl : '/ckfinder/ckfinder.html?type=Flash',
		filebrowserUploadUrl : '/ckfinder/core/connector/aspx/connector.aspx?command=QuickUpload&type=Files',
		filebrowserImageUploadUrl : '/ckfinder/core/connector/aspx/connector.aspx?command=QuickUpload&type=Images',
		filebrowserFlashUploadUrl : '/ckfinder/core/connector/aspx/connector.aspx?command=QuickUpload&type=Flash',

		contentsCss : '/cmsCommon/src/ckConfig.css'

	});
	
});

// START - pass directory data to JavaScript JSON array
$(function(){
  var collection = [
    { value: 'JD4BT01', data: 'JD4BT01sml.jpg' },
    { value: 'JD4BT04', data: 'JD4BT04sml.jpg' },
    { value: 'JD4BT06', data: 'JD4BT06sml.jpg' },
    { value: 'JD4BT07', data: 'JD4BT07sml.jpg' },
    { value: 'JD4BT09', data: 'JD4BT09sml.jpg' },
    { value: 'JD4BT11', data: 'JD4BT11sml.jpg' },
    { value: 'JD4BT21', data: 'JD4BT21sml.jpg' },
  ];
// END - pass directory data to JavaScript JSON array
	
// Look for Tags that have class set to "imageViewer" and then setup <img> Tag.
	$(".imageViewer").each(function(){
		var imgIDName = 'imageViewer_'.concat($(this).attr('name'));
		//$("<div class='imageViewerDiv'><span class='imageViewerHelperSpan'></span><img id='".concat(imgIDName).concat("' class='imageViewerImage' ></div>")).insertAfter(this);
		$("<div class='imageViewerDiv' style='border:7px solid #A0A0A0;' onclick=\"FileBrowse('" + ($(this).attr('name')) + "','','Images:/articles/');\"><span class='imageViewerHelperSpan'></span><img id='".concat(imgIDName).concat("' class='imageViewerImage' /></div>")).insertAfter(this);
		var prodID = $(this).val(); 
		$(this).change(imageViewerChangeEvent);
		imageViewerUpdate(prodID, imgIDName, this);
	});

// setup autocomplete function pulling from collection[] array
  $(".imageViewer").autocomplete({
    lookup: collection,
    onSelect: function (suggestion) {
		var prodID = $(this).val(); 
		var imgIDName = 'imageViewer_'.concat($(this).attr('name'));
	  imageViewerUpdate(prodID, imgIDName, this);
   }
 });
 
 // Fixed for 215Sports - FUTURE: Make this generic *****************************************
 var collection2 = [
    { value: 'JD4BT01', data: 'JD4BT01sml.jpg' },
    { value: 'JD4BT04', data: 'JD4BT04sml.jpg' },
    { value: 'JD4BT06', data: 'JD4BT06sml.jpg' },
    { value: 'JD4BT07', data: 'JD4BT07sml.jpg' },
    { value: 'JD4BT09', data: 'JD4BT09sml.jpg' },
    { value: 'JD4BT11', data: 'JD4BT11sml.jpg' },
    { value: 'JD4BT21', data: 'JD4BT21sml.jpg' },
  ];
// END - pass directory data to JavaScript JSON array
	
// Look for Tags that have class set to "imageViewer" and then setup <img> Tag.
	$(".imageViewer2").each(function(){
		var imgIDName = 'imageViewer_'.concat($(this).attr('name'));
		alert("here222");
		$("<div class='imageViewerDiv' onclick=\"FileBrowse('" + ($(this).attr('name')) + "','','Images:/articles/');\"><span class='imageViewerHelperSpan'></span><img id='".concat(imgIDName).concat("' class='imageViewerImage' ></div>")).insertAfter(this);
		var prodID = $(this).val();
		var filename = prodID.concat('.jpg'); 
		$(this).change(imageViewerChangeEvent2);
		imageViewerUpdate2(prodID, filename, imgIDName, this);
	});

// setup autocomplete function pulling from collection[] array
  $(".imageViewer2").autocomplete({
    lookup: collection2,
    onSelect: function (suggestion) {
		var prodID = $(this).val();
		var filename = prodID.concat('.jpg'); 
		var imgIDName = 'imageViewer_'.concat($(this).attr('name'));
	  imageViewerUpdate2(prodID, filename, imgIDName, this);
   }
 });
  
});

// Replace image in imageViewDiv, else let broken image icon display
// FUTURE: This needs to be built using a config parameter rather than hard coding folder path names!
function imageViewerUpdate(prodID,imgIDName,fld) {
	if ($(fld).hasClass("productid")){
		document.getElementById(imgIDName).src = "/" + world + "/content/images/products/".concat(prodID).concat("sml.jpg");
	}
	else if ($(fld).hasClass("articleid")){
		document.getElementById(imgIDName).src = "/" + world + "/content/images/articles/".concat(prodID).concat(".jpg");
	}
	else{
		document.getElementById(imgIDName).src = prodID;
	}
}

function imageViewerChangeEvent() {
	var filename = $(this).val().concat('sml.jpg');
	var prodID = $(this).val();
	var imgIDName = 'imageViewer_'.concat($(this).attr('name'));
	imageViewerUpdate(prodID, filename, imgIDName, this);
}

// Fixed for 215Sports - FUTURE: Make this generic *****************************************
// Replace image in imageViewDiv, else let broken image icon display
function imageViewerUpdate2(prodID, filename,imgIDName,fld) {
	if ($(fld).hasClass("productid")){
		document.getElementById(imgIDName).src = "/" + world + "/content/images/products/".concat(prodID).concat("sml.jpg");
	}
	else if ($(fld).hasClass("articleid")){
		document.getElementById(imgIDName).src = "/" + world + "/content/images/articles/".concat(prodID).concat(".jpg");
	}
	else{
		document.getElementById(imgIDName).src = prodID + "[" + fld + "]";
	}
}

function imageViewerChangeEvent2() {
	var filename = $(this).val().concat('.jpg');
	var prodID = $(this).val();
	var imgIDName = 'imageViewer_'.concat($(this).attr('name'));
	imageViewerUpdate2(prodID, filename, imgIDName, this);
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
	var e = $("#" + fldFileBrowse);
	if ($(e).hasClass("productid") || $(e).hasClass("articleid")){
		// Here we remove all of the URL path and get just the file name...
		var fileid = sURL.substr( (sURL.lastIndexOf('/') +1) );
		fileid = fileid.substr(0, fileid.lastIndexOf('.'));
		$(e).val(fileid);
		$('#'+fldFileBrowse).trigger("change");
	}
	else{$(e).val(sURL);}
}
