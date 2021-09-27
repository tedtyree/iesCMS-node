
$(document).ready(function() {
   // login to ASPX to enable CKFinder (which only works with ASPX)
   $.ajax({
		type: "POST",
		url: "/CKFinder/iesLogin.aspx",
		data: {userObjID:"[[userObjID]]",world:"[[world]]",sid:"[[sessionID]]"}
	});
});
