// iHeartKenya.org - global.js - Custom functions across entire website

// isAdmin flag/cookie - once set should stay set.  This allows us to display admin menu options to users even if they are not logged in.
// NOTE: just because this flag is set does NOT give the user admin permissions.  They must first login.
var isAdmin = getCookie('isadmin', 'bool');
var adminFlag = "[[isAdmin:true]]";
if (adminFlag == 'true' && isAdmin == false) {
	isAdmin = true;
	setIsAdmin(adminFlag);
}

$(document).ready(function () {
	$('[data-toggle="tooltip"]').tooltip();
	$('.likes').click(function () { clickMe(this); return false; });
	$('.likeButton').click(function () { clickMe(this); return false; });
});

function clickMe(htmlBlock) {
	likeID = null;
	likeTag = '';
	likeCount = -99;
	if (htmlBlock.dataset) {
		if (htmlBlock.dataset.liketag) {
			likeTag = htmlBlock.dataset.liketag;
			likeID = '#like-' + likeTag;
		}
	}
	if ($(likeID).length > 0) {
		try {
			likeCount = parseInt($(likeID).first().attr('data-likecount'));
		} catch (e1) { }

		likeCount++;
		if (likeCount > 0) {
			// Play the sound & clear the box selection
			playSound('like');

			$(likeID).attr('data-likecount', likeCount);
			var likeText = $('div[data-liketag="' + likeTag + '"]').attr('title');
			if (likeText) {
				$('div[data-liketag="' + likeTag + '"]').attr('title', likeCount + " likes");
			} else {
				$('div[data-liketag="' + likeTag + '"]').attr('data-original-title', likeCount + " likes");
			}
			var likeShort = shortenCount(likeCount);
			$(likeID).html(likeShort);

			incrementWeLoveKenya(likeTag);
		}
	}
}

function shortenCount(longNumber) {

	var ddiv = 1;
	var likeSuffix = "";
	var likeShort = "";
	if (longNumber >= 1000000) {
		ddiv = 1000000;
		likeSuffix = "M";
	} else if (longNumber >= 1000) {
		ddiv = 1000;
		likeSuffix = "k";
	}
	likeShort = Math.floor(longNumber / ddiv) + likeSuffix;
	return (likeShort);

}

function incrementWeLoveKenya(key) {
	fetch('qcmd?cmd=custom&subcmd=incrementWeLoveKenya&likeTag=' + key);
}

function playSound(whichSound) {
	var audioClt = null;
	switch (whichSound.toLowerCase()) {
		case "like":
			audioCtl = document.getElementById('waterDrop1');
	}
	try {
		if (audioCtl) { audioCtl.play(); }
	} catch { }
}

function setLangMain(newLang, thisEvent) {
	setLangCookie(newLang);
	if (thisEvent) { thisEvent.preventDefault(); }
	if (noRefreshOnLanguageEvent && noRefreshOnLanguageEvent.toLowerCase() == 'true') {
		updateLanguage(newLang);  // use jquery to hide/show language text
	} else {
		location.reload();  // refresh page to show new language
	}
}

function setLangCookie(newLang) {
	document.cookie = "lang=" + newLang + ";path=/";
}

function setIsAdmin(newValue) {
	document.cookie = "isadmin=" + newValue + ";path=/";
}

function getCookie(cname, typ) {
	var ret = "";
	var name = cname + "=";
	var decodedCookie = decodeURIComponent(document.cookie);
	var ca = decodedCookie.split(';');
	for (var i = 0; i < ca.length; i++) {
		var c = ca[i].trim();
		if (c.indexOf(name) == 0) {
			ret = c.substring(name.length, c.length);
			return ret;
		}
	}
	if (typ == 'bool') { ret = (ret.trim().toLowerCase() == 'true') ? true : false; }
	return ret;
}

$(document).ready(function () {
	language = getCookie('lang');
	if (setLanguage && (!language || language != setLanguage)) {
		language = setLanguage;
		setLangCookie(language);
	}
	if (validLanguages) { // make sure we use a language that this page allows
		const validLangs = validLanguages.split(",");
		if (!validLangs.includes(language)) {
			// not found in valid languages
			language = validLangs[0]; // lets take the first language as the default
			if (!language) { language = "en"; } // if all else fails, use english
		}
	}
	updateLanguage(language);
	setLanguage = "";
});

function updateLanguage(newLanguage) {
	language = newLanguage;
	if (language) {
		$('[class^="lang-"]').hide();
		$('[class="lang-' + language + '"]').show();
	}
}
