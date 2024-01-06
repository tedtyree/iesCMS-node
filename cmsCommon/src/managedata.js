var root = "/" + world;
var cachedForm = false;
var cfgType = "", cfgTable = "", cfgHistory = false;
var listType = "", listTable ="", listDiv = "";
$(function () {
    //Hide AdminMenuLink if needed...
    hideShowAdminLinks();

    if ($("body").hasClass("admin_settings_users") || $("body").hasClass("settings_users")) {
        //Let's get the information from the backend
        listType = "list";
        listTable ="members";
        listDiv = "#user_list";
        GetList(listType, listTable, cfgHistory, listDiv);
    }

    if ($("body").hasClass("admin_settings_customers")) {
        //Let's get the information from the backend
        listType = "list";
        listTable ="customer";
        listDiv = "#customer_list";
        GetList(listType, listTable, cfgHistory, listDiv);
    }

    $('label.required').append("<span class='requiredred'>*</span>");

    $('.hoverme').tooltip();

    $("body").delegate(".datepicker", "click", function () {
        var $this = $(this);
        if (!$this.data('datepicker')) {
            $this.datepicker({dateFormat: 'yy-mm-dd'});
            $this.datepicker("show");
        }
        return false;
    });

    $('body').delegate('.show_history', 'change', function () {
        if ($(this).is(":checked")) {
            cfgHistory = true;
        } else {
            cfgHistory = false;
        }
        GetList(listType, listTable, cfgHistory, listDiv);
    });

    $('body').delegate(".additem", "click", function () {
        var dType = "add";
        var dTable = $(this).attr("table");
        var dTemplate = dType + '_' + dTable;

        GetForm("Creating Form...",dType, dTable, dTemplate);
    });

    $('body').delegate(".edititem", "click", function () {
        var dType = "edit";
        var dTable = $(this).attr("table");
        var dKey = $(this).attr("key");
        var dTemplate = dType + '_' + dTable;

        GetForm("Retrieving Information...",dType, dTable, dTemplate, dKey);
    });

    $("#adminModal").on("hidden.bs.modal", function () {
        $('#adminModal .modal-title').html('');
        $('#adminModal .modal-body').html('');
    });

    $('#adminModal').on('shown.bs.modal', function () {
        $('#adminModal .modal-body').scrollTop(0);
    });

    $('body').delegate(".checkme", "focusin", function () {
        $('#save_changes').prop("disabled", true);
    });

    //Check for required items
    $('body').delegate("#save_changes","click",function(){
        //loop through required items on page first
        var hasError = false;
        $('.form-control').each(function(){
            var currentField = $(this);
            var inputVal = $(this).val();
            var inputID = $(this).attr('id');
            //if the item is required we need to check the value
            if ( $( this ).hasClass( "required" ) ) {
                if (!inputVal && inputID){
                    checkID = inputID.toLowerCase();

                    $('#' + checkID + 'Check').html('This is a required field!');
                    $('#' + checkID + 'Check').addClass('isrequired');

                    var container = $('#adminModal .modal-body');
                    var scrollTo = $('#' + inputID);
                    container.animate({
                        scrollTop: scrollTo.offset().top - container.offset().top + container.scrollTop()
                    });
                    hasError = true;
                }
            }

            //we now handle any custom function
            if (currentField.attr('jsexec') !== undefined) {
                var allJS = currentField.attr('jsexec');
                var jsPieces = allJS.split(":");
                // we should execute the function with the given parameters
                window[jsPieces[0]](inputID,jsPieces[1]);
            }
        });

        if (!hasError) {
            $.isLoading(
                {
                    text: "One Moment, Saving Info...",
                    'tpl': '<span class="isloading-wrapper %wrapper%"><img class="isloadingimage" src="' + root + '/images/loading_default.gif"><span class="isloadingwording">%text%</span></span>',
                    position:   "overlay"
                }
            );

            //Serialize the form and submit it, don't close the modal until we hear from the backend
            var thisFormData = $('.modal-body form .serialize').serializeFormJSON(); //This only does the inputs and normal selects

            //find any multiselects and add in those values
            $('select.serialize.multiselect').each(function () {
                var selectID = $(this).attr('id');
                var selectName = this.name;
                var selectedOptions = [];
                $('#' + selectID + "> option").each(function () {
                    selectedOptions.push($(this).val());
                });
                if (selectedOptions.length > 0) {
                    thisFormData[selectName] = selectedOptions.toString();
                } else {
                    thisFormData[selectName] = '';
                }
            });

            //send our form data to the backend
            var formTable = $('.modal-body form').attr('table');
            var formKey = $('.tablekey').attr('id');
            var keyValue = $('.tablekey').val();
            $.post(root + "/src/saveData.aspx", {
                table: formTable,
                key: formKey,
                value: keyValue,
                formdata: thisFormData
            }, function (saveResults) {
                $.isLoading("hide");
                if (saveResults.success == "false") {
                    $('#adminModal').modal('hide');
                    BootstrapDialog.alert({
                        size: BootstrapDialog.SIZE_NORMAL,
                        title: 'WARNING',
                        message: saveResults.errors,
                        type: BootstrapDialog.TYPE_WARNING, // <-- Default value is BootstrapDialog.TYPE_PRIMARY
                        closable: true, // <-- Default value is false
                        draggable: true, // <-- Default value is false
                    });
                } else {
                    $('#adminModal').modal('hide');
                    BootstrapDialog.alert({
                        size: BootstrapDialog.SIZE_NORMAL,
                        title: 'SUCCESS',
                        message: saveResults.message,
                        type: BootstrapDialog.TYPE_SUCCESS, // <-- Default value is BootstrapDialog.TYPE_PRIMARY
                        closable: true, // <-- Default value is false
                        draggable: true, // <-- Default value is false
                    });
                    GetList(listType, listTable, cfgHistory, listDiv);
                }
            });
        }
    });

    $('body').delegate(".required","focus",function(){
        var inputID = $(this).attr('id');
        if (inputID){
            inputID = inputID.toLowerCase();
            if ($('#' + inputID + 'Check').hasClass("isrequired")){
                $('#' + inputID + 'Check').html('');
                $('#' + inputID + 'Check').removeClass('isrequired');
            }
        }
    });

    //
    $('body').delegate(".onchangeevent",'change',function(){
        var currentVal = $(this).val();
        var currentID = $(this).attr('id');
        if (currentID && currentVal){
            var dType = $('.modal-body form').attr('type');
            var dTable = $('.modal-body form').attr('table');
            var dKey = $('.modal-body .tablekey').val();
            var dTemplate = dType + '_' + dTable;

            //Save form Data, we only want to save data in case it's a new customer or they have changed the data
            cacheForm();
            GetForm("Updating Form...",dType, dTable, dTemplate, dKey, currentID, currentVal);
        }
    });

    $('body').delegate(".checkme", "focusin", function () {
        var checkID = $(this).attr('id');

        //try to remove the required red class
        try {
            $('#' + checkID.toLowerCase() + 'Check').removeClass('requiredred');
        }catch(e){

        }

        $('#' + checkID.toLowerCase() + 'Check').html('Click outside of text box to verify changes.');
        $('#' + checkID.toLowerCase() + 'Check').addClass('rememberorange');
    });

    //check certain information
    $('body').delegate(".checkme", "focusout", function () {
        var checkInfo = $(this).attr('checkfield');
        var checkValue = $(this).val();
        var checkID = $(this).attr('id');
        var keyName = $('.tablekey').attr('id');
        var checkKey = $('.tablekey').val();

        $('#' + checkID.toLowerCase() + 'Check').html('');
        try {
            $('#' + checkID.toLowerCase() + 'Check').removeClass('rememberorange');
        }catch(e){

        }

        if (checkInfo && checkValue && keyName && checkKey) {
            $.post(root + "/src/fieldCheck.aspx", {
                detail: checkInfo,
                current: checkValue,
                tablekey: keyName,
                keyvalue: checkKey
            }, function (results) {
                if (results.success == "false") {
                    $('#' + checkID.toLowerCase() + 'Check').html(results.message);
                    $('#' + checkID.toLowerCase() + 'Check').addClass('requiredred');
                    $('#save_changes').prop("disabled", true);
                } else {
                    $('#' + checkID.toLowerCase() + 'Check').html('');
                    try {
                        $('#' + checkID.toLowerCase() + 'Check').removeClass('requiredred');
                    }catch(e){

                    }
                    $('#save_changes').prop("disabled", false);
                }
            });
        }
    });

    if ($("body").hasClass("admin-pages")) {
        var ischecked = false;
		$(window).load(function () { 
			$(".showfiles").trigger("click"); // Default tab on 'Pages' tab = Edit Files subtab
		});
		
		
        $('body').delegate(".listfiles", "click", function () { // IMPORT FILES TAB
            var dataTarget = '#filelist';
            /*$.isLoading(
                {
                    text: "Collecting File Information...",
                    'tpl': '<span class="isloading-wrapper %wrapper%"><img class="isloadingimage" src="' + root + '/images/loading_default.gif"><span class="isloadingwording">%text%</span></span>',
                    position:   "overlay"
                }
            );*/
			
            //$.post("runcmd.ashx", {
			$.post(root + "/src/managedata.aspx", {
                rtype: 'tools',
                cmd: 'listcontentfiles',
            }, function (results) {
                //$.isLoading("hide");
                if (results.success == "false") {
                    $('#adminModal').modal('hide');
                    BootstrapDialog.alert({
                        size: BootstrapDialog.SIZE_NORMAL,
                        title: 'WARNING',
                        message: results.errors,
                        type: BootstrapDialog.TYPE_WARNING, // <-- Default value is BootstrapDialog.TYPE_PRIMARY
                        closable: true, // <-- Default value is false
                        draggable: true, // <-- Default value is false
                    });
                } else {
                    if ($.fn.DataTable.isDataTable(dataTarget)) {
                        var thisTable = $(dataTarget).DataTable();
                        thisTable.clear();
                        thisTable.destroy();
                        $('#filelist').html('');
                    }

                    $(dataTarget).dataTable({
                        "data": results.data,
                        "columns": results.columns,
                        dom: 'frtip',
                        "paging": false,
                        'columnDefs': [{
                            'targets': 0,
                            'searchable': false,
                            'orderable': false,
                            'className': 'dt-body-center',
                            'render': function (data, type, full, meta){
                                return '<input type="checkbox" id="' + full["Page ID"] + '" name="' + full["Page ID"] + '" value="' + $('<div/>').text(data).html() + '">';
                            }
                        }],
                        'order': [[2, 'asc']]
                    });

                    //Add the insert button
                    if ($('.insertfiles').length == 0){
                        $('#filelist_wrapper').prepend('<button type="button" class="btn btn-primary insertfiles">Insert/Update Files</button>');
                        $('.insertfiles').css('float','left');
                    }
                }
            }, 'json');
        });

        $('body').delegate("#filelist thead tr th:first-child", "click", function () {
            
			try {
                var thisTable = $('#filelist').DataTable();
                var rows = thisTable.rows({'search': 'applied'}).nodes();
                console.log(rows);
                // Check/uncheck checkboxes for all rows in the table
                if (ischecked) {
                    ischecked = false;
                }else{
                    ischecked = true;
                }

                $('input[type="checkbox"]', rows).prop('checked', ischecked);
            }catch (e){
                //console.log(e.message);
            }
        });

        $('body').delegate(".insertfiles", "click", function(){
            var fileList = [];
            // Iterate over all checkboxes in the table
            var thisTable = $('#filelist').DataTable();
            thisTable.$('input[type="checkbox"]').each(function(){
                // If checkbox is checked
                if(this.checked) {
                    fileList.push($(this).attr('id'));
                }
            });

            if (fileList.length == 0){
                BootstrapDialog.alert({
                    size: BootstrapDialog.SIZE_SMALL, title: 'WARNING',  message: 'No Files Selected', type: BootstrapDialog.TYPE_WARNING, closable: true, draggable: true,
                });
            }else{
                //take out list and push it to the backend
                /* $.isLoading(
                    {
                        text:       "Updating Files in Database...",
                        'tpl': '<span class="isloading-wrapper %wrapper%"><img class="isloadingimage" src="' + root + '/images/loading_default.gif"><span class="isloadingwording">%text%</span></span>',
                        position:   "overlay"
                    }
                ); */

                $.post(root + "/src/manageData.aspx", {
                    rtype: 'tools',
                    cmd: 'importfiles',
                    files: fileList.toString()
                }, function (results) {
                    //$.isLoading("hide");
                    if (results.success == "false") {
                        BootstrapDialog.alert({
                            size: BootstrapDialog.SIZE_SMALL, title: 'WARNING', message: results.errors, type: BootstrapDialog.TYPE_WARNING, closable: true, draggable: true,
                        });
                    } else {
                        var thisTable = $('#filelist').DataTable();
                        thisTable.destroy();
                        $('#filelist').html('');
                        BootstrapDialog.alert({
                            size: BootstrapDialog.SIZE_SMALL, title: 'SUCCESS', message: 'Successfully Imported Files', type: BootstrapDialog.TYPE_SUCCESS, closable: true, draggable: true,
                        });
                    }
                }, 'json');
            }
        });

        $('body').delegate(".showfiles", "click", function () {  // EDIR FILES TAB
            var dataTarget = '#filelist';
            /* $.isLoading(
                {
                    text: "Loading Files...",
                    'tpl': '<span class="isloading-wrapper %wrapper%"><img class="isloadingimage" src="' + root + '/images/loading_default.gif"><span class="isloadingwording">%text%</span></span>',
                    position:   "overlay"
                }
            ); */

            //$.post("runcmd.ashx", {
			$.post(root + "/src/managedata.aspx", {
                rtype: 'tools',
                cmd: 'listallfiles',
            }, function (results) {
                //$.isLoading("hide");
                if (results.success == "false") {
                    BootstrapDialog.alert({
                        size: BootstrapDialog.SIZE_NORMAL,
                        title: 'WARNING',
                        message: results.errors,
                        type: BootstrapDialog.TYPE_WARNING, // <-- Default value is BootstrapDialog.TYPE_PRIMARY
                        closable: true, // <-- Default value is false
                        draggable: true, // <-- Default value is false
                    });
                } else {
                    if ($.fn.DataTable.isDataTable(dataTarget)) {
                        var thisTable = $(dataTarget).DataTable();
                        thisTable.clear();
                        thisTable.destroy();
                        $('#filelist').html('');
                    }

                    $(dataTarget).dataTable({
                        "data": results.data,
                        "columns": results.columns,
                        dom: 'frtip',
                        "paging": false,
                        'columnDefs': [{
                            'targets': 0,
                            'searchable': false,
                            'orderable': false,
                            'className': 'dt-body-center',
                            'render': function (data, type, full, meta){
                                return '<button type="button" class="btn btn-info editfile" id="' + full["Page ID"] + '" >Edit</button>';
                            }
                        }],
                        'order': [[2, 'asc']]
                    });

                    $(dataTarget + ' td:nth-child(1)').css('text-align','left');
                }
            }, 'json');
        });

        $('body').delegate(".createfile", "click", function(){
            /*$.isLoading(
                {
                    text: "Loading File Template...",
                    'tpl': '<span class="isloading-wrapper %wrapper%"><img class="isloadingimage" src="' + root + '/images/loading_default.gif"><span class="isloadingwording">%text%</span></span>',
                    position:   "overlay"
                }
            );*/

            //post it to the backend to create the form
            $.post(root + "/src/manageData.aspx", {
                rtype: 'tools',
                cmd: 'addfile',
            }, function (x) {
                $.isLoading("hide");
                if (fileResults.success == "false") {
                    $('#adminModal').modal('hide');
                    BootstrapDialog.alert({
                        size: BootstrapDialog.SIZE_NORMAL,
                        title: 'WARNING',
                        message: fileResults.errors,
                        type: BootstrapDialog.TYPE_WARNING, // <-- Default value is BootstrapDialog.TYPE_PRIMARY
                        closable: true, // <-- Default value is false
                        draggable: true, // <-- Default value is false
                    });
                    $('#adminModal').modal('hide');
                } else {
                    if (fileResults.form_title) {
                        $('.modal-title').html(fileResults.form_title);
                    }

                    $('.modal-content').resizable({
                        //alsoResize: ".modal-dialog",
                        minHeight: 650,
                        minWidth: 650,
                    });


                    $('.modal-body').css('height','450px');
                    $('.modal-title').css('textTransform', 'capitalize');
                    $('.modal-body').css('overflow-y','auto');
                    $('.modal-dialog').css('width','800px');
                    $('.modal-body').html(fileResults.form);

                    $('#adminModal').modal('show', {backdrop: 'static', keyboard: true});

                    try {
                        $('.richtext').ckeditor({
                            filebrowserBrowseUrl : '/ckfinder/ckfinder.html',
                            filebrowserImageBrowseUrl : '/ckfinder/ckfinder.html?type=Images',
                            filebrowserFlashBrowseUrl : '/ckfinder/ckfinder.html?type=Flash',
                            filebrowserUploadUrl : '/ckfinder/core/connector/aspx/connector.aspx?command=QuickUpload&type=Files',
                            filebrowserImageUploadUrl : '/ckfinder/core/connector/aspx/connector.aspx?command=QuickUpload&type=Images',
                            filebrowserFlashUploadUrl : '/ckfinder/core/connector/aspx/connector.aspx?command=QuickUpload&type=Flash'
                        });
                    }catch (e){
                        console.log(e.message);
                    }
                }
            });
        });

        $('body').delegate(".editfile", "click", function(){
			admin_open_edit($(this).attr('id'));
        });

        //Check for required items
        $('body').delegate("#save_file","click",function(){
            admin_save_form();
        });
    }
});

