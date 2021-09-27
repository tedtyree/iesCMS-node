	
function CloseDialog() {
	parent.dialogCmd("close",true);
	}

function SaveItem(CloseAfter) {
    //**** NOTE: eClass and Item must be included it the form as a field (usually hidden).
	try {
	//*** First capture RichText text boxes and copy the content into the corresponding hidden field
	//*** In the future this is not needed if we upgrade to the latest CKEditor and use the jQuery connector
	// FUTURE: capture RichText here?
	
	  $.post("admin-edit-save.ashx?cmd=save&eclass=" + eClass,$('#editlistform').serialize(),
		function(data) { SaveComplete(data,CloseAfter); })
		 .error(function(jqXHR, status, error) { alert("Failed to save record. (err237)");
		});

		} // try
	catch (err) {
		alert('Failed to save record. (err312) '+err.message);
		} // catch
	//**** FUTURE: we need some type of indicator that we are 'saving'... and also an indicator if there is an error.
}

function DeleteItem() {
		// Change the status field to 'Deleted'
		$('#fld_status').val("Deleted");
		// Save/Close the Form
		SaveItem(true);
}

function SaveComplete(sData,CloseAfter) {
//alert(sData);  //DEBUG
	if (sData){
		var sPieces = sData.split(':');
		if ($.trim(sPieces[0]) == "success"){
			fDirty=false;
			if (CloseAfter) {
				CloseDialog();
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

function CloseForm(ForceFlag) {
	if (ForceFlag==false) {
	  for ( instance in CKEDITOR.instances ) { 
		if(CKEDITOR.instances[instance].checkDirty()){fDirty = true;}
		}
	  if (fDirty==true) { if (confirm("Are you sure you would like to cancel all changes?")!=true) { return false; } }
	  }
	parent.dialogCmd("close",true);
}
