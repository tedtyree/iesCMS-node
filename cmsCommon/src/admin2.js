(function(){
  var THEME_KEY = 'iescms_admin_theme';
  var shell = document.getElementById('app-shell');
  if (!shell) { return; }

  function applyTheme(theme){
    shell.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch(e){}
  }

  document.querySelectorAll('[data-theme-toggle]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var next = shell.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      applyTheme(next);
    });
  });

  function openDrawer(){ shell.classList.add('drawer-open'); }
  function closeDrawer(){ shell.classList.remove('drawer-open'); }
  document.querySelectorAll('[data-drawer-open]').forEach(function(btn){ btn.addEventListener('click', openDrawer); });
  document.querySelectorAll('[data-drawer-close]').forEach(function(btn){ btn.addEventListener('click', closeDrawer); });

  var logoChip = document.querySelector('[data-logo-initials]');
  var siteNameEl = document.querySelector('.site-name');
  if (logoChip && siteNameEl) {
    var name = (siteNameEl.textContent || '').trim();
    logoChip.textContent = name ? name.slice(0, 2).toUpperCase() : '--';
  }

  var here = window.location.pathname.replace(/\/+$/,'');
  document.querySelectorAll('.sidebar .nav-item').forEach(function(link){
    var href = link.getAttribute('href') || '';
    var path = href.split('?')[0].replace(/^\.?\//,'').replace(/\/+$/,'');
    var hereBase = here.split('/').pop();
    if (path && hereBase && path === hereBase) { link.classList.add('active'); }
  });
})();
