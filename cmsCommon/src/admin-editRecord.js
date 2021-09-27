var currentTab="";
var returnToTab="";
var configByRow=null;
var pageDirty=false;

$(document).ready(function(){
	
	CreateTabs();
	
	var firstTab=Object.keys(cfgClass.tabs)[0]; // returns first tab 'key'
	SetTab(firstTab);
});

function CreateTabs() {
	var block="";
	block += '<div class="TabMenu"><ul class="tablist">';
	for (var oKey in cfgClass.tabs) {
		block += '<li id="tab_' + oKey + '"><a href="#" onclick=\'SetTab("' + oKey + '");return false;\'>' + cfgClass.tabs[oKey].title + '</a></li>';
	}
	block += "</ul></div>";
	$('#EditArea').append(block);
}

function SetTab(newTab) {
	// Close current tab (if needed) - this first reads the data that may have been changed
	ReadChanges();
	$('#EditPane').remove(); // last step of above "close" - remove previous EditPane
	currentTab="";
	
	if (newTab=="") { return; }
	
	// ParseConfig if needed  (Note: for "Source" tab we do not need to parse)
	if (newTab.toLowerCase()!="source") {
		if (!configByRow) { ParseConfig(); }
	}
	
	// Setup the new tab
	var block="";
	block+="<div id='EditPane' style='width:95%; background:#E0E0FF; margin-top:6px; padding:12px;'></div>";
	$('#EditArea').append(block);
	
	var fields=cfgClass["tab_" + newTab];
	for (var f in fields) {
		var fld=fields[f];
		if (fld.type.toLowerCase()=="text") {
			block=fld.title + ":";
			var id="fld_" + fld.id;
			block+=" <input type='text' id='" + id + "' value='' style='width:" + fld.width + ";'><br><br>";
			$('#EditPane').append(block);
			$('#' + id).val(getParam(fld.id));
		}
		if (fld.type.toLowerCase()=="textarea") {
			block=fld.title + ":";
			var id="fld_" + fld.id;
			block+=" <textarea id='" + id + "' style=\"width:" + fld.width + ";height:" + fld.height + ";vertical-align: top;\"></textarea><br><br>";
			$('#EditPane').append(block);
			$('#' + id).val(getParam(fld.id));
		}
		if (fld.type.toLowerCase()=="source") {
			block=fld.title + ":";
			var id="fld_" + fld.id;
			block+=" <textarea id='" + id + "' style=\"width:" + fld.width + ";height:" + fld.height + ";vertical-align: top;\"></textarea><br><br>";
			$('#EditPane').append(block);
			$('#' + id).val(cfgData);
		}
		if (fld.type.toLowerCase()=="readonlyinfo") {
			block="<div style='width:" + fld.width + ";'>" + fld.title + ":";
			block+=" " + getParam(fld.id);
			block+="</div><br><br>";
			$('#EditPane').append(block);
		}
		if (fld.type.toLowerCase()=="readonlytext") {
			block="<div style='width:" + fld.width + ";'>" + fld.text;
			block+="</div><br><br>";
			$('#EditPane').append(block);
		}
		if (fld.type.toLowerCase()=="grid") {
			// Table/Grid of columns - each containing a set of data from an array
			var id="fld_" + fld.id;
			var maxCols=0;
			block="<table id='" + id + "'><thead><tr>";
			var titles=fld.title;
			var arrays=fld.array;
			var width=fld.width;
			arrayGrid=[];
			for (var i=0;i<arrays.length;i++) {
				block+="<th>" + titles[i] + "</th>";
				var a=getParam(arrays[i]);
				if (a.length > maxCols) { maxCols=a.length; }
				arrayGrid.push(a);
			}
			block+="</tr></thead><tbody>";
			for (var k=0;k<maxCols;k++) {
				block += "<tr>";
				for (var i=0;i<arrays.length;i++) {
					var id2=id + "_" +  k + "_" + i;
					block+="<td><input type='text' id='" + id2 + "' value='' style='width:" + width[i] + ";'></td>";
				}
				block +="</tr>";
			}
			block += "</tbody></table>";
			$('#EditPane').append(block);
			// Fill the grid with values...
			for (var k=0;k<maxCols;k++) {
				for (var i=0;i<arrays.length;i++) {
					var id2=id + "_" +  k + "_" + i;
					var v=getParam(arrays[i]);
					$('#'+id2).val(v[k]);
				}
			}
		}
	}
	
	//$('#EditPane').append(document.createTextNode(JSON.stringify(configByRow)));  // DEBUG
	
	// Setup trigger to know if the page/form is dirty
	$('#EditPane input').change(function() { pageDirty = true; });
	$('#EditPane textarea').change(function() { pageDirty = true; });

	// Indicate the tab that is selected
	$('.TabMenu ul li').removeClass("TabSelectedStyle");
	$('#tab_' + newTab).addClass("TabSelectedStyle");
	currentTab=newTab;
}

