(function () {
  'use strict';

  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('site-nav');
  if (!toggle || !nav) return;

  function isOpen() { return toggle.getAttribute('aria-expanded') === 'true'; }

  function setOpen(open) {
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
    document.documentElement.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  toggle.addEventListener('click', function () {
    var open = !isOpen();
    setOpen(open);
    if (open) {
      var first = nav.querySelector('a');
      if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 180);
    }
  });

  nav.addEventListener('click', function (e) {
    if (e.target.closest('a') && isOpen()) setOpen(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) {
      setOpen(false);
      toggle.focus();
    }
  });

  window.matchMedia('(min-width: 901px)').addEventListener('change', function (e) {
    if (e.matches) setOpen(false);
  });
})();
