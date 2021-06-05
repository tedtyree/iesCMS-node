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
	var pp, k, x1, y1, t;
	k=ppup.arguments;
	x1=500;
	y1=550;
	if(k.length>1) {x1=k[1];}
	if(k.length>2) {y1=k[2];}
	pp=window.open(url,'ppupwindow',
	  'menubar=no,status=no,width='+x1+',height='+y1+',toolbar=no,scrollbars=yes,location=no,directories=no,resizable=yes');
	pp.moveTo((screen.width-x1)/2,(screen.height-y1)/2);
	pp.focus();
}