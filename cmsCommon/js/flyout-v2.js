//************************************** FLYOUT MENUS v2 (jquery)
var ddOverlap=5;vSpacer=4;
var shiftRight,shiftDown;

function hRollOn(nthis) {  // hRollOn(this,menu-id,direction) menu flys out below (horizontal menu)
   var k;
   shiftRight=0;
   shiftDown=$(nthis).height() + vSpacer;
   k=hRollOn.arguments;
   if (k.length>=2) { if (k[1].length>=1) {drawmenu(nthis,k[1],4);}}
  }
  
function vRollOn(nthis) {  // RollOn(this,menu-id,direction) menu flys out to the right (vertical menu)
   var k;
   shiftRight=$(nthis).width() - ddOverlap;
   shiftDown=0;
   k=vRollOn.arguments;
   if (k.length>=2) { if (k[1].length>=1) {drawmenu(nthis,k[1],3);}}
  }
  
function RollOff() {
   MenuTimer();
  }

function SubRollOn(nthis) {
   var k;
   // Move the submenu to the right of the parent menu
   shiftRight=$(nthis).width() - ddOverlap;
   shiftDown=0;
   k=SubRollOn.arguments;
   if (k.length>=2) { if (k[1].length>=1) {drawmenu(nthis,k[1],1);}}
}

function SubKeepOn(nthis) {
   ResetMenuTimer(); // just keep from closing stuff
}

function SubRollOff() {
   MenuTimer();
}

function drawmenu(dmenu,id,newFlag) {
var vpos,vleft,id2,id3,lng1,z;

ResetMenuTimer();
vpos=0;
vleft=0;
vpos=$(dmenu).offset().top + shiftDown;
vleft=$(dmenu).offset().left + shiftRight;
lng1=String(id).length;
z=10;
$("dl.smenu1").each( function(i) {
		 id2=""
		 id2=$(this).attr('id');
		 z=z+2;
		 if (id2 == id) { if($(this).is(":visible") == false) { 
			id3=id.replace('.','\\.');
			$('#' + id3 + 'b').stop(true,true);
			$('#' + id3 + 'b').fadeIn(200); // $('#' + id + 'b').fadeTo(200,0.7);
			$('#' + id3 + 'b').css('zIndex',z);
			$('#' + id3 + 'b').offset({top:vpos,left:vleft}); 
			$('#' + id3 + 'b').width($(this).width()); 
			$('#' + id3 + 'b').height($(this).height()); 
			$('#' + id3 + 'b').attr('class','smenu1b');
			$(this).stop(true,true);
			$(this).fadeIn(200); // $(this).fadeTo(200,1);
			$(this).css('zIndex',z+1);
			$(this).offset({top:vpos,left:vleft});
			} } // *** if (d.id == id)
		 else {
		  match=false;
		  if (lng1>0) {
		    var s1,s2;
		    //*** Check if this menu is a parent *or child* (left part matches) - if so, don't make it dissappear
		    lng=id2.length;
		    if (lng>0) {
			s1="" + String(id).substring(0,lng);
			s2="" + id2.substring(0,lng);
			// *** If the first part of the strings do not match make menu dissapear.
			id3=id2.replace('.','\\.');
		  	if (s1 != s2) { if($(this).is(":visible") == true) { 
				$(this).stop(true,true);
				$(this).fadeOut(200); 
				$('#' + id3 + 'b').stop(true,true);
				$('#' + id3 + 'b').fadeOut(200); } }
			else { if($(this).is(":visible") == false) { 
				$('#' + id3 + 'b').stop(true,true);
				$('#' + id3 + 'b').fadeIn(200); // $('#' + id2 + 'b').fadeTo(200,0.7);
				$('#' + id3 + 'b').css('zIndex',z);
				$(this).stop(true,true);
				$(this).fadeIn(200); // $(this).fadeTo(200,1);
				$(this).css('zIndex',z+1);
				} }
			} // *** if (lng>0) 
		     } // *** if (lng1>0)

		  } // else (d.attr('id') == id)
	}); // *** each()
}

var TimerID=-1;

function MenuTimer() {
	// Set timer to check the filter value every .5 seconds ...
	ResetMenuTimer();
	TimerID = setInterval("CloseMenus();",500);
   }

function ResetMenuTimer() {
	// Reset timer
	if (TimerID != -1) {
		// Clear Timer
		clearInterval(TimerID);
	}
   }

function CloseMenus() {
	var id;

	ResetMenuTimer();

	$("#smenus > dl:visible").each( function(i) {
		id=$(this).attr('id');
		$('#' + id + 'b').stop(true,true);
		$('#' + id + 'b').fadeOut(200);
		$(this).stop(true,true);
		$(this).fadeOut(200);
	  }); // *** each
	}