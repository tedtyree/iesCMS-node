var pageDirty=false;
var dirtyColor="#f6854e";

$(document).ready(function(){
	// Setup trigger to know if the page/form is dirty
	$('input').change(function() { 
		pageDirty = true; 
		$("input.saveBtn").css("background-color",dirtyColor);
		});
	$('textarea').change(function() { 
		pageDirty = true; 
		$("input.saveBtn").css("background-color",dirtyColor);
		});
	
	pageDirty=false;
	$("input.saveBtn").css("background-color","");
});

function btnSaveForm(CloseAfter) {
	// COMCAST CUSTOMIZATION FOR DOLLARVALUE FIELD - CHECK IF IT IS A VALID NUMBER  (if not - quit without saving)
	if ($("#fldDollarValue").length>0) {
	  if (isNaN($("#fldDollarValue").val())) { alert("Invalid value in Dollar Value field.  Please correct before saving."); return false; }
	 }
	if ($("#fldCountPer").length>0) {
	  if (isNaN($("#fldCountPer").val())) { alert("Invalid value in Count Per field.  Please correct before saving."); return false; }
	 }
		
    //**** NOTE: eClass and Item must be included it the form as a field (usually hidden).
	try {
	//*** CKEditor RichText text boxes no longer need to be pre-processed

	  $.post("admin-edit-save.ashx?cmd=save&eclass=" + eclass,$('#editlistform').serialize(),
		function(data) { SaveComplete7(data,CloseAfter); })
		 .error(function(jqXHR, status, error) { alert("Failed to save record. (err237)");
		});

		} // try
	catch (err) {
		alert('Failed to save record. (err312) '+err.message);
		} // catch

}

function SaveComplete7(sData,CloseAfter) {
//alert(sData);  //DEBUG
	if (sData){
		var sPieces = sData.split(':');
		if ($.trim(sPieces[0]) == "success"){
			//Success
			pageDirty=false;
			$("input.saveBtn").css("background-color","");
			try { window.opener.refreshme();} catch (e3) { }
			if (CloseAfter) {	
				window.close();
			}else{
				if (sPieces[1] && sPieces[2]){
					$("input[name='fld_" + sPieces[1] + "']").val(sPieces[2]);
				}
			}
		}else{
			// if message contains error description, we don't need to add anything to it.
			if (sData.toLowerCase().indexOf("error")>=0) {
				alert(sData.replace('<br>','\n') + "[err237]");
				}
			else {
				alert("Error occured attempting to save this record. [err239]\n" + sData.replace('<br>','\n'));
				}
		}
	} else {
		alert("Error occured attempting to save this record. No Results [err240]\n");
	}
}

function btnCancelForm() {
	if (pageDirty) { if (confirm("Close edit window without saving changes?")==false) { return; } }
	window.close();
}

function btnReloadForm() {
	if (pageDirty) { if (confirm("Cancel edit window without saving changes?")==false) { return; } }
	try {
		document.getElementById("editlistform").reset();
		pageDirty=false;
		$("input.saveBtn").css("background-color","");
	} catch (e5) { }
}