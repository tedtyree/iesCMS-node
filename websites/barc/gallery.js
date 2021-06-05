
var PauseTimer=false, TimerID=-1;
var mode="{{GalleryMode}}";
var TimerSpeed=6;  // *** Slides progress every 6 seconds
var ImgCurrent={{ImgCurrent}};
var ImgCount={{GalleryCount}};

function SetFilterTimer() {
	// Set timer to check the filter value every # seconds ...
	ResetFilterTimer();
	TimerID = setInterval("ProcessTimer();",(TimerSpeed * 1000));
   }

function ResetFilterTimer() {
	// Reset timer
	if (TimerID != -1) {
		// Clear Timer
		clearInterval(TimerID);
	}
   }

function ProcessTimer() {
	// Every # seconds, move to the next slide
	gotopage(1,0);

}

function initpage2() {
	if(mode=="auto") {SetFilterTimer();}
}

function gotopage(pginc,flipmode) {

	ImgCurrent=ImgCurrent+pginc;
	if (ImgCurrent > ImgCount) {ImgCurrent=1;}
	if (ImgCurrent < 1) {ImgCurrent=ImgCount;}
	if (flipmode==1) { 
		var vbtn;
		vbtn=document.getElementById("gb_pause");
		if (vbtn) { if (vbtn.src) { vbtn.src="/{{world}}/images/btn" + mode + ".gif" }}

		if (mode=="auto") {mode="pause";} else {mode="auto";}
		}
	if (mode=="auto") {SetFilterTimer();} else {ResetFilterTimer();}


	if (makeRequest("/{{world}}/default.aspx?page=Gallery&Gallery={{Gallery}}&img=" + ImgCurrent + "&mode=" + mode + "&ContentOnly=true") ) {
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

function makeRequest(url) {
        var httpRequest, url2;

        if (window.XMLHttpRequest) { // Mozilla, Safari, ...
            httpRequest = new XMLHttpRequest();
            if (httpRequest.overrideMimeType) {
                httpRequest.overrideMimeType('text/xml');
                // See note below about this line
            }
        } 
        else if (window.ActiveXObject) { // IE
            try {
                httpRequest = new ActiveXObject("Msxml2.XMLHTTP");
                } 
                catch (e) {
                           try {
                                httpRequest = new ActiveXObject("Microsoft.XMLHTTP");
                               } 
                             catch (e) { return false; }
                          }
                                       }

        if (!httpRequest) {
            //alert('Giving up :( Cannot create an XMLHTTP instance');
            return false;  // RETURN FAILED
        }
	try {
	  url2=url+"&timestamp=" + new Date().getTime();  // forces AJAX to get a fresh page (not a cached page) each time!

          httpRequest.onreadystatechange = function() { alertContents(httpRequest); };
          httpRequest.open('GET', url2, true);
          httpRequest.send(null);
	  }
	  catch (e) { return false; }

	return true;  // RETURN SUCCESS

    }

function alertContents(httpRequest) {
	var vcontent;
        if (httpRequest.readyState == 4) {
            if (httpRequest.status == 200) {
                //alert(httpRequest.responseText);

		vcontent=document.getElementById("content_area");
		if (vcontent) { if (vcontent.innerHTML) { vcontent.innerHTML=httpRequest.responseText; }}

            } 
		// else { alert('There was a problem with the request.'); }
        }

    }
	
