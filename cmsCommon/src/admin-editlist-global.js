var eClass = ""; //"[ [ admin-get-editlistconfig ] ]";  This now gets set as {{eclass}} tag in set_custom()
var disableDelete = false;
var veditlist, veditlisttable, fDirty, recID, vClass;
var defaultButtonActions = {
	Add:'show', Refresh:'show', SaveClose: 'show', Save:'show', Cancel:'show', Delete:'show', Approve:'hide', Reject:'hide'
};
var buttonActions = {};

$(document).ready(function() {
  //TODO: if editid is set we don't want to load the table but jump immediatly to the form, we'll use this in case of errors etc

  runSetCustom();
  LoadData();

  //When the page first loads we need to get our dataTables
  function LoadData() {
    editlist_settable();
  }
});

function runSetCustom() {
  set_custom();
  buttonActions = {...defaultButtonActions, ...buttonActions};
}

function editlist_settable() {
  // SETUP TABLE...
  var ts = new Date().getTime();

  ShowPanel("loading");

  // Initialize editlist table...
  runSetCustom();

  /* veditlist={
        "ajax": URLwithparams(),
				"iDisplayLength":50,
				"rowId" : "{{editlist-primarykey}}",
        "columns": {{editlist-columns}}
				{{editlistorderby}}
        };
        */
  if (!veditlisttable) {
    veditlisttable = $("#editlisttable").DataTable(veditlist);

    veditlisttable.on("xhr", function() {
      //vtable = $('#editlisttable').DataTable();
      ShowPanel("data");
      var json = veditlisttable.ajax.json();
      var msg = "";
      if (!json) {
        msg = "Data not found. Error or Invalid Permissions. [err1442]";
      } else {
        msg = json.msg;
      }
      if (msg != "success" && msg != "") {
        alert(msg);
      }
      //alert(JSON.stringify(json)); //DEBUG
      //alert( json.data.length +' row(s) were loaded' );  //DEBUG
    });
  } // end if (!veditlisttable)

  // To set a column/field to be a link to the "EDIT FORM", in the editclass .cfg file set the class=editRow
  // The ID of the object/row to edit is picked up from the <tr id='<object_id>'>
  $("body").off("click", ".editRow");
  $("body").on("click", ".editRow", function() {
    //Get the objid and type;
    var rr = $(this).closest("tr");
    var objID = veditlisttable.row(rr).id();

    if (objID) {
      editlist_loadform(objID);
    }
    return false;
  });

  // To set a column/field to be a link to a "VIEW", in the editclass .cfg file set the class=viewRow
  //    AND set the vClass=<view_class_name>
  // The ID of the object/row to edit is picked up from the <tr id='<object_id>'>
  $("body").off("click", ".viewRow");
  $("body").on("click", ".viewRow", function() {
    //Get the objid and vClass;

    var column_num = 0;
    try {
      column_num = $(this)
        .closest("td")
        .index();
      vClass = veditlist["columns"][column_num]["vclass"];
    } catch {}
    var rr = $(this).closest("tr");
    recID = veditlisttable.row(rr).id();

    if (recID) {
      ShowView();
    }
    return false;
  });

  $("body").off("click", ".viewRow2");
  $("body").on("click", ".viewRow2", function() {
    //Get the objid and vClass;

    var column_num = 0;
    try {
      column_num = $(this)
        .closest("td")
        .index();
      vClass = veditlist["columns"][column_num]["vclass"];
    } catch {}
    var rr = $(this).closest("tr");
    recID = veditlisttable.row(rr).id();

    if (recID) {
      ShowView2();
    }
    return false;
  });

  /* Replaced by OpenItem() function...		
	$('body').off('click','#editlist_add1');
	$('body').on('click','#editlist_add1',function(){
		ShowPanel("loading");
		$('.editArea').hide();
		$('.editlist-form').html('');
		$.get('admin-edit-form.ashx?eclass=' + eClass, { id: '*new*' }, function(data){
			if (data){
				$('#editlist-form').html(data);
				ShowPanel("form");
			}
		});
	});
	*/
}

function OpenItem(itemID) {
  ShowPanel("loading");
  $(".editArea").hide();
  $(".editlist-form").html("");
  $.get("admin-edit-form.ashx?eclass=" + eClass, { id: itemID }, function(
    data
  ) {
    if (data) {
      $("#editlist-form").html(data);
      ShowPanel("form");
    }
  });
}

function editlist_loadform(id) {
  recID = id;
  ShowForm();
}

function ShowForm() {
  ShowPanel("loading");
  $(".editArea").hide();
  $(".editlist-form").html("");
  fDirty = false;
  $.get("admin-edit-form.ashx?eclass=" + eClass, { id: recID }, function(data) {
    if (data) {
      $("#editlist-form").html(data);
      ShowPanel("form");
    }
  });
}

function ShowView() {
  ShowPanel("loading");
  $(".editArea").hide();
  $(".editlist-form").html("");
  fDirty = false;
  var nocache = "_" + new Date().getTime();
  $.get("admin-show-view?" + nocache, { id: recID, vClass: vClass }, function(
    data
  ) {
    if (data) {
      $("#editlist-form").html(data);
      ShowPanel("form");
    }
  });
}

function ShowView2() {
  ShowPanel("loading");
  $(".editArea").hide();
  $(".editlist-form").html("");
  fDirty = false;
  var nocache = "_" + new Date().getTime();
  $.get(
    "admin-printform?Target=" + recID + "&" + nocache,
    { id: recID, vClass: vClass },
    function(data) {
      if (data) {
        $("#editlist-form").html(data);
        ShowPanel("viewonly");
      }
    }
  );
}

function SaveItem(CloseAfter, ShowSuccessMessage, saveCmd) {
  // COMCAST CUSTOMIZATION FOR DOLLARVALUE FIELD - CHECK IF IT IS A VALID NUMBER  (if not - quit without saving)
  if ($("#fldDollarValue").length > 0) {
    if (isNaN($("#fldDollarValue").val())) {
      alert(
        "Invalid value in Dollar Value field.  Please correct before saving."
      );
      return false;
    }
  }
  if ($("#fldCountPer").length > 0) {
    if (isNaN($("#fldCountPer").val())) {
      alert("Invalid value in Count Per field.  Please correct before saving.");
      return false;
    }
  }

  //**** NOTE: eClass and Item must be included it the form as a field (usually hidden).
  try {
    //*** First capture RichText text boxes and copy the content into the corresponding hidden field
    //*** In the future this is not needed if we upgrade to the latest CKEditor and use the jQuery connector
    /* DEBUG: FUTURE - put this back or remove it?
	$('input.[id^=rt_]').each(function(index) {
		if($(this).attr('id').indexOf('_Config')<0) {
		//alert(index + ': ' + $(this).attr('id'));alert("descr=" + FCKeditorAPI.Instances[$(this).attr('id')].GetData()); 
		var rt_val=FCKeditorAPI.Instances[$(this).attr('id')].GetData();
		$('input.[id=' + $(this).attr('id').replace('rt_','fld') + ']').val(rt_val);
		}
	});
*/
    var cmd = saveCmd || 'save';
    $.post(
      "admin-edit-save.ashx?cmd=" + cmd + "&eclass=" + eClass,
      $("#editlistform").serialize(),
      function(data) {
        SaveComplete(data, CloseAfter, ShowSuccessMessage);
      }
    ).error(function(jqXHR, status, error) {
      alert("Failed to save record. (err237)");
    });
  } catch (err) {
    // try
    alert("Failed to save record. (err312) " + err.message);
  } // catch
  //**** FUTURE: we need some type of indicator that we are 'saving'... and also an indicator if there is an error.
}

function SaveComplete(sData, CloseAfter, ShowSuccessMessage) {
  //alert(sData);  //DEBUG
  if (sData) {
    var sPieces = sData.split(":");
    if ($.trim(sPieces[0]) == "success") {
	  if (ShowSuccessMessage) {
		  alert("Changes have been saved.");
	  }
      if (CloseAfter) {
        RefreshList(true);
        $("#editlist-form").html("");
        //ShowForm();
      } else {
        if (sPieces[1] && sPieces[2]) {
          $("input[name='fld_" + sPieces[1] + "']").val(sPieces[2]);
        }
      }
    } else {
      // if message contains error description, we don't need to add anything to it.
      if (sData.toLowerCase().indexOf("error") >= 0) {
        alert(sData.replace("<br>", "\n") + "[err237]");
      } else {
        alert(
          "Error occured attempting to save this record. [err239]\n" +
            sData.replace("<br>", "\n")
        );
      }
    }
  } else {
    alert(
      "Error occured attempting to save this record. No Results [err240]\n"
    );
  }
}

function CancelEdit() {
  if (fDirty == true) {
    if (confirm("Are you sure you would like to cancel all changes?") != true) {
      return false;
    }
  }
  RefreshList(true);
  $("#editlist-form").html("");
  //*** FUTURE: requery incase the data changed while we were away.
}

function DeleteItem() {
  SetStatusAndSave('Delete','Deleted','delete');
}

function ApproveRecord() {
  SetStatusAndSave('Approve','Active','approved');
}

function RejectRecord() {
  SetStatusAndSave('Reject','Deleted','rejected');
}

function SetStatusAndSave(action,newStatus,newCmd) {
  if ($("#fld_Status").length > 0 ) {
	// Change the status field
	$("#fld_Status").val(newStatus);
	// Save/Close the Form
	SaveItem(true,false,newCmd);
  } else if  ($("#fld_status").length > 0 ) {
	// Change the status field
	$("#fld_status").val(newStatus);
	// Save/Close the Form
	SaveItem(true,false,newCmd);
  } else {
    alert(action + " has been disabled for this type of item.");
  }
}

function URLwithparams() {
  var ts = new Date().getTime();
  
  urlHistory = "&history=" + $("#fltHistory").is(":checked");
  var url = "admin-edit-data.ashx?eclass=" + eClass + urlHistory + "&ts=" + ts;
  return url;
}

