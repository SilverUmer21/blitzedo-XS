/*
 * Moving between pages is moving between stages. A link fills the screen with stone blocks from the point you pressed
 * (each block lands with an ember flash, like the wordmark's pixels), a level card names the next stage while Chip hops
 * across its loading bar, and the next page breaks back out of the blocks. The cover is carried across the load in
 * sessionStorage; a small inline script in each page's head holds a plain cover up until this script takes over.
 * Skipped entirely with reduced motion, for new tabs, downloads, other sites and same-page anchors.
 */
(function () {
  'use strict';

  var KEY = 'blit';
  var STAGES = {
    '': ['01', 'The Island'], 'index.html': ['01', 'The Island'],
    'studio.html': ['02', 'The Workshop'], 'contact.html': ['03', 'The Mailbox'], 'games.html': ['04', 'The Arcade']
  };
  var STONE = ['#151614', '#181917', '#1b1c1a', '#1e1f1d', '#222320'];
  var EMBER = '#E8332A', EMBER_DARK = '#5C0D0A', EDGE = '#34352f';
  var SEGMENTS = 10;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  var SPRITE = new URL('../assets/chip-sprites.png', document.currentScript ? document.currentScript.src : location.href).href;

  function stageFor(url) {
    var file = url.pathname.split('/').pop();
    return STAGES[file] || ['??', 'Uncharted'];
  }

  // ---- the cover: a canvas of blocks and the level card -------------------------------------------------------
  var cover = null;
  function build(stage) {
    var el = document.createElement('div');
    el.className = 'blit';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<canvas class="blit__blocks"></canvas>' +
      '<div class="blit__card"><span class="blit__stage">Stage ' + stage[0] + '</span>' +
      '<span class="blit__name">' + stage[1] + '</span>' +
      '<span class="blit__track"><i class="blit__chip"></i></span>' +
      '<span class="blit__bar">' + new Array(SEGMENTS + 1).join('<i></i>') + '</span></div>';
    document.body.appendChild(el);
    var canvas = el.querySelector('canvas');
    var w = innerWidth, h = innerHeight;
    var size = Math.round(Math.max(26, Math.min(w, h) / 11));
    var cols = Math.ceil(w / size), rows = Math.ceil(h / size);
    canvas.width = cols * size; canvas.height = rows * size;
    var cells = [];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      cells.push({x: c * size, y: r * size, cx: (c + .5) / cols, cy: (r + .5) / rows,
        color: STONE[(Math.random() * STONE.length) | 0], ember: Math.random() < .045, jitter: Math.random()});
    }
    cover = {el: el, ctx: canvas.getContext('2d'), size: size, cells: cells, card: el.querySelector('.blit__card'),
      chip: el.querySelector('.blit__chip'), segments: el.querySelectorAll('.blit__bar i'), frame: 0};
    return cover;
  }
  // order: 0..1 per cell; at (time 0..1) a cell is shown when its order has passed. `flash` cells draw an ember first.
  function draw(order, time, filling) {
    var ctx = cover.ctx, s = cover.size;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    for (var i = 0; i < cover.cells.length; i++) {
      var cell = cover.cells[i], at = order(cell), shown = filling ? time >= at : time < at;
      if (!shown) continue;
      // the blocks at the moving edge: a few catch an ember, the rest a lighter stone, so the front reads as sparks
      var fresh = Math.abs(time - at) < .06;
      ctx.fillStyle = fresh ? (cell.jitter < .3 ? EMBER : EDGE) : cell.ember ? EMBER_DARK : cell.color;
      ctx.fillRect(cell.x, cell.y, s, s);
    }
  }
  // Blocks spread out from a point (fractions of the screen), measured in screen proportions, with a little scatter.
  function radial(ox, oy) {
    var aspect = innerWidth / innerHeight;
    var reach = function (x, y) { return Math.hypot((x - ox) * aspect, y - oy); };
    var far = Math.max(reach(0, 0), reach(1, 0), reach(0, 1), reach(1, 1));
    return function (c) { return reach(c.cx, c.cy) / far * .82 + c.jitter * .16; };
  }
  function progress(bar, chipAt) {
    for (var i = 0; i < cover.segments.length; i++) cover.segments[i].classList.toggle('is-on', i < bar);
    cover.chip.style.setProperty('--at', chipAt.toFixed(3));
    cover.chip.style.setProperty('--frame', String(Math.floor(cover.frame / 3) % 4));
    cover.frame++;
  }
  // Runs fn(t) on stepped frames (about 30 a second, like the pixel art) for `ms`, then resolves.
  function play(ms, fn) {
    return new Promise(function (done) {
      var start = performance.now(), last = 0;
      (function tick(now) {
        var t = Math.min(1, (now - start) / ms);
        if (now - last >= 30 || t === 1) { last = now; fn(t); }
        if (t < 1) requestAnimationFrame(tick); else done();
      })(start);
    });
  }

  // ---- leaving -------------------------------------------------------------------------------------------------
  function leave(link, event) {
    var url = new URL(link.href, location.href);
    var x = event.clientX, y = event.clientY;
    if (!x && !y) { var box = link.getBoundingClientRect(); x = box.left + box.width / 2; y = box.top + box.height / 2; }
    var ox = x / innerWidth, oy = y / innerHeight;
    build(stageFor(url));
    var order = radial(ox, oy);
    var go = function () {
      try { sessionStorage.setItem(KEY, JSON.stringify({t: Date.now(), x: ox, y: oy})); } catch (e) {}
      location.href = url.href;
    };
    play(420, function (t) {
      draw(order, t * 1.05, true);
      if (t > .45) cover.card.classList.add('is-shown');
      progress(Math.round(t * 6), t * .55);
    }).then(go);
  }

  document.addEventListener('click', function (event) {
    if (reduced || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var link = event.target.closest && event.target.closest('a[href]');
    if (!link || link.target && link.target !== '_self' || link.hasAttribute('download')) return;
    var url = new URL(link.href, location.href);
    if (url.origin !== location.origin || !/(\.html|\/)$/.test(url.pathname)) return;
    if (url.pathname === location.pathname && url.search === location.search) return;   // anchors and the current page
    event.preventDefault();
    leave(link, event);
  });

  // Fetch a page the moment a pointer or focus heads for its link, so the stage change rarely waits on the network.
  var fetched = {};
  function prefetch(event) {
    var link = event.target.closest && event.target.closest('a[href]');
    if (!link) return;
    var url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname === location.pathname || fetched[url.pathname]) return;
    if (!fetched.sprite) { fetched.sprite = true; new Image().src = SPRITE; }
    fetched[url.pathname] = true;
    var hint = document.createElement('link');
    hint.rel = 'prefetch'; hint.href = url.pathname;
    document.head.appendChild(hint);
  }
  ['pointerover', 'touchstart', 'focusin'].forEach(function (type) { document.addEventListener(type, prefetch, {passive: true}); });

  // ---- arriving ------------------------------------------------------------------------------------------------
  function arrive() {
    var data = null;
    try { data = JSON.parse(sessionStorage.getItem(KEY)); sessionStorage.removeItem(KEY); } catch (e) {}
    if (!root.classList.contains('blit-in')) return;
    if (!data || Date.now() - data.t > 6000 || reduced) { root.classList.remove('blit-in'); return; }
    build(stageFor(location));
    cover.card.classList.add('is-shown');
    draw(function () { return 1; }, 0, false);
    progress(6, .55);
    root.classList.remove('blit-in');
    // Break out once the page underneath has its type and its first picture, without waiting long for either.
    var art = document.querySelector('.hero__sculpture, .scene__hold img');
    var ready = Promise.all([
      document.fonts ? document.fonts.ready : null,
      art && art.decode ? art.decode().catch(function () {}) : null
    ]);
    var cap = new Promise(function (r) { setTimeout(r, 450); });
    var order = radial(.5, .5);
    play(160, function (t) { progress(6 + Math.round(t * 4), .55 + t * .2); })
      .then(function () { return Promise.race([ready, cap]); })
      .then(function () {
        cover.card.classList.remove('is-shown');
        return play(380, function (t) { draw(order, t * 1.15, false); progress(SEGMENTS, .75 + t * .35); });
      })
      .then(teardown);
  }
  function teardown() {
    root.classList.remove('blit-in');
    if (cover) { cover.el.remove(); cover = null; }
  }
  // Coming back through the history restores the page as it was left, cover and all: clear it.
  addEventListener('pageshow', function (event) { if (event.persisted) teardown(); });

  // The stages reached so far, for the level select on games.html.
  try {
    var file = location.pathname.split('/').pop() || 'index.html';
    var seen = JSON.parse(localStorage.getItem('blitzedo:stages') || '[]');
    if (STAGES[file] && seen.indexOf(file) < 0) { seen.push(file); localStorage.setItem('blitzedo:stages', JSON.stringify(seen)); }
  } catch (e) {}

  arrive();
})();
