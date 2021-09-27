   
  if (window.addEventListener)
      window.addEventListener("load", ShowAdminBlock, false);
  else if (window.attachEvent)
      window.attachEvent("onload", ShowAdminBlock);
  else window.onload = ShowAdminBlock;
  
  function ShowAdminBlock() {
   //try { 
	if (ShowAdminMenuLink) { 
		document.getElementById("admin_menu_link_div").style.display = "block";
	}
   //} catch (e1) { }
   
   //try { 
    if (ShowAdminEditPage) { 
		document.getElementById("admin_editpage_link_div").style.display = "block";
	}
   //} catch (e2) { }
 }
 
 function GotoAdminMenu() {
	 window.location="/admin";
 }
 
 function OpenAdminEditPage() {
	var pup=window.open('/admin-edit-iframe?world=' + adminWorld + '&class=Edit-MainWikiPage&obj=' + adminPageID
			,'WObjEditor','menubar=no,status=no,width=1110,height=800,toolbar=no,scrollbars=yes,location=no,directories=no,resizable=yes');
	pup.focus();
 }
 
 function refreshme() {
	location.reload();
}