function RefreshList(changePanel) {
  // Refrest Datatables table (fails silently is table does not exist)
  var tbl = $("#editlisttable").DataTable();
  tbl.ajax.reload(null, false); //refresh datatable

  // Refresh VUE table Note: function refreshData() must be defined to do the dirty work.
  if (typeof refreshData === 'function') {
	  refreshData();
  }
  
  // Display the data panel
  if (changePanel) {
    ShowPanel("data");
  }
}

function ShowPanel(sPanel) {
  //First we hide everything
  $("#editlist-loading").hide();
  $("#editlist-data").hide();
  $("#editlist-form").hide();

  /*  THIS HAS BEEN REPLACED WITH buttonActions
  $('#buttons_save1 > :input[name="SaveClose"]').removeAttr("disabled");
  $('#buttons_save1 > :input[name="Save"]').removeAttr("disabled");
  $('#buttons_save2 > :input[name="SaveClose2"]').removeAttr("disabled");
  $('#buttons_save2 > :input[name="Save2"]').removeAttr("disabled");
  $('#buttons_save1 > :input[name="SaveClose"]').css("opacity", "1");
  $('#buttons_save1 > :input[name="Save"]').css("opacity", "1");
  $('#buttons_save2 > :input[name="SaveClose2"]').css("opacity", "1");
  $('#buttons_save2 > :input[name="Save2"]').css("opacity", "1");
  $('#buttons_save1 > :input[name="Delete"]').removeAttr("disabled").css("opacity", "1");
  $('#buttons_save2 > :input[name="Delete"]').removeAttr("disabled").css("opacity", "1");
  */
  
  //Then we show what was requested
  switch (sPanel) {
    case "loading": //Loading panel - leave buttons - leave search
      $("#editlist-loading").show();
      break;
    case "data": //Load search panel and associated buttons + search form
      $("#editlist-data").show();
      $("div.button_group_search").show();
      $("#editlist_searchform").show();
      $("div.button_group_save").hide();
	  setButton('Add');
	  setButton('Refresh');
      break;
    case "form": //Load form panel and associated buttons - NO search form
      $("#editlist-form").show();
      $("div.button_group_save").show();
      $("#editlist_searchform").hide();
      $("div.button_group_search").hide();
	  /*  THIS HAS BEEN REPLACED WITH buttonActions
      if (disableDelete) {
        $('#buttons_save1 > :input[name="Delete"]')
          .attr("disabled", "disabled")
          .css("opacity", 0.5);
        $('#buttons_save2 > :input[name="Delete"]')
          .attr("disabled", "disabled")
          .css("opacity", 0.5);
      } */
	  setButton('SaveClose');
	  setButton('Save');
	  setButton('Cancel');
	  setButton('Delete');
	  setButton('Approve');
	  setButton('Reject');
      break;
    case "viewonly": //Load form panel and associated buttons - NO search form - NO SAVE
      $("#editlist-form").show();
      $("div.button_group_save").show();
	  /*  THIS HAS BEEN REPLACED WITH setButton()
      $('#buttons_save1 > :input[name="SaveClose"]').attr("disabled","disabled");
      $('#buttons_save1 > :input[name="Save"]').attr("disabled", "disabled");
      $('#buttons_save2 > :input[name="SaveClose2"]').attr("disabled","disabled");
      $('#buttons_save2 > :input[name="Save2"]').attr("disabled", "disabled");
      $('#buttons_save1 > :input[name="SaveClose"]').css("opacity", "0.5");
      $('#buttons_save1 > :input[name="Save"]').css("opacity", "0.5");
      $('#buttons_save2 > :input[name="SaveClose2"]').css("opacity", "0.5");
      $('#buttons_save2 > :input[name="Save2"]').css("opacity", "0.5");
	  */
      $("#editlist_searchform").hide();
      $("div.button_group_search").hide();
	  /*  THIS HAS BEEN REPLACED WITH buttonActions
      if (disableDelete) {
        $('#buttons_save1 > :input[name="Delete"]')
          .attr("disabled", "disabled")
          .css("opacity", 0.5);
        $('#buttons_save2 > :input[name="Delete"]')
          .attr("disabled", "disabled")
          .css("opacity", 0.5);
      } */
	  setButton('SaveClose','disabled');
	  setButton('Save','disabled');
	  setButton('Cancel');
	  setButton('Delete','disabled');
	  setButton('Approve','hide');
	  setButton('Reject','hide');
      break;
  } // end switch
}// end function
  
function setButton(buttonID,forceAction) {
	var action = buttonActions[buttonID];
	if (forceAction) { action = forceAction; }
	const buttonSpan = "span.button_" + buttonID + "_span";
	if (action) {
		switch(action) {
			case 'show':
				$(buttonSpan).show();
				$(buttonSpan + ' input').removeAttr("disabled").css("opacity", "1");;
				break;
			case 'disable':
				$(buttonSpan).show();
				$(buttonSpan + ' input').attr("disabled","disabled").css("opacity", "0.5");;
				break;
			default: // hide
				$(buttonSpan).hide();
				break;
		}
	}
  } // end function setButton()

