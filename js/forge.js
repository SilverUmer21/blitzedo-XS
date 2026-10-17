/*
 * The Games page while the first game is being made: Chip pounds a glowing block on an anvil. Each strike throws
 * sparks, shakes the scene a pixel and knocks a few cells off, until the block is the wordmark's pixel b; it flares,
 * Chip cheers, and the block is whole again. Paused off screen; with reduced motion the finished b and a cheer stand still.
 */
(function () {
  'use strict';

  var forge = document.getElementById('forge');
  if (!forge) return;
  var B = ['XX.....', 'XX.....', 'XX.XXX.', 'XXXXXXX', 'XX...XX', 'XX...XX', 'XX...XX', 'XXXXXXX', 'XX.XXX.'];
  var FRAME = {up: 0, slam: 1, cheer: 2, idle: 3};
  var ingot = forge.querySelector('.ingot'), chip = forge.querySelector('.forge__chip'), heat = forge.querySelector('.forge__heat');
  var canvas = forge.querySelector('.forge__sparks'), ctx = canvas.getContext('2d');
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cells = [], sparks = [], strikes = 0, visible = true, running = false;

  heat.innerHTML = new Array(11).join('<i></i>');
  var bars = heat.querySelectorAll('i');
  B.join('').split('').forEach(function (ch) {
    var cell = document.createElement('i');
    cell.dataset.keep = ch === 'X' ? '1' : '';
    ingot.appendChild(cell);
    cells.push(cell);
  });
  function frame(i) { chip.style.backgroundPosition = (-i * 96) + 'px 0'; }
  function size() { var r = forge.getBoundingClientRect(); canvas.width = Math.round(r.width); canvas.height = Math.round(r.height); }
  size();
  if (window.ResizeObserver) new ResizeObserver(size).observe(forge);

  function burst() {
    var r = ingot.getBoundingClientRect(), f = forge.getBoundingClientRect();
    var cx = r.left - f.left + r.width / 2, cy = r.top - f.top + 4;
    for (var i = 0; i < 22; i++) {
      sparks.push({x: cx + (Math.random() - .5) * r.width, y: cy, vx: (Math.random() - .5) * 5, vy: -Math.random() * 5 - 1,
        life: 30 + Math.random() * 20, c: Math.random() < .3 ? '#ffd2a8' : Math.random() < .5 ? '#ff7a52' : '#e8332a'});
    }
  }
  function draw() {
    requestAnimationFrame(draw);
    if (!visible) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    sparks = sparks.filter(function (p) { return (p.life -= 1) > 0; });
    sparks.forEach(function (p) { p.vy += .22; p.x += p.vx; p.y += p.vy; ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), 3, 3); });
  }
  // One strike: a few loose cells fall away. Returns false once only the b is left.
  function strike() {
    var loose = cells.filter(function (c) { return !c.dataset.keep && !c.classList.contains('is-gone'); });
    if (!loose.length) return false;
    for (var n = 0; n < 4 && loose.length; n++) loose.splice(Math.random() * loose.length | 0, 1)[0].classList.add('is-gone');
    strikes++;
    for (var i = 0; i < bars.length; i++) bars[i].classList.toggle('is-on', i < strikes);
    forge.classList.remove('is-shake');
    void forge.offsetWidth;
    forge.classList.add('is-shake');
    burst();
    return true;
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function loop() {
    if (!visible) { running = false; return; }
    running = true;
    frame(FRAME.up);
    wait(420).then(function () {
      frame(FRAME.slam);
      if (strike()) return wait(260);
      frame(FRAME.cheer);
      ingot.classList.add('is-hot');
      burst(); burst();
      return wait(1600).then(function () {
        ingot.classList.remove('is-hot');
        cells.forEach(function (c) { c.classList.remove('is-gone'); });
        strikes = 0;
        for (var i = 0; i < bars.length; i++) bars[i].classList.remove('is-on');
        frame(FRAME.idle);
        return wait(700);
      });
    }).then(loop);
  }

  if (reduced) {
    cells.forEach(function (c) { if (!c.dataset.keep) c.classList.add('is-gone'); });
    frame(FRAME.cheer);
    return;
  }
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible && !running) loop();
    }).observe(forge);
  }
  draw();
  loop();
})();