// NOTE: Source tab should not have other fields or they will conflict with one another
function ReadChanges() {
	if (currentTab=="") {return;}
	
	var fieldsDirty=false;
	var fields=cfgClass["tab_" + currentTab];
	for (var f in fields) {
		var fld=fields[f];
		if ((fld.type.toLowerCase()=="text") || (fld.type.toLowerCase()=="textarea")) {
			fieldsDirty=true;
			var id="fld_" + fld.id;
			var v=$('#'+id).val();
			setParam(fld.id,v);
		}
		if (fld.type.toLowerCase()=="grid") {
			fieldsDirty=true;
			var maxCols=0;
			var id="fld_" + fld.id;
			var arrays=fld.array;
			arrayGrid=[];
			for (var i=0;i<arrays.length;i++) {
				var a=getParam(arrays[i]);
				if (a.length > maxCols) { maxCols=a.length; }
				arrayGrid.push(a);
			}
			for (var i=0;i<arrays.length;i++) {
				var v=[];
				for (var k=0;k<maxCols;k++) {
					var id2=id + "_" +  k + "_" + i;
					v.push( $('#'+id2).val() );
				}
				setParam(arrays[i],v);
			}
		}
		if (fld.type.toLowerCase()=="source") {
			// This is a special case where the textarea contains the SOURCE CODE for the entire config file
			var id="fld_" + fld.id;
			var v=$('#'+id).val();
			cfgData=v;
			ParseConfig();
			fieldsDirty=false;
		}
	}
	if (fieldsDirty) {
		// Rebuild cfgData from the configByRow
		cfgData="";
		for (var idxRow in configByRow) {
			if (cfgData!="") { cfgData+="\n"; }
			var row=configByRow[idxRow];
			if (row.type=="param") {
				if (row.multi!="true") {
					// normal param
					cfgData+=row.prefix + row.key + ":" + JSON.stringify(row.value) + row.suffix;
				} else {
					// multi row array
					cfgData+=row.prefix + row.key + ":[\n";
					for (var k=0;k<row.value.length;k++) {
						cfgData+="     " + ((k>0)?",":"");
						cfgData+=JSON.stringify(row.value[k]) + "\n";
					}
					cfgData+="     ]" + row.suffix;
				}
			} else {
				// comment or error row
				cfgData+=row.prefix + row.value + row.suffix;
			}
		}
	}
}

