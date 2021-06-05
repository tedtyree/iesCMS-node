var BannerCount, BannerCurrent, BannerTimer=-1, ControlTimer=-1, PauseMode, Pause2, ControlsVisible, CntrlTop, CntrlLeft;
var TimerDelay=4000;
$(document).ready(function(){
	$.get("/sde/mainbannerimages2.ashx?contentonly=true",
		function(data) { ReturnBanners(data); });
		
});

function ReturnBanners(sData) {
 var s,p;
 BannerCount=0;
 s='<div id="bannercontrols" style="z-index:3;position:absolute;visibility:hidden;"><table border=0 cellpadding=0 cellspacing=0 style="width:280px;"><tr><td align="left"><img border=0 onClick="PrevBanner();" src="/sde/images/btnPREV.gif"></td><td align="center"><img id="autobutton0" border=0 onClick="TogglePause();" src="/sde/images/btnPLAY0.gif"><img id="autobutton1" border=0 onClick="TogglePause();" src="/sde/images/btnPLAY1.gif" style="visibility:hidden;"></td><td align="right"><img border=0 onClick="NextBanner();" src="/sde/images/btnNEXT.gif"></td></tr></table></div>';
 $(sData).find('tr').each(function (i) { 
   s=s+'<div id="rollingbanner' + i + '" class="rollingbanner" style="width:962px;height:261px;overflow:hidden;display:none;visibility:hidden;position:absolute;z-index:1;"><table border=0 cellspacing=0 cellpadding=0 ><col><tr>';
   $(this).find('td').each(function (j) {
	 if(j==0) {s=s + '<td align=center valign=top>' + $(this).html(); }
	 else {s=s + '<td align=left valign=top>' + $(this).html(); }
	 });
	s=s + '</tr></table></div>';
	BannerCount++;
	});
$('#rollingbanners').html(s);
BannerCurrent=0;
$('#bannercontrols').css("visibility","visible")
$('#bannercontrols').show();
p=$('#bannercontrols').offset(); CntrlTop=p.top+140; CntrlLeft=p.left+20;
$('#bannercontrols').hide();
$('#controltrigger').position({top:0,left:0});
$('#rollingbanner' + BannerCurrent).css("visibility","visible");
$('#rollingbanner' + BannerCurrent).fadeIn(600);
BannerTimer = setTimeout("NextBanner2();",TimerDelay);
PauseMode=0;
Pause2=0;
$('#autobutton0').show();
$('#autobutton1').hide();
ControlsVisible=false;
$('#rollingbanners').hover( function() { OverBanner(); }, function() { OffBanner(); });
}

function TogglePause() {
	var other;
	var evv;
	if (Pause2==1) { Pause2=0; other=1;}
	else { Pause2=1; other=0;}
	//$('#bannercontrols').show();
	//$('#autobutton').show();
	//alert('pause2' + Pause2);
	//evv=document.getElementById('autobutton');
	//if (evv) { alert(evv.src); evv.src="/admin/images/btnauto" + Pause2 + ".gif"; evv.setAttribute("src","/admin/images/btnauto" + Pause2 + ".gif"); alert(evv.src);}
	//$('#autobutton').attr("src","/admin/images/btnauto" + Pause2 + ".gif");
	//$('#bannercontrols').fadeTo(0,0.7); 
	$('#autobutton' + Pause2).css("visibility","visible");
	$('#autobutton' + Pause2).show();
	$('#autobutton' + other).hide();
}

function AutoNext() {
	if (PauseMode==1) { return; }
	NextBanner2(1);
}

function PrevBanner() {
	NextBanner2(-1,100,true);
}

function NextBanner() {
	NextBanner2(1,100,true);
}

function NextBanner2(iinc,speed,foverride) {
  if (BannerTimer>=0) {clearTimeout(BannerTimer); BannerTimer=-1;}
  foverride = typeof(foverride) != 'undefined' ? foverride : false;
  speed = typeof(speed) != 'undefined' ? speed : 600;
  iinc = typeof(iinc) != 'undefined' ? iinc : 1;
  if ((PauseMode==1 || Pause2==1) && foverride==false) { return; }
  $('#rollingbanner' + BannerCurrent).fadeOut(speed, function() {
		// To solve a FireFox glitch, we hide all images...
		var k;
		for (k=0;k<BannerCount;k++) {$('#rollingbanner' + k).hide();}
		BannerCurrent+=iinc;
		if (BannerCurrent>=BannerCount) { BannerCurrent=0; }
		if (BannerCurrent<0) { BannerCurrent=BannerCount-1; }
		$('#rollingbanner' + BannerCurrent).css("visibility","visible").position({top:0,left:0});
		$('#rollingbanner' + BannerCurrent).fadeIn(speed, function() {
			var j;
			// To solve a FireFox glitch, we hide all other images again...
			for (j=0;j<BannerCount;j++) { if (j!=BannerCurrent) {$('#rollingbanner' + j).css("visibility","hidden").css("display","none");}}
			if(foverride==false) { BannerTimer = setTimeout("NextBanner2();",TimerDelay); }
			});
  });
}

function OverBanner() {  
	if (ControlTimer>=0) {clearTimeout(ControlTimer); ControlTimer=-1;}
	if (BannerTimer>=0) {clearTimeout(BannerTimer); BannerTimer=-1;}
	if(ControlsVisible==true) {return;}
	PauseMode=1;
	ControlsVisible=true; 
	$('#bannercontrols').show();
	$('#bannercontrols').offset({top:CntrlTop,left:CntrlLeft}); 
	$('#bannercontrols').css({'z-index':7}); 
	$('#bannercontrols').hide();
	$('#bannercontrols').fadeTo(100,0.7); 
}

function OffBanner() { 
	ControlTimer=setTimeout("HideControls();",300);
}

function HideControls() {
	if(ControlsVisible==false) {return;}
	ControlsVisible=false;
	$('#bannercontrols').fadeOut(100);
	PauseMode=0;
	BannerTimer = setTimeout("NextBanner2();",TimerDelay);
}
