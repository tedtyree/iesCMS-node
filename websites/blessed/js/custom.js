
<!--Responsive Navigation-->
/*Home Main Slider*/
$('.main-slider').owlCarousel({
    items:1,
    margin:0,
	loop:true,
	navText : [" "," "],
	nav:true,
    autoHeight:true
});
/*Home Main Slider End*/

/*Home Main Slider*/
$('.testimonials').owlCarousel({
    items:1,
    margin:0,
	loop:false,
	navText : [" "," "],
	mouseDrag  : true,
	mouseDrag: false,
	nav:true,
    autoHeight:false
});
/*Home Main Slider End*/

/*Sticky Header*/
$(window).scroll(function(){
  var sticky = $('.sticky'),
      scroll = $(window).scrollTop();

  if (scroll >= 150) sticky.addClass('fixed');
  else sticky.removeClass('fixed');
});
/*Sticky Header End*/

/*Header Menu*/
(function($) {
$.fn.menumaker = function(options) {  
 var cssmenu = $(this), settings = $.extend({
   format: "dropdown",
   sticky: false
 }, options);
 return this.each(function() {
   $(this).find(".button").on('click', function(){
     $(this).toggleClass('menu-opened');
     var mainmenu = $(this).next('ul');
     if (mainmenu.hasClass('open')) { 
       mainmenu.slideToggle().removeClass('open');
     }
     else {
       mainmenu.slideToggle().addClass('open');
       if (settings.format === "dropdown") {
         mainmenu.find('ul').show();
       }
     }
   });
   cssmenu.find('li ul').parent().addClass('has-sub');
multiTg = function() {
     cssmenu.find(".has-sub").prepend('<span class="submenu-button"></span>');
     cssmenu.find('.submenu-button').on('click', function() {
       $(this).toggleClass('submenu-opened');
       if ($(this).siblings('ul').hasClass('open')) {
         $(this).siblings('ul').removeClass('open').slideToggle();
       }
       else {
         $(this).siblings('ul').addClass('open').slideToggle();
       }
     });
   };
   if (settings.format === 'multitoggle') multiTg();
   else cssmenu.addClass('dropdown');
   if (settings.sticky === true) cssmenu.css('position', 'fixed');
resizeFix = function() {
  var mediasize = 767;
     if ($( window ).width() > mediasize) {
       cssmenu.find('ul').show();
     }
     if ($(window).width() <= mediasize) {
       cssmenu.find('ul').hide().removeClass('open');
     }
   };
   resizeFix();
   return $(window).on('resize', resizeFix);
 });
  };
})(jQuery);

(function($){
$(document).ready(function(){
$("#cssmenu").menumaker({
   format: "multitoggle"
});
});
})(jQuery);
/*Header Menu End*/






/*Know-us page Tab*/
/*
*	jQueryUI.Tabs.Neighbors, v1.0.3
*	(c) 2014–2017 Artyom "Sleepwalker" Fedosov <mail@asleepwalker.ru>
*	https://github.com/asleepwalker/jquery-ui.tabs.neighbors.js
*/

(function (factory) {
	if (typeof define === 'function' && define.amd) {
		define(['jquery'], factory);
	} else if (typeof module === 'object' && module.exports) {
		module.exports = function (root, jQuery) {
			if (jQuery === undefined) {
				if (typeof window !== 'undefined') {
					jQuery = require('jquery');
				} else {
					jQuery = require('jquery')(root);
				}
			}
			factory(jQuery);
			return jQuery;
		};
	} else {
		factory(jQuery);
	}
}(function ($) {

	var originalCreate = $.ui.tabs.prototype._create;

	function openSibling(goingForward) {
		var target = this.options.active + (goingForward ? 1 : -1);
		this._activate(this._findNextTab(target, goingForward));
	}

	$.extend($.ui.tabs.prototype, {
		autoplayTimeout: 0,
		neighbors: {
			prev: false,
			next: false
		},
		_create: function () {
			var _this = this;
			var s;
			var _widget = _this.widget();
			var isAutoplayPaused = true;
			var timeoutMsec = 1000 * _this.options.autoplayTimeout;
			var timeoutID;

			originalCreate.call(_this);

			this.pauseAutoplay = pauseAutoplay;

			if (typeof _this.options.neighbors != 'undefined') {
				s = _this.options.neighbors;
				if (s.prev && s.prev instanceof $) {
					s.prev.on('click', clickPrev);
				}
				if (s.next && s.next instanceof $) {
					s.next.on('click', clickNext);
				}
			}

			if (timeoutMsec > 1000) {
				isAutoplayPaused = false;
				timeoutID = window.setTimeout(next, timeoutMsec);
			}

			_widget.on('tabsbeforeactivate', function () {
				window.clearTimeout(timeoutID);
			});

			_widget.on('tabsactivate', function () {
				if (!isAutoplayPaused) {
					timeoutID = window.setTimeout(next, timeoutMsec);
				}
			});

			function clickPrev() {
				//pauseAutoplay();
				prev();
			}

			function clickNext() {
				//pauseAutoplay();
				next();
			}

			function next() {
				openSibling.call(_this, true);
			}

			function prev() {
				openSibling.call(_this, false);
			}

			function pauseAutoplay() {
				window.clearTimeout(timeoutID);
				if (!isAutoplayPaused) {
					isAutoplayPaused = true;
					_widget.trigger('tabspaused');
				}
			}

		},
		pause: function () {
			// $('#tabs').tabs('pause')
			this.pauseAutoplay();
		}
	});

}));

$(function() {
	$('#hom-ministr').tabs({
		neighbors: {
			prev: $('button.prev'),
			next: $('button.next')
		}
	});
});

$(function() {
	$('#staff').tabs({
		neighbors: {
			prev: $('button.prev'),
			next: $('button.next')
		}
	});
});

$(function() {
	$('#history').tabs({

	});
});
/*Know-us page Tab End*/



