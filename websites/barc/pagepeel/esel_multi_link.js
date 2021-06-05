/*
 Das Copyright dieses Scriptes liegt beim Autor.
 Bitte die Lizenzbedingungen beachten, und ausgefüllt zurücksenden.
*/

image_small = new Array();
image_small[0]= 'URL_to/image/beispiel_s.gif';  //change to url to small1.gif
image_small[1]= 'URL_to/image/beispiel_s1.gif';  //change to url to small2.gif
          // When you want to use more images and links, just go on with this list:  image_small[2]=  and so on

image_big = new Array();
image_big[0]= 'URL_to/image/beispiel_b.gif';  //change to url to big1.gif 
image_big[1]= 'URL_to/image/beispiel_b1.gif';  //change to url to big2.gif
           // When you want to use more images and links, just go on with this list:  image_big[2]=  and so on

GoTo = new Array();
GoTo[0]= 'SiteURL1'; 	//Change to the URL you want to link to
GoTo[1]= 'SiteURL2';  	//Change to the URL you want to link to
				// When you want to use more images and links, just go on with this list: GoTo[2]=  and so on

var anzahl = 2   //Change to the number of used links

var nr = Math.round((anzahl -1) * Math.random());

var Link = GoTo[nr];
var Image1 = image_small[nr];
var Image2 = image_big[nr];

var esel = new Object();

esel.ad_url = escape(Link);

esel.small_path = 'URL_to/esel_s.swf'; //change to url to esel_s.swf
esel.small_image = escape(Image1);
esel.small_width = '100';
esel.small_height = '100';
esel.small_params = 'ico=' + esel.small_image;

esel.big_path = 'URL_to/esel_b.swf'; //change to url to  esel_b.swf
esel.big_image = escape(Image2);
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
// <eselSmall>
document.write('<div id="eselcornerSmall" style="position:absolute;width:'+ esel.small_width +'px;height:'+ esel.small_height +'px;z-index:9999;right:0px;top:0px;">');
// object
document.write('<object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000"');
document.write(' codebase="http://download.macromedia.com/pub/shockwave/cabs/flash/swflash.cab#version=7,0,19,0"');
document.write(' id="eselSmallcornerObject" width="'+esel.small_width+'" height="'+esel.small_height+'">');
// object params
document.write(' <param name="allowScriptAccess" value="always"/> ');
document.write(' <param name="movie" value="'+ esel.small_path +'?'+ esel.small_params +'"/>');
document.write(' <param name="wmode" value="transparent" />');
document.write(' <param name="quality" value="high" /> ');
document.write(' <param name="FlashVars" value="'+esel.small_params+'"/>');
// embed
document.write('<embed src="'+ esel.small_path + '?' + esel.small_params +'" name="eselcornerSmallObject" wmode="transparent" quality="high" width="'+ esel.small_width +'" height="'+ esel.small_height +'" flashvars="'+ esel.small_params +'" allowscriptaccess="always" type="application/x-shockwave-flash" pluginspage="http://www.macromedia.com/go/getflashplayer"></embed>');
document.write('</object></div>');
document.write('</script>');
// </eselSmall>
// <eselBig>
document.write('<div id="eselcornerBig" style="position:absolute;width:'+ esel.big_width +'px;height:'+ esel.big_height +'px;z-index:9999;right:0px;top:0px;">');
// object
document.write('<object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000"');
document.write(' codebase="http://download.macromedia.com/pub/shockwave/cabs/flash/swflash.cab#version=7,0,19,0"');
document.write(' id="eselcornerBigObject" width="'+ esel.big_width +'" height="'+ esel.big_height +'">');
// object params
document.write(' <param name="allowScriptAccess" value="always"/> ');
document.write(' <param name="movie" value="'+ esel.big_path +'?'+ esel.big_params +'"/>');
document.write(' <param name="wmode" value="transparent"/>');
document.write(' <param name="quality" value="high" /> ');
document.write(' <param name="FlashVars" value="'+ esel.big_params +'"/>');
// embed
document.write('<embed src="'+ esel.big_path + '?' + esel.big_params +'" id="eselcornerBigEmbed" name="eselcornerBigObject" wmode="transparent" quality="high" width="'+ esel.big_width +'" height="'+ esel.big_height +'" flashvars="'+ esel.big_params +'" swliveconnect="true" allowscriptaccess="always" type="application/x-shockwave-flash" pluginspage="http://www.macromedia.com/go/getflashplayer"></embed>');
document.write('</object></div>');
// </eselBig>
setTimeout('document.getElementById("eselcornerBig").style.top = "-1000px";',1000);
}
esel.putObjects();