function hideShowAdminLinks() {
	if(typeof ShowAdminMenuLink !== 'undefined' && ShowAdminMenuLink) {
		$('#admin_menu_link_btn').show();
	} else {
		$('#admin_menu_link_btn').hide();
	}
	if(typeof ShowAdminEditPage !== 'undefined' && ShowAdminEditPage) {
		$('#admin_editpage_link_btn').show();
	} else {
		$('#admin_editpage_link_btn').hide();
	}

}

// This version of admin_open_edit uses an overlay window...
function admin_open_edit(thisFileName) {
	//get the file id
            //if (!thisFileName) {thisFileName = $(this).attr('id')};
            if (thisFileName){
                /* $.isLoading(
                    {
                        text: "Loading File Information...",
                        'tpl': '<span class="isloading-wrapper %wrapper%"><img class="isloadingimage" src="' + root + '/images/loading_default.gif"><span class="isloadingwording">%text%</span></span>',
                        position:   "overlay"
                    }
                ); */

                //post it to the backend to create the form
                //$.post("runcmd.ashx", {
				$.post(root + "/src/managedata.aspx", {
                    rtype: 'tools',
                    cmd: 'editfile',
                    filename: thisFileName
                }, function (fileResults) {
                    //$.isLoading("hide");
                    if (fileResults.success == "false") {
                        $('#adminModal').modal('hide');
                        BootstrapDialog.alert({
                            size: BootstrapDialog.SIZE_NORMAL,
                            title: 'WARNING',
                            message: fileResults.errors,
                            type: BootstrapDialog.TYPE_WARNING, // <-- Default value is BootstrapDialog.TYPE_PRIMARY
                            closable: true, // <-- Default value is false
                            draggable: true, // <-- Default value is false
                        });
                        $('#adminModal').modal('hide');
                    } else {
                        if (fileResults.form_title) {
                            $('.modal-title').html(fileResults.form_title);
                        }

                        $('.modal-content').resizable({
                            //alsoResize: ".modal-dialog",
                            minHeight: 650,
                            minWidth: 650,
                        });


                        $('.modal-body').css('height','450px');
                        $('.modal-title').css('textTransform', 'capitalize');
                        $('.modal-body').css('overflow-y','auto');
                        $('.modal-dialog').css('width','800px');
                        $('.modal-body').html(fileResults.form);

                        $('#adminModal').modal('show', {backdrop: 'static', keyboard: true});

                        try {
                            $('.richtext').ckeditor({
                                filebrowserBrowseUrl : '/ckfinder/ckfinder.html',
                                filebrowserImageBrowseUrl : '/ckfinder/ckfinder.html?type=Images',
                                filebrowserFlashBrowseUrl : '/ckfinder/ckfinder.html?type=Flash',
                                filebrowserUploadUrl : '/ckfinder/core/connector/aspx/connector.aspx?command=QuickUpload&type=Files',
                                filebrowserImageUploadUrl : '/ckfinder/core/connector/aspx/connector.aspx?command=QuickUpload&type=Images',
                                filebrowserFlashUploadUrl : '/ckfinder/core/connector/aspx/connector.aspx?command=QuickUpload&type=Flash'
                            });
                        }catch (e){
                            console.log(e.message);
                        }
                    }
                });
            }
}

// This version of admin_open_edit uses a dialog/popup window
function admin_open_edit_d(thisFileName,allowCreate) {
	//var url="/admin/src/managedata.aspx?rtype=tools&cmd=editfile&filename=" +thisFileName;
	var flgAllow="";
	if (allowCreate) { flgAllow="&AllowCreate=true"; }

	var url="/admin-edit-popup?eclass=edit-wikipage" + flgAllow + "&id=" + thisFileName;

	var w = 1150;
	var h = 600;
	if (w > window.top.outerWidth) { w=window.top.outerWidth-20; }
	if (h > window.top.outerHeight) { w=window.top.outerHeight-20; }
	var x = window.top.outerWidth / 2 + window.top.screenX - ( w / 2);
	var y = window.top.outerHeight / 2 + window.top.screenY - ( h / 2);
	var pup=window.open(url,'iesPageEditor','width=' + w + ',height=' + h + ',left=' + x + ',top=' + y +
        ',menubar=no,status=no,toolbar=no,scrollbars=yes,location=no,directories=no,resizable=yes');
}

function admin_save_form() {
	//loop through required items on page first
/* not needed because we are using the jquery.js adapter for CKEditor?
	try {
		for (instance in CKEDITOR.instances) {
			CKEDITOR.instances[instance].updateElement();
		}
	}catch(e){
		console.log(e.message);
	}
*/

	/* $.isLoading(
		{
			text: "One Moment, Saving Info...",
			'tpl': '<span class="isloading-wrapper %wrapper%"><img class="isloadingimage" src="' + root + '/images/loading_default.gif"><span class="isloadingwording">%text%</span></span>',
			position:   "overlay"
		}
	); */

	//loop through all textarea and convert to safe input - NO LONGER MAKE SAFE HERE 1/7/17 TT
	//$('textarea').each(function(){
	//	$(this).val(makeSafe($(this).val()));
	//});

	//Serialize the form and submit it, don't close the modal until we hear from the backend - Modified to use standard serialize() function
	var thisFormData = $('.modal-body form').serialize(); //serializeFormJSON(); //This only does the inputs and normal selects
	
	//send our form data to the backend
	//$.post("runcmd.ashx?rtype=tools&cmd=savefile", thisFormData, function (saveResults) {
	// NOTE: The .ashx extention below invokes the iesHandler which in turn changes the .ashx to .aspx and runs the proper util
	// Invoking the .aspx directly gives an error because the HTML in the serialized form causes IIS to give an error
	$.post(root + "/src/managedata.aspx?rtype=tools&cmd=savefile", thisFormData, function (saveResults) {
		//$.isLoading("hide");
		if (saveResults.success == "false") {
			$('#adminModal').modal('hide');
			BootstrapDialog.alert({
				size: BootstrapDialog.SIZE_NORMAL,
				title: 'WARNING',
				message: saveResults.errors,
				type: BootstrapDialog.TYPE_WARNING, // <-- Default value is BootstrapDialog.TYPE_PRIMARY
				closable: true, // <-- Default value is false
				draggable: true, // <-- Default value is false
			});
		} else {
			$('#adminModal').modal('hide');
			BootstrapDialog.alert({
				size: BootstrapDialog.SIZE_NORMAL,
				title: 'SUCCESS',
				message: saveResults.message,
				type: BootstrapDialog.TYPE_SUCCESS, // <-- Default value is BootstrapDialog.TYPE_PRIMARY
				closable: true, // <-- Default value is false
				draggable: true, // <-- Default value is false
			});
			$(".showfiles").trigger("click");
		}
	});
};

