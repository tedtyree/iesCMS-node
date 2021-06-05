var pageid="{{page}}";
var submenu="{{submenuname}}";
var nFlag="";     // Not highlighted or selected
var sFlag="-hs";   // Selected menu option
var hFlag="-hs";   // Highlighted menu option
var hsFlag="-hs"; // Highlighted and Selected


function initpage() {
	var i,img,itd,tdarray;

	if (submenu!="") { pageid=submenu.toLowerCase(); }
	else { pageid=pageid.toLowerCase(); }
	selectmnu();

	// PRELOAD ALL ROLLUNDER <TD> TAGS
	tdarray=document.getElementsByTagName('TD');
	for(i=0;i<tdarray.length;i++) {
	   itd=tdarray[i];
	   if(itd.id.substring(0,4).toLowerCase()=="btn_") {
		if (! itd.getAttribute("robase")) {getro(itd);}
		preloadimgs(itd.getAttribute("robase") + nFlag + itd.getAttribute("rosfx"), 
			itd.getAttribute("robase") + sFlag + itd.getAttribute("rosfx"),
			itd.getAttribute("robase") + hFlag + itd.getAttribute("rosfx"), 
			itd.getAttribute("robase") + hsFlag + itd.getAttribute("rosfx"));
	   }
	}

	// PRELOAD ALL ROLLOVER IMAGES
	for(i=0;i<document.images.length;i++) {
	   img=document.images[i];
	   if(img.id.substring(0,4).toLowerCase()=="btn_") {
		if (! img.getAttribute("robase")) {getro(img);}
		preloadimgs(img.getAttribute("robase") + nFlag + img.getAttribute("rosfx"), 
			img.getAttribute("robase") + sFlag + img.getAttribute("rosfx"),
			img.getAttribute("robase") + hFlag + img.getAttribute("rosfx"), 
			img.getAttribute("robase") + hsFlag + img.getAttribute("rosfx"));
	   }
	}

	selectmnu();

}

function preloadimgs() {
  var doc=document,j; 
  if(doc.images){
    if(!doc.imgss) doc.imgss=new Array();
    var i,ln=doc.imgss.length,k=preloadimgs.arguments; 
    for(i=0; i<k.length; i++) {
      doc.imgss[ln]=new Image; doc.imgss[ln++].src=k[i];}
  }
}

function selectmnu() {
   var sbtn;
   sbtn=document.getElementById("btn_" + pageid);
   if (sbtn) { rolloff(sbtn); }
}

function rollon(nthis) {
   var nsrc;
   if (! nthis.getAttribute("robase")) {getro(nthis);}
   if (nthis.getAttribute("roname")==pageid) {
	  nsrc=nthis.getAttribute("robase") + hsFlag + nthis.getAttribute("rosfx"); }
   else { nsrc=nthis.getAttribute("robase") + hFlag + nthis.getAttribute("rosfx"); }
   if ((nthis.tagName=="IMG")||(nthis.tagName=="INPUT")) { nthis.src=nsrc; }
   else { nthis.style.backgroundImage=nsrc; }
}

function rolloff(nthis) {
   var nsrc;
   if (! nthis.getAttribute("robase")) {getro(nthis);};
   if (nthis.getAttribute("roname")==pageid) {
	  nsrc=nthis.getAttribute("robase") + sFlag + nthis.getAttribute("rosfx"); }
   else { nsrc=nthis.getAttribute("robase") + nFlag + nthis.getAttribute("rosfx"); }
   if ((nthis.tagName=="IMG")||(nthis.tagName=="INPUT")) { nthis.src=nsrc; }
   else { nthis.style.backgroundImage=nsrc; }
}

function getro(nthis) {
   var p1,p2,p3,nm,flaglen,tid;
   if ((nthis.tagName=="IMG")||(nthis.tagName=="INPUT")) { nm=nthis.src + ""; }
   else { nm=nthis.style.backgroundImage + ""; }
   p1=nm.lastIndexOf("/");
   p2=nm.lastIndexOf(".");

   flaglen=-1;
   if (p1>0) { if (p2<p1) {p2=-1;} }
   if (p2>=0) {
	nthis.setAttribute("rosfx", nm.substring(p2));
	nm=nm.substring(0,p2);
	}
   else { nthis.setAttribute("rosfx", ""); }

   nm=rmflag(nm,nFlag); 
   nm=rmflag(nm,sFlag); 
   nm=rmflag(nm,hFlag); 
   nm=rmflag(nm,hsFlag);

   tid=nthis.id;
   if (tid.substring(0,4).toLowerCase()=="btn_") {tid=tid.substring(4);}
   nthis.setAttribute("roname", tid.toLowerCase());
   
   nthis.setAttribute("robase", nm);
}

function rmflag(rostring,roflag) {
	var s,l1,l2;

	s=rostring;
	if (s="") {return rostring;}
	l1=s.length;
	l2=roflag.length;
	if (l1<l2) {return rostring;}
	
	if (rostring.substring(l1-l2)==roflag) {return rostring.substring(0,l1-l2);}
	return rostring;
}

// *** Swap main image - use name provided in timg (just before the .gif or .jpg suffix)
function changenow(tLnk) {
	var eChg;
	rollon(tLnk);
	eChg=document.getElementById("changeimg");
	if(!eChg.src2) {eChg.setAttribute("src2",eChg.src);}
	eChg.src=tLnk.getAttribute("src2");
}

function unchange(tLnk) {
	var eChg;
	rolloff(tLnk);
	eChg=document.getElementById("changeimg");
	eChg.src=eChg.getAttribute("src2");
}

function preload_changenow() {
	var i,lnk;

	// PRELOAD ALL ROLLOVER IMAGES
	for(i=0;i<document.images.length;i++) {
	   lnk=document.images[i];
	   if(lnk.id.substring(0,7).toLowerCase()=="btn_chg") {
		preloadimgs(lnk.getAttribute("src2"));
	   }
	}
}


function GotoPage(sURL) {
	window.location.href=sURL;
}


var foto1;

function pfoto(img){
  foto1= new Image();
  foto1.src=(img);
  Controlla(img);
}
function Controlla(img){
  if((foto1.width!=0)&&(foto1.height!=0)){
    ppup(img,foto1.width+20,foto1.height+20);
  }
  else{
    funzione="Controlla('"+img+"')";
    intervallo=setTimeout(funzione,20);
  }
}

// ppup(url[,width[,height]])
function ppup(url){
	var pp, k, x1, x2, t;
	k=ppup.arguments;
	x1=500;
	x2=550;
	if(k.length>1) {x1=k[1];}
	if(k.length>2) {x2=k[2];}
	pp=window.open(url,'ppupwindow',
	  'menubar=no,status=no,width='+x1+',height='+x2+',toolbar=no,scrollbars=yes,location=no,directories=no,resizable=yes');
	pp.moveTo((screen.width-x1)/2,(screen.height-x2)/2);
	pp.focus();
}

