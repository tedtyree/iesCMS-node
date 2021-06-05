function validate() {
	var args,k,e,flags,msg,v;
	msg="";
	args=validate.arguments;
	for (k=0; k<(args.length-1); k+=2) {
	  e=document.getElementsByName(args[k])[0];
	  if (e) {
	    flags=args[k+1];
	    if (flags.charAt(0) == 'r') {
	      v=e.value + "";v=v.replace(/^\s+/, '');
	      if (v=="") { msg+=" * " + e.getAttribute("Name") + " is required.\n"; }
	}
		if (flags.charAt(0) == 'c') {
	      v=e.checked;
	      if (v!=1) { msg+=" * Must agree to and check off " + e.getAttribute("Name").replace('_checkbox','') + ".\n"; }
	}}}
	if (msg!="") { alert("Please note:\n" + msg + "\nForm was not submitted.\nPlease fix these requirements.\n"); 
		return false;}
	return true;
}