/*
 Copyright by Sven Diesslin - infoweb99.de
 Dieses Script darf auf einer Domain + Subdomains uneingeschränkt eingesetzt werden.
 Bitte Lizenzbedingungen beachte, und Ausgefüllt zurücksenden.
*/
var esel = new Object();
// ---------------------------------------------------------      ändern
esel.ad_url = escape('http://visitor.r20.constantcontact.com/manage/optin/ea?v=001pRmNkNNhb39f8-KqJG-fZw%3D%3D');              // add your domain
// ---------------------------------------------------------      ändern Ende
esel.small_path = '/barc/pagepeel/esel_s.swf';				//   ---------  change to url to file
esel.small_image = escape('/barc/pagepeel/image/pagecurl_sm.jpg');	        //   ---------  change to url to file
esel.big_path = '/barc/pagepeel/esel_b.swf';				//   ---------  change to url to file
esel.big_image = escape('/barc/pagepeel/image/pagecurl.jpg');		//   ---------  change to url to file
// Don't change anything below this line ------------------------------------------------------------------------------------------------------------------------------------------------------------
esel.small_width = '100';
esel.small_height = '100';
esel.small_params = 'ico=' + esel.small_image;
esel.big_width = '650';
esel.big_height = '650';
esel.big_params = 'big=' + esel.big_image + '&ad_url=' + esel.ad_url;
function sizeup987(){
	document.getElementById('eselcornerBig').style.top = '0px';
	document.getElementById('eselcornerSmall').style.top = '-1000px';
}
function sizedown987(){
	document.getElementById("eselcornerSmall").style.top = "0px";
	document.getElementById("eselcornerBig").style.top = "-1000px";
}
esel.putObjects = function () {
document.write('<div id="eselcornerSmall" style="position:absolute;width:'+ esel.small_width +'px;height:'+ esel.small_height +'px;z-index:9999;right:0px;top:0px;">');
document.write('<object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000"');
document.write('codebase="http://download.macromedia.com/pub/shockwave/cabs/flash/swflash.cab#version=7,0,19,0"');
document.write(' id="eselcornerSmallObject" width="'+esel.small_width+'" height="'+esel.small_height+'">');
document.write(' <param name="allowScriptAccess" value="always"/> ');
document.write(' <param name="movie" value="'+ esel.small_path +'?'+ esel.small_params +'"/>');
document.write(' <param name="wmode" value="transparent" />');
document.write(' <param name="quality" value="high" /> ');
document.write(' <param name="FlashVars" value="'+esel.small_params+'"/>');
document.write('<embed src="'+ esel.small_path + '?' + esel.small_params +'" name="eselcornerSmallObject" wmode="transparent" quality="high" width="'+ esel.small_width +'" height="'+ esel.small_height +'" flashvars="'+ esel.small_params +'" allowscriptaccess="always" type="application/x-shockwave-flash" pluginspage="http://www.macromedia.com/go/getflashplayer"></embed>');
document.write('</object></div></script>');
document.write('<div id="eselcornerBig" style="position:absolute;width:'+ esel.big_width +'px;height:'+ esel.big_height +'px;z-index:9999;right:0px;top:0px;">');
document.write('<object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000"');
document.write('codebase="http://download.macromedia.com/pub/shockwave/cabs/flash/swflash.cab#version=7,0,19,0"');
document.write(' id="eselcornerBigObject" width="'+ esel.big_width +'" height="'+ esel.big_height +'">');
document.write(' <param name="allowScriptAccess" value="always"/> ');
document.write(' <param name="movie" value="'+ esel.big_path +'?'+ esel.big_params +'"/>');
document.write(' <param name="wmode" value="transparent"/>');
document.write(' <param name="quality" value="high" /> ');
document.write(' <param name="FlashVars" value="'+ esel.big_params +'"/>');
document.write('<embed src="'+ esel.big_path + '?' + esel.big_params +'" id="eselcornerBigEmbed" name="eselcornerBigObject" wmode="transparent" quality="high" width="'+ esel.big_width +'" height="'+ esel.big_height +'" flashvars="'+ esel.big_params +'" swliveconnect="true" allowscriptaccess="always" type="application/x-shockwave-flash" pluginspage="http://www.macromedia.com/go/getflashplayer"></embed>');
document.write('</object></div>');
setTimeout('document.getElementById("eselcornerBig").style.top = "-1000px";',1000);
}
esel.putObjects();
