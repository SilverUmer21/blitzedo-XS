(function () {
  'use strict';

  // the wordmark's pixel "blit" re-assembles on hover
  var mark = document.querySelector('.wordmark');
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (mark && !still && Element.prototype.animate) {
    var lastBlit = 0;
    mark.addEventListener('pointerenter', function (e) {
      if (e.pointerType === 'touch' || Date.now() - lastBlit < 1500) return;
      lastBlit = Date.now();
      var solid = mark.querySelector('.wm-solid');
      if (solid) solid.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 1050 });
      mark.querySelectorAll('.wm-px').forEach(function (px) {
        var cs = getComputedStyle(px);
        px.animate([{ opacity: 0, transform: 'translate(' + cs.getPropertyValue('--x') + ',' + cs.getPropertyValue('--y') + ')' },
          { opacity: 1, transform: 'none' }], { duration: 550, delay: parseFloat(cs.getPropertyValue('--d')) * 1000, easing: 'steps(4, end)', fill: 'backwards' });
      });
    });
  }

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