function ParseConfig() {
	var allRows=cfgData.replace(/(?:\r\n|\r|\n)/g, '|');; // handles NewLine characters from multiple operating systems
	var cRow=0, errCount=0, errRow=0;
	var mode=""; // "["=inside multirow array
	var multiRow="", multiPrefix="";
	var eachRow=allRows.split("|");
	configByRow=[];
	for (var eRow in eachRow) {
		cRow++;
		var pRow={type:"",prefix:"",suffix:"",key:"",value:"",multi:""};
		var rowStr=eachRow[eRow].trim();
		
		// remove bracket in front or at end
		if (rowStr.substring(0,1)=="{") {
					pRow.prefix+="{";
					rowStr=rowStr.substring(1).trim();
			}
			if (rowStr.slice(-1)=="}") {
					pRow.suffix="}" + pRow.suffix;
					rowStr=rowStr.slice(0,-1).trim();
			}
			
		if ((rowStr.substring(0,2)=="//") || (rowStr=="")) {
			// comment row or blank row
			pRow.value=rowStr;
			pRow.type="comment";
		} else {
			// This should be a data row
			// first remove comma in front or at end
			if (rowStr.substring(0,1)==",") {
					pRow.prefix+=",";
					rowStr=rowStr.substring(1).trim();
			}
			if (rowStr.slice(-1)==",") {
					pRow.suffix="," + pRow.suffix;
					rowStr=rowStr.slice(0,-1).trim();
			}
			if (rowStr.slice(-1)=="[") {
					// do not need to store this suffix
					mode="["; // start of multirow array (each string on its own line)
					multiRow=rowStr; 
					multiPrefix=pRow.prefix;
					rowStr="";
					pRow.prefix="";
			}
			if (mode=="[") {
				// collect all the lines into one string
				multiRow+=pRow.prefix + rowStr;
				
				if (rowStr.slice(-1)=="]") {
					mode=""; // start of multirow array (each string on its own line)
					rowStr=multiRow; // This gets processed below
					pRow.prefix=multiPrefix;
					pRow.multi="true";
				}
			}
			if (mode=="") { 
				// Should be key:value in JSON format - here we cheat and use JSON to read it
				// if we do not have quotes around the "key", we need to add them
				try {
					var jstr=rowStr;
					if (jstr.substring(0,1)!="\"") {
						jstr="\"" + jstr.replace(":","\":");  // replace only affects first occurance of ":"
					}
					jstr="{" + jstr + "}";
					var j=JSON.parse(jstr);
					pRow.key=Object.keys(j)[0]; // Get KEY from first item
					pRow.value=j[pRow.key]; // Get VALUE from first item
					pRow.type="param";
				} catch (e) {
					// The above failed, so lets just store the row as an error
					pRow={type:"",prefix:"",suffix:"",key:"",value:""};
					pRow.value=eachRow[eRow];
					pRow.type="error";
					errCount++;
					if (errRow==0) { errRow=cRow; }
				}
			}
		}
		if (mode=="") { configByRow.push(pRow); }
	}
	if (errRow>0) {
		alert("Encountered " + errCount + " error(s) in the Config file format: First error on line " + errRow);
	}
}

function getParam(key) {
	for (var row in configByRow) {
		if (configByRow[row].type=="param") {
			if (configByRow[row].key.toLowerCase()==key.toLowerCase()) {
				return configByRow[row].value;
			}
		}
	}
	return "";
}

function setParam(key,newValue) {
	for (var row in configByRow) {
		if (configByRow[row].key.toLowerCase()==key.toLowerCase()) {
			configByRow[row].value = newValue;
		}
	}
}

function btnSave(closeAfter) {
	returnToTab=currentTab;
	
	SetTab("");  // This forces the data to be read from the form and fields to be removed from site.
	
	// Indicate that we are saving changes
	var block="";
	block+="<div id='EditPane' style='width:95%; height:200px; background:#E0E0FF; margin-top:6px; padding:12px;'><br><br><B>Saving data...</B><br><br><br></div>";
	$('#EditArea').append(block);
	
	// Send cfgData to the backend
	var retData={"cfgData":cfgData};
	$.ajax({
				url: "admin-saveConfig.ashx?ContentOnly=True&class=" + editClass + "&file=" + editFile,
				type: 'POST',
				data: retData,
				dataType: 'text',
				timeout: 9999,
				success: function(ret){ 
					if (ret.trim()=="success") { 
						pageDirty=false;
						if (closeAfter==true) { window.close(); return;} 
						SetTab(returnToTab);
						return;
					} 
					// unsuccessful - do not close form
					alert('ERROR: Failed to save form. [err3883]\n' + ret);
					SetTab(returnToTab);
				}, 
				error: function(jqXHR, status, error){
					alert('ERROR: Failed to save form. [err4377]\n' + error);
					SetTab(returnToTab);
				}
			});
}

function btnClose() {
	if (pageDirty) { if (confirm("Close edit window without saving changes?")==false) { return; } }
	window.close();
}