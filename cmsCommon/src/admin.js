$(document).ready(function () {



	// Hide ADMIN-LOGO image if it is a broken link
	imgsrc = $('img.admin-logo').attr("src");
	$('img.admin-logo').on("error", hideErrorImage).attr("src", imgsrc); // reload image and trap error

	$(".datepicker").datepicker();  // Attaching the datepicker widget from JQuery UI to all text fields with class datepicker

	$('body').delegate('.datepicker', 'focus', function () {
		$(this).datepicker({ showOn: 'focus' });
	});

	$('body').delegate('.cleardate', 'click', function (e) {
		e.preventDefault();
		var textBox = $(this).attr('id');
		$('#' + textBox).val('');
		return false;
	});

	$('body').delegate('.autofill', 'click', function (e) {
		var inputField = $(this).attr('configname');
		var cfgTable = $(this).attr('table');
		var cfgField = $(this).attr('field');
		var cfgType = $(this).attr('type');
		var cfgSubfield = $(this).attr('subfield');

		if (!cfgSubfield) {
			cfgSubfield = '';
		}

		var selectedItem = "";
		var newDiv;
		//we should do a post which will try to load our config and give them a selection box
		$.post("admin_autofill_populate.ashx", { "table": cfgTable, "field": cfgField, "type": cfgType, "subfield": cfgSubfield }, function (results) {
			newDiv = $(document.createElement('div'));
			var myButtons = "";

			//we need to fix the special characters in the config name
			inputField = inputField.replace(".", '\\.');
			if (results.success == "true") {
				newDiv.attr('title', 'Select One');
				newDiv.html(results.data);
				myButtons = {
					"Select": function () {
						if (selectedItem) {
							$('input#' + inputField).val(selectedItem);
							$(this).dialog("close");
							$(this).dialog("destroy").remove();
						}
					},
					"Cancel": function () {
						$(this).dialog("close");
						$(this).dialog("destroy").remove();
					}
				};
			} else {
				newDiv.attr('title', 'Sorry');
				newDiv.html("No Choices to Display");
				myButtons = {
					"Cancel": function () {
						$(this).dialog("close");
						$(this).dialog("destroy").remove();
					}
				};
			}
			newDiv.dialog({
				'buttons': myButtons
			});
			$('#autofill_list').selectable({
				stop: function () {
					$(".ui-selected", this).each(function () {
						selectedItem = $(this).html();
					});
				}
			});
		}, "json");

		return false;
	});

});

function hideErrorImage() {
	$(this).hide();
}

function rollon(nthis) {
	nthis.setAttribute("className", "admnu2");
	nthis.setAttribute("class", "admnu2");
}
function rolloff(nthis) {
	nthis.setAttribute("className", "admnu1");
	nthis.setAttribute("class", "admnu1");
}
function gotopage(sURL) {  //second parameter is optional: boolean true=open in new window, false=open in same window
	var opentype = "";
	if (arguments.length > 1) { if (arguments[1] == true) { opentype = "w"; } }
	if (opentype == "w") { window.open(sURL); }
	else { window.location = sURL; }
}

function downloadFile(filePath) {
	var link = document.createElement('a');
	link.href = filePath;
	link.download = filePath.substr(filePath.lastIndexOf('/') + 1);
	link.click();
}


