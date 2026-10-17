/* The 404 page plays out like a game over: "Continue?" counts down from 9 and, unless the visitor does anything, the
   game continues from the island. Any key continues at once; with reduced motion the count is left to the visitor. */
(function () {
  'use strict';
  var count = document.getElementById('over-count');
  var home = document.querySelector('.over .btn');
  if (!count || !home) return;
  var n = 9, timer = 0;
  function stop() { clearInterval(timer); count.parentNode.classList.add('is-stopped'); }
  function tick() {
    n--;
    count.textContent = String(Math.max(n, 0));
    if (n <= 0) { stop(); home.click(); }
  }
  if (!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) timer = setInterval(tick, 1000);
  ['pointerdown', 'scroll', 'touchstart'].forEach(function (type) { addEventListener(type, stop, {once: true, passive: true}); });
  addEventListener('keydown', function (event) {
    if (event.key === 'Tab' || event.key === 'Shift') { stop(); return; }
    if (event.target.closest && event.target.closest('a, button')) return;
    stop(); home.click();
  });
})();