var delay = (function () {
    var timer = 0;
    return function (callback, ms) {
        clearTimeout(timer);
        timer = setTimeout(callback, ms);
    };
})();

(function ($) {
    $.fn.serializeFormJSON = function () {
        var o = {};
        var a = this.serializeArray();
        $.each(a, function () {
            if (o[this.name]) {
                if (!o[this.name].push) {
                    o[this.name] = [o[this.name]];
                }
                o[this.name].push(this.value || '');
            } else {
                o[this.name] = this.value || '';
            }
        });
        return o;
    };
})(jQuery);

function fillfield(field, filling){
    var currentVal = $('#' + field).val();
    if (!currentVal) {
        $('#' + field).val(filling);
    }
}

function createunique(field, characters){
    var currentVal = $('#' + field).val();
    if (!currentVal) {
        characters = Number(characters);
        if (!characters) {
            characters = 10;
        }

        var text = '';
        var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

        for (var i = 0; i < characters; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        $('#' + field).val(text);
    }
}

function cacheForm(){
    cachedForm = true;
    var thisFormData = $('.modal-body form .cacheme').serializeFormJSON();
    Cookies.set('adminformdata', JSON.stringify(thisFormData));
}

function reloadForm(){
    var thisFormData = Cookies.get('adminformdata');
    if (thisFormData){
        var formOBJ = JSON.parse(thisFormData);
        for (var key in formOBJ) {
            if (formOBJ.hasOwnProperty(key)) {
                $('#' + key).val(formOBJ[key]);
            }
        }
    }
}

function clearFormCookie(){
    cachedForm = false;
    Cookies.remove('adminformdata');
}

function makeSafe(input) {
    return encodeURI(input);
};

function GetForm(loadingMessge, dType, dTable, dTemplate, dKey, fieldID, fieldValue){
    if (fieldID === undefined) {
        fieldID = '';
    }

    if (fieldValue === undefined) {
        fieldValue = '';
    }

    if (dKey === undefined){
        dKey = "new";
    }


    if (loadingMessge === undefined){
        loadingMessge = "Loading...";
    }

    if (dType && dTable && dKey) {
        $.isLoading(
            {
                text: "One Moment, " + loadingMessge,
                'tpl': '<span class="isloading-wrapper %wrapper%"><img class="isloadingimage" src="' + root + '/images/loading_default.gif"><span class="isloadingwording">%text%</span></span>',
                position:   "overlay"
            }
        );

        $.post(root + "/src/manageData.aspx", {
            rtype: 'data',
            cmd: dType,
            table: dTable,
            template: dTemplate,
            requestid: dKey,
            updatedfield: fieldID,
            updatedvalue: fieldValue
        }, function (reportResults) {
            $.isLoading("hide");
            if (reportResults.success == "false") {
                $('#adminModal').modal('hide');
                BootstrapDialog.alert({
                    size: BootstrapDialog.SIZE_NORMAL,
                    title: 'WARNING',
                    message: reportResults.errors,
                    type: BootstrapDialog.TYPE_WARNING, // <-- Default value is BootstrapDialog.TYPE_PRIMARY
                    closable: true, // <-- Default value is false
                    draggable: true, // <-- Default value is false
                });
                $('#adminModal').modal('hide');
            } else {
                if (reportResults.form_title) {
                    $('.modal-title').html(reportResults.form_title);
                } else {
                    $('.modal-title').html(dType + ' ' + dTable);
                }

                $('.modal-title').css('textTransform', 'capitalize');
                $('.modal-body').css('height','450px');
                $('.modal-body').css('overflow-y','auto');
                $('.modal-body').html(reportResults.form);

                //try to turn on multiselect
                try {
                    $('.multiselect').multiselect({
                        search: {
                            left: '<input type="text" name="q" class="form-control" placeholder="Search..." />',
                        }
                    });
                }catch(e){
                    //console.log(e.message);
                }
            }

            if (cachedForm){
                reloadForm();
                clearFormCookie();
            }
        });
    }
    $('#adminModal').modal('show', {backdrop: 'static', keyboard: true});
}

function GetList(listType, listTable, listHistory, dataTarget) {
    var showhistory = false;

    if (typeof listHistory == typeof undefined || listHistory.length == 0) {
        showhistory = false;
    } else {
        showhistory = listHistory;
    }

    $.isLoading(
        {
            text: "Loading User List...",
            'tpl': '<span class="isloading-wrapper %wrapper%"><img class="isloadingimage" src="' + root + '/images/loading_default.gif"><span class="isloadingwording">%text%</span></span>',
            position:   "overlay"
        }
    );

    $.post(root + "/src/manageData.aspx", {
        rtype: 'data',
        cmd: listType,
        table: listTable,
        template: '',
        history: showhistory
    }, function (reportResults) {
        $.isLoading("hide");
        if (reportResults.success == "false") {
            $('#adminModal').modal('hide');
            BootstrapDialog.alert({
                size: BootstrapDialog.SIZE_NORMAL,
                title: 'WARNING',
                message: reportResults.errors,
                type: BootstrapDialog.TYPE_WARNING, // <-- Default value is BootstrapDialog.TYPE_PRIMARY
                closable: true, // <-- Default value is false
                draggable: true, // <-- Default value is false
            });
        } else {
            if (!$.fn.DataTable.isDataTable(dataTarget)) {
                $(dataTarget).dataTable({
                    "data": reportResults.data,
                    "columns": reportResults.columns,
                    dom: 'Bfrtip',
                    "pageLength": 25,
                    buttons: [
                        'copy', 'excel', 'pdf'
                    ]
                });
            } else {
                var thisTable = $(dataTarget).DataTable();
                thisTable.clear();
                thisTable.rows.add(reportResults.data);
                thisTable.draw();
            }
        }
    }, 'json');
}