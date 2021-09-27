var PauseTimer=false, TimerID=-1;
var TimerSpeed=6;  // *** Slides progress every 6 seconds

$(document).ready(function(){
	photoRequest();
	if(mode=="auto") {SetFilterTimer();}
});


function SetFilterTimer() {
	// Set timer to check the filter value every # seconds ...
	ResetFilterTimer();
	TimerID = setTimeout("ProcessTimer();",TimerSpeed * 1000);
   }

function ResetFilterTimer() {
	// Reset timer
	if (TimerID != -1) {
		// Clear Timer
		clearInterval(TimerID);
		TimerID=-1;
	}
   }

function ProcessTimer() {
	TimerID=-1; // Timer is a one-time event.
	// Every # seconds, move to the next slide
	gotopage(1,0);
}

function gotopage(pginc,flipmode) {
	ImgCurrent=ImgCurrent+pginc;
	if (ImgCurrent > ImgCount) {ImgCurrent=1;}
	if (ImgCurrent < 1) {ImgCurrent=ImgCount;}
	if (flipmode==1) { 
		var vbtn,p;
		vbtn=document.getElementById("gb_pause");
		
		if (vbtn) { if (vbtn.src) { 
			p=(vbtn.src + "").lastIndexOf("/");

			if (p<0) { vbtn.src="/admin/images/btn" + mode + ".gif" }

			else { 
				//alert(vbtn.src + "");
				vbtn.src=(vbtn.src + "").substring(0,p+1) + "btn" + mode + ".gif"
				//alert(vbtn.src + "");
				}
		}}
		if (mode=="auto") {mode="pause";} else {mode="auto";}
		}
	if (mode=="auto") {SetFilterTimer();} else {ResetFilterTimer();}


	if ( photoRequest() ) {
		// AJAX worked... do NOT continue with normal navigation
		return false;
		}
	// AJAX failed... continue with normal HRef navigation
	return true;

}

function gotonum(pgnum) {
	ImgCurrent=pgnum;
	return gotopage(0,0);
}
function photoRequest() {
	var phid;
	phid=$('#photohref'+ImgCurrent).attr("href");
	if (phid) { phid=getVar(phid,"photo"); }
	//alert("/" + world + "/ShowPhoto.ashx?Gallery=" + Gallery + "&img=" + ImgCurrent + "&photo=" + phid + "&mode=" + mode + "&ContentOnly=true");
	return makeRequest("/" + world + "/ShowPhoto.ashx?Gallery=" + Gallery + "&img=" + ImgCurrent + "&photo=" + phid + "&mode=" + mode + "&ContentOnly=true");
}

function makeRequest(url) {
    $.get(url,
		function(data) { ReturnPhoto(data); });
	return true;  // RETURN SUCCESS
    }

function ReturnPhoto(sData) {
	$('#content_area').html(sData);
}

function getVars(sURL) {
	var vars = [], hash;
    var hashes = sURL.slice(sURL.indexOf('?') + 1).split('&');
    for(var i = 0; i < hashes.length; i++)
    {
      hash = hashes[i].split('=');
      vars.push(hash[0]);
      vars[hash[0]] = hash[1];
    }
    return vars;
  }
  
function getVar(sURL,sParam) {
    return getVars(sURL)[sParam];
  }
