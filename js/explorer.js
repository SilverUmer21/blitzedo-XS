/*
 * The explorer: a hand-authored pixel-art sprite layered over the sculpture, with small idle animations.
 *  - breathing: the body bobs one pixel
 *  - scarf: the tail flutters behind him (4 frames)
 *  - visor: a glint sweeps across now and then; sometimes he glances toward the viewer
 *  - wave: every so often (and on hover) he waves
 * Position comes from the stage's data-explorer attribute (where the landing is in the render; written by the build). Static when reduced motion is preferred.
 */
(function () {
  'use strict';

  var art = document.querySelector('.hero__stage');
  if (!art) return;

  var PAL = {
    o: '#1b1614', W: '#F7F2E8', w: '#E4DDCE', s: '#BDB4A3', g: '#8C8374',
    K: '#060606', k: '#262626', L: '#7a7a7a', l: '#3e3e3e',
    R: '#E3262B', r: '#A3151A', H: '#FF5D49', d: '#6E0C10',
    p: '#ECB2A4', q: '#C98477', b: '#3a3330', B: '#5a504a'
  };
  var OX = 7;                                   // maps are drawn 7 columns in, leaving room for the scarf tail on the left
  var COLS = 34, ROWS = 31;

  // helmet, collar, body (without the right arm) and legs; 26 columns
  var BASE = [
    '........oooooooooo........',
    '.......opWWWWWWWWWo.......',
    '......opWWWWWWWWWWWo......',
    '......opWWWWWWWWWWwo......',
    '......oqWWWWWWWlKKKKo.....',
    '......oqwWWWWWWkKKKKo.....',
    '......oqwWWWWWWkKKKKo.....',
    '......oqwwWWWWWkKKKKo.....',
    '......oqswWWWWWWkkkko.....',
    '......osswwWWWWWWWWwo.....',
    '.......osswwwwwwwwo.......',
    '........oRRRRRRRRo........',
    '.......oRHRRRRRRrro.......',
    '.......orRRRRRRrrdo.......',
    '........opWWWWWWwo........',
    '.......oqpWWWWWWWwo.......',
    '......osopWWWWWWWWwo......',
    '......osoqWWWWWWWwo.......',
    '......ogoqwWWWWWWwo.......',
    '......oo.oswWWWWwo........',
    '.........oswWWWWwo........',
    '.........osswwwwwo........',
    '.........ossswwwso........',
    '..........ooooooo.........',
    '..........osoowWo.........',
    '..........oso.owWo........',
    '..........oso..owo........',
    '.........obbo..oBBo.......',
    '.........obbbo.oBBBo......',
    '.........ooooo.ooooo......'
  ];
  // the visor shifted one pixel toward the viewer (a glance)
  var LOOK = [
    [4, '......owWWWWWWlKKKKWo.....'], [5, '......owWWWWWWkKKKKWo.....'], [6, '......owWWWWWWkKKKKWo.....'],
    [7, '......owwWWWWWkKKKKWo.....'], [8, '......oswWWWWWWkkkkWo.....']
  ];
  var ARM_DOWN = [[16, 19, 'o'], [17, 18, 'W'], [17, 19, 'W'], [17, 20, 'o'], [18, 18, 'w'], [18, 19, 'W'], [18, 20, 'o'], [19, 18, 'o'], [19, 19, 'o'], [19, 20, 'o']];
  var ARM_UP = [[11, 20, 'o'], [11, 21, 'o'], [12, 19, 'o'], [12, 20, 'W'], [12, 21, 'W'], [12, 22, 'o'], [13, 19, 'o'], [13, 20, 'W'], [13, 21, 'o'],
    [14, 18, 'o'], [14, 19, 'W'], [14, 20, 'o'], [15, 18, 'W'], [15, 19, 'o'], [16, 18, 'o']];
  var ARM_UP2 = [[10, 21, 'o'], [10, 22, 'o'], [11, 20, 'o'], [11, 21, 'W'], [11, 22, 'W'], [11, 23, 'o'], [12, 19, 'o'], [12, 20, 'W'], [12, 21, 'o'],
    [13, 19, 'o'], [13, 20, 'o'], [14, 18, 'o'], [14, 19, 'W'], [14, 20, 'o'], [15, 18, 'W'], [15, 19, 'o'], [16, 18, 'o']];
  var GLINT = [[4, 16], [5, 17], [6, 18], [7, 19]];   // visor pixels the glint sweeps over (row, col)

  // the scarf tail: a two-pixel band streaming left from the collar, waving, ending in a notched fork
  function tailFrame(phase) {
    var fill = {}, out = [];
    var len = 14;
    function set(y, x, c) { fill[y + ',' + x] = c; }
    for (var c = 1; c <= len; c++) {
      var x = 7 + OX - c;
      var y = 11.6 + c * 0.3 + Math.sin(c * 0.62 - phase * Math.PI / 2) * (0.25 + c * 0.11);
      var top = Math.round(y);
      var thick = c < 5 ? 3 : c < len - 2 ? 2 : 1;
      if (c >= len - 1) {                           // the notched fork
        set(top - 1, x, 'R'); set(top + 1, x, 'r');
        continue;
      }
      for (var q = 0; q < thick; q++) set(top + q, x, q === 0 ? (c % 5 === 2 ? 'H' : 'R') : q === thick - 1 ? 'r' : 'R');
    }
    // a one-pixel dark outline around the band
    Object.keys(fill).forEach(function (k) {
      var p = k.split(',').map(Number);
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var kk = (p[0] + d[0]) + ',' + (p[1] + d[1]);
        if (!fill[kk] && p[1] + d[1] < 7 + OX) out.push([p[0] + d[0], p[1] + d[1], 'o']);
      });
    });
    return out.concat(Object.keys(fill).map(function (k) { var p = k.split(',').map(Number); return [p[0], p[1], fill[k]]; }));
  }

  var NS = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + COLS + ' ' + ROWS);
  svg.setAttribute('class', 'explorer');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('shape-rendering', 'crispEdges');
  var body = document.createElementNS(NS, 'g');
  svg.appendChild(body);

  function layer(pixels) {
    var g = document.createElementNS(NS, 'g');
    pixels.forEach(function (p) {
      var r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', p[1]); r.setAttribute('y', p[0]); r.setAttribute('width', 1.02); r.setAttribute('height', 1.02);
      r.setAttribute('fill', PAL[p[2]]);
      g.appendChild(r);
    });
    body.appendChild(g);
    return g;
  }
  function mapPixels(rows) {
    var out = [];
    rows.forEach(function (row, y) {
      for (var x = 0; x < row.length; x++) if (row[x] !== '.') out.push([y, x + OX, row[x]]);
    });
    return out;
  }
  function shift(list) { return list.map(function (p) { return [p[0], p[1] + OX, p[2]]; }); }

  var tails = [0, 1, 2, 3].map(function (f) { return layer(tailFrame(f)); });
  var base = layer(mapPixels(BASE));
  var lookRows = [];
  LOOK.forEach(function (l) { var row = []; for (var x = 0; x < l[1].length; x++) if (l[1][x] !== '.') row.push([l[0], x + OX, l[1][x]]); lookRows = lookRows.concat(row); });
  var look = layer(lookRows);
  var armDown = layer(shift(ARM_DOWN)), armUp = layer(shift(ARM_UP)), armUp2 = layer(shift(ARM_UP2));
  var glint = layer([[0, 0, 'L']]);

  art.appendChild(svg);

  // position: feet on the landing, about 1.55 big blocks tall (data-explorer="x y block", fractions of the image, set by the build)
  var a = (art.getAttribute('data-explorer') || '').split(' ').map(Number);
  if (a.length === 3 && a.every(isFinite)) {
    svg.style.left = (a[0] * 100) + '%';
    svg.style.top = (a[1] * 100) + '%';
    svg.style.height = (a[2] * 1.55 * 100) + '%';
    svg.classList.add('is-placed');
  }

  function show(g, on) { g.style.display = on ? '' : 'none'; }

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var waving = 0, glancing = 0, glintAt = -1, t = 0;

  function frame() {
    var tailF = reduce ? 1 : Math.floor(t / 1.4) % 4;
    tails.forEach(function (g, i) { show(g, i === tailF); });
    var bob = !reduce && Math.floor(t / 7) % 2 === 1;
    body.setAttribute('transform', bob ? 'translate(0 -0.5)' : '');
    base.style.display = '';
    show(look, glancing > 0);
    var up = waving > 0 ? (Math.floor(waving / 2.5) % 2 === 0 ? 1 : 2) : 0;
    show(armDown, up === 0); show(armUp, up === 1); show(armUp2, up === 2);
    if (glintAt >= 0 && glintAt < GLINT.length && glancing === 0) {
      var gp = GLINT[glintAt];
      glint.firstChild.setAttribute('x', gp[1] + OX); glint.firstChild.setAttribute('y', gp[0]);
      show(glint, true);
    } else show(glint, false);
  }

  frame();
  if (reduce) return;

  setInterval(function () {
    t += 1;
    if (waving > 0) waving -= 1;
    if (glancing > 0) glancing -= 1;
    if (glintAt >= 0) glintAt = glintAt + 1 > GLINT.length + 1 ? -1 : glintAt + 1;
    if (t % 45 === 0) glintAt = 0;                       // visor glint every 4.5 s
    if (t % 80 === 30) glancing = 14;                    // a glance toward the viewer
    if (t % 130 === 70) waving = 20;                     // a wave now and then
    frame();
  }, 100);

  svg.addEventListener('pointerenter', function () { waving = 20; });
})();
