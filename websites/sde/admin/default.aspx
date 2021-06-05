<!-- #include virtual="\sde\default.config" -->
<%

'*** Set GoTo Page to the Admin page.
Session("GotoPage")=AdminLinkURL

Response.Redirect(LOGIN_URL)

%>
<HTML><BODY><br><br>... Transfering to the ADMIN page...<br><br><br>
If the page transfer does not take place within the next 10 seconds,<br>
please <a href="<%=LOGIN_URL%>">click here to tranfer the the ADMIN page</a>.<br><br><br>
</BODY>
</HTML>