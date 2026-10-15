/*
 * The explorer: a 3D voxel figure rendered by the build (tools/sculpture-vox.js) into a strip of animation frames
 * (assets/explorer.png), played here over the sculpture. Frames 0-7: idle (scarf flutter, breathing); 8-11: wave; 12-13: a glance.
 * Placement comes from the stage's data-explorer="x y w h count" (fractions of the image), written by the build.
 * Static (first frame) when reduced motion is preferred.
 */
(function () {
  'use strict';

  var stage = document.querySelector('.hero__stage');
  if (!stage) return;
  var d = (stage.getAttribute('data-explorer') || '').split(' ').map(Number);
  if (d.length !== 5 || !d.every(isFinite)) return;

  var el = document.createElement('div');
  el.className = 'explorer';
  el.setAttribute('aria-hidden', 'true');
  el.style.left = d[0] * 100 + '%';
  el.style.top = d[1] * 100 + '%';
  el.style.width = d[2] * 100 + '%';
  el.style.height = d[3] * 100 + '%';
  el.style.backgroundSize = d[4] * 100 + '% 100%';
  stage.appendChild(el);

  var count = d[4];
  function show(n) { el.style.backgroundPosition = (count > 1 ? n / (count - 1) * 100 : 0) + '% 0'; }
  show(0);

  var img = new Image();
  img.onload = function () { el.classList.add('is-ready'); };
  img.src = 'assets/explorer.png';

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var t = 0, queue = [];
  function play(seq) { if (!queue.length) queue = seq.slice(); }
  var WAVE = [8, 9, 10, 11, 8, 9, 10, 11, 8, 9];
  var GLANCE = [12, 12, 12, 13, 13, 13, 12, 12, 12, 13, 13, 13];

  setInterval(function () {
    t += 1;
    if (t % 70 === 30) play(GLANCE);
    if (t % 110 === 60) play(WAVE);
    show(queue.length ? queue.shift() : t % 8);
  }, 140);

  el.addEventListener('pointerenter', function () { play(WAVE); });
})();
