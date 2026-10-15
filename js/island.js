/*
 * The live island. The page first shows the pre-rendered image; once the page is idle this swaps in the same scene drawn live
 * with plain WebGL from assets/island.bin (one 12-byte record per voxel face, written by tools/sculpture-vox.js), so it can move:
 *   - the gate breathes, and square sparks drift up out of it
 *   - a white-hot pulse runs from the gate along the stairs and the red outlines, face by face, like a fuse
 *   - tap the island: its blocks burst outward in a ripple from the tap and spring back (the explorer rides his block)
 * Skipped (the image stays) with reduced motion, Save-Data, or no WebGL. Pauses when off screen or in a background tab.
 */
(function () {
  'use strict';

  var stage = document.querySelector('.hero__stage');
  var img = stage && stage.querySelector('.hero__sculpture');
  if (!stage || !img || !window.fetch || !window.Float32Array) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (navigator.connection && navigator.connection.saveData) return;

  var MARGIN = 0.08;                        // the canvas overhangs the image so bursting blocks are not clipped

  var VS = [
    'attribute vec3 aPos; attribute vec3 aCol; attribute vec2 aInfo; attribute vec3 aDir; attribute vec2 aScr;',
    'uniform mat4 uMVP; uniform float uT; uniform float uClickT; uniform vec2 uClick;',
    'varying vec3 vCol; varying vec2 vInfo;',
    'float burst(float s) {',
    '  if (s <= 0.0 || s >= 1.8) return 0.0;',
    '  if (s < 0.22) { float u = 1.0 - s / 0.22; return 1.0 - u * u * u; }',
    '  float u = s - 0.22; return exp(-3.6 * u) * cos(7.5 * u);',
    '}',
    'void main() {',
    '  float s = (uT - uClickT - length(aScr - uClick) * 0.5) / 1.5;',
    '  vec3 d = floor(aDir * burst(s) / 1.25 + 0.5) * 1.25;',   // moves in half-voxel steps, so it stays pixel art
    '  gl_Position = uMVP * vec4(aPos + d, 1.0);',
    '  vCol = aCol; vInfo = aInfo;',
    '}'
  ].join('\n');

  var FS = [
    'precision mediump float;',
    'uniform float uPhase; uniform float uPulse;',   // uPhase: the gate's breathing (a separate name: precisions differ per stage)
    'varying vec3 vCol; varying vec2 vInfo;',
    'void main() {',
    '  vec3 c = vCol;',
    '  if (vInfo.x > 1.5) c *= 1.0 + 0.14 * uPhase;',                    // the gate breathes
    '  else if (vInfo.x > 0.5 && vInfo.y < 1.5) {',                              // red light: the pulse runs along it
    '    float d = vInfo.y - uPulse;',
    '    float g = exp(-d * d / 0.0003);',
    '    float tail = d < 0.0 && d > -0.14 ? (1.0 + d / 0.14) * 0.3 : 0.0;',
    '    c = mix(c, vec3(1.0, 0.72, 0.5), clamp(g * 0.8 + tail, 0.0, 1.0));',
    '  }',
    '  gl_FragColor = vec4(c, 1.0);',
    '}'
  ].join('\n');

  var SPARK_VS = [
    'attribute vec4 aSeed;',
    'uniform mat4 uMVP; uniform float uT; uniform float uPx; uniform vec4 uDoor;',   // x0, x1, back wall y, front y
    'varying float vA;',
    'void main() {',
    '  float period = 2.4 + aSeed.w * 2.2;',
    '  float t = fract(uT / period + aSeed.x);',
    '  float X = uDoor.x + 2.5 + aSeed.y * (uDoor.y - uDoor.x - 5.0) + sin(t * 6.0 + aSeed.z * 6.283) * 2.0;',
    '  float Y = uDoor.z + 3.0 + aSeed.z * 8.0 + t * 18.0;',
    '  float Z = 1.5 + aSeed.x * 5.0 + t * 34.0;',
    '  vec3 p = floor(vec3(X, Z, Y) / 1.25) * 1.25;',
    '  gl_Position = uMVP * vec4(p, 1.0);',
    '  gl_PointSize = uPx * (aSeed.w > 0.7 ? 2.5 : 1.25);',
    '  vA = (1.0 - t) * smoothstep(0.0, 0.08, t);',
    '}'
  ].join('\n');

  var SPARK_FS = [
    'precision mediump float;',
    'varying float vA;',
    'void main() { gl_FragColor = vec4(vec3(1.0, 0.5, 0.32) * vA, 1.0); }'
  ].join('\n');

  function compile(gl, vs, fs) {
    var p = gl.createProgram();
    [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].forEach(function (s) {
      var sh = gl.createShader(s[0]);
      gl.shaderSource(sh, s[1]); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      gl.attachShader(p, sh);
    });
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  function mul(a, b) {                       // column-major 4 x 4: a * b
    var o = new Float32Array(16);
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
      var s = 0;
      for (var k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
    return o;
  }

  function ortho(l, r, t, b, n, f) {
    var w = 1 / (r - l), h = 1 / (t - b), p = 1 / (f - n);
    return new Float32Array([2 * w, 0, 0, 0, 0, 2 * h, 0, 0, 0, 0, -2 * p, 0, -(r + l) * w, -(t + b) * h, -(f + n) * p, 1]);
  }

  var CORNERS = [
    [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],     // top (+Z)
    [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]],     // front (+Y)
    [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]      // right (+X)
  ];

  function start(meta, buf) {
    var M = meta.island, g = M.grid, V = g[3];
    var bd = M.bounds, wx = bd[1] - bd[0], wy = bd[2] - bd[3];
    var P = ortho(bd[0] - wx * MARGIN, bd[1] + wx * MARGIN, bd[2] + wy * MARGIN, bd[3] - wy * MARGIN, bd[4], bd[5]);
    var MVP = mul(P, new Float32Array(M.view));
    var project = function (x, y, z, w) {      // three.js coords -> NDC (w = 0 for a direction)
      return [MVP[0] * x + MVP[4] * y + MVP[8] * z + MVP[12] * w, MVP[1] * x + MVP[5] * y + MVP[9] * z + MVP[13] * w];
    };

    var canvas = document.createElement('canvas');
    canvas.className = 'hero__live';
    canvas.setAttribute('aria-hidden', 'true');
    var gl = canvas.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'low-power' });
    if (!gl) return;

    // faces -> vertices
    var n = M.count, dv = new DataView(buf);
    var pos = new Float32Array(n * 12), col = new Uint8Array(n * 16), info = new Float32Array(n * 8);
    var dir = new Float32Array(n * 12), scr = new Float32Array(n * 8), idx = new Uint16Array(n * 6);
    var blockOf = new Uint16Array(n), sums = {}, all = [0, 0, 0, 0];
    for (var q = 0; q < n; q++) {
      var o = q * 12, i = dv.getUint8(o), j = dv.getUint8(o + 1), k = dv.getUint8(o + 2), fd = dv.getUint8(o + 3);
      var f = fd & 3, flag = fd >> 2, blk = dv.getUint16(o + 8, true), pth = dv.getUint16(o + 10, true);
      var X0 = g[0] + i * V, Y0 = g[1] + j * V, Z0 = g[2] + k * V, cs = CORNERS[f];
      for (var v = 0; v < 4; v++) {
        var c = cs[v], b = (q * 4 + v);
        pos[b * 3] = X0 + c[0] * V; pos[b * 3 + 1] = Z0 + c[2] * V; pos[b * 3 + 2] = Y0 + c[1] * V;
        col[b * 4] = dv.getUint8(o + 4); col[b * 4 + 1] = dv.getUint8(o + 5); col[b * 4 + 2] = dv.getUint8(o + 6);
        info[b * 2] = flag; info[b * 2 + 1] = pth === 65535 ? 2 : pth / 65534;
      }
      idx.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3], q * 6);
      blockOf[q] = blk;
      var s = sums[blk] || (sums[blk] = [0, 0, 0, 0]);
      s[0] += X0; s[1] += Y0; s[2] += Z0; s[3]++;
      all[0] += X0; all[1] += Y0; all[2] += Z0; all[3]++;
    }
    // each block bursts away from the scene's centre (a little upward), with its own strength
    var C = [all[0] / all[3], all[1] / all[3], all[2] / all[3]], blocks = {};
    Object.keys(sums).forEach(function (key) {
      var s = sums[key], cx = s[0] / s[3], cy = s[1] / s[3], cz = s[2] / s[3];
      var dx = cx - C[0], dy = cy - C[1], dz = (cz - C[2]) * 0.6, len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      var h = Math.sin(+key * 12.9898) * 43758.5453, jit = h - Math.floor(h);
      var amp = 6 + 8 * jit;
      var d = [dx / len * amp, (dz / len + 0.35) * amp, dy / len * amp];   // three.js order: X, Z (up), Y
      blocks[key] = { d: d, s: project(cx, cz, cy, 1) };
    });
    for (q = 0; q < n; q++) {
      var B = blocks[blockOf[q]];
      for (v = 0; v < 4; v++) { b = q * 4 + v; dir.set(B.d, b * 3); scr.set(B.s, b * 2); }
    }

    var prog = compile(gl, VS, FS), sprog = compile(gl, SPARK_VS, SPARK_FS);
    function attr(p, name, data, size, type, norm) {
      var loc = gl.getAttribLocation(p, name), bo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, bo); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      return function () { gl.bindBuffer(gl.ARRAY_BUFFER, bo); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, type || gl.FLOAT, !!norm, 0, 0); };
    }
    var binds = [attr(prog, 'aPos', pos, 3), attr(prog, 'aCol', col, 4, gl.UNSIGNED_BYTE, true), attr(prog, 'aInfo', info, 2),
      attr(prog, 'aDir', dir, 3), attr(prog, 'aScr', scr, 2)];
    var ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    var SPARKS = 40, seeds = new Float32Array(SPARKS * 4);
    for (q = 0; q < seeds.length; q++) { var hh = Math.sin(q * 78.233 + 1.7) * 43758.5453; seeds[q] = hh - Math.floor(hh); }
    var sbind = attr(sprog, 'aSeed', seeds, 4);
    var U = {}, SU = {};
    ['uMVP', 'uT', 'uClickT', 'uClick', 'uPulse', 'uPhase'].forEach(function (u) { U[u] = gl.getUniformLocation(prog, u); });
    ['uMVP', 'uT', 'uPx', 'uDoor'].forEach(function (u) { SU[u] = gl.getUniformLocation(sprog, u); });
    gl.useProgram(sprog); gl.uniformMatrix4fv(SU.uMVP, false, MVP); gl.uniform4f(SU.uDoor, M.door[0], M.door[1], M.door[2], M.door[3]);
    gl.useProgram(prog); gl.uniformMatrix4fv(U.uMVP, false, MVP);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 1);

    // the gate's soft halo (the image has it baked in), breathing with the gate
    var glow = document.createElement('div');
    glow.className = 'hero__gate-glow';
    glow.setAttribute('aria-hidden', 'true');
    glow.style.left = M.gate.x * 100 + '%'; glow.style.top = M.gate.y * 100 + '%';
    glow.style.width = M.gate.w * 100 + '%'; glow.style.height = M.gate.h * 100 + '%';

    img.insertAdjacentElement('afterend', canvas);
    canvas.insertAdjacentElement('afterend', glow);

    var cssW = 0, cssH = 0, pxPerUnit = 1;
    function resize() {
      var r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      cssW = r.width; cssH = r.height;
      canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      pxPerUnit = canvas.width / (wx * (1 + 2 * MARGIN));
    }
    resize();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);

    var t0 = performance.now(), clickT = -100, click = [0, 0], explorer = null, eb = blocks[M.explorerBlock];
    function burst(s) {
      if (s <= 0 || s >= 1.8) return 0;
      if (s < 0.22) { var u = 1 - s / 0.22; return 1 - u * u * u; }
      var w = s - 0.22; return Math.exp(-3.6 * w) * Math.cos(7.5 * w);
    }
    function draw(now) {
      var t = (now - t0) / 1000, cyc = t % 9;
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(prog);
      binds.forEach(function (fn) { fn(); });
      gl.uniform1f(U.uT, t); gl.uniform1f(U.uClickT, clickT); gl.uniform2f(U.uClick, click[0], click[1]);
      gl.uniform1f(U.uPhase, Math.sin(t * 2.1));
      gl.uniform1f(U.uPulse, cyc < 5 ? cyc / 5 * 1.15 - 0.05 : -1);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      gl.drawElements(gl.TRIANGLES, n * 6, gl.UNSIGNED_SHORT, 0);
      for (var a = 0; a < 5; a++) gl.disableVertexAttribArray(a);
      gl.useProgram(sprog); sbind();
      gl.uniform1f(SU.uT, t); gl.uniform1f(SU.uPx, pxPerUnit);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
      gl.drawArrays(gl.POINTS, 0, SPARKS);
      gl.disable(gl.BLEND); gl.depthMask(true);
      glow.style.opacity = (0.82 + 0.18 * Math.sin(t * 2.1)).toFixed(3);
      // the explorer rides the landing block
      explorer = explorer || stage.querySelector('.explorer');
      if (explorer && eb) {
        var s = (t - clickT - Math.hypot(eb.s[0] - click[0], eb.s[1] - click[1]) * 0.5) / 1.5, m = burst(s);
        if (m) {
          var d = eb.d.map(function (x) { return Math.floor(x * m / 1.25 + 0.5) * 1.25; }), p = project(d[0], d[1], d[2], 0);
          explorer.style.transform = 'translate(' + (p[0] * cssW / 2).toFixed(1) + 'px,' + (-p[1] * cssH / 2).toFixed(1) + 'px)';
        } else if (explorer.style.transform) explorer.style.transform = '';
      }
    }

    var visible = true, raf = 0, last = 0, shown = false;
    function loop(now) {
      raf = 0;
      if (!visible || document.hidden) return;
      if (now - last >= 32) {                     // about 30 frames a second is plenty for pixel art
        last = now; draw(now);
        if (!shown) { shown = true; stage.classList.add('is-live'); }
      }
      raf = requestAnimationFrame(loop);
    }
    function wake() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(loop); }
    if (window.IntersectionObserver) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; wake(); }).observe(stage);
    document.addEventListener('visibilitychange', wake);
    wake();

    stage.addEventListener('pointerdown', function (e) {
      var t = (performance.now() - t0) / 1000;
      if (t - clickT < 0.8) return;
      var r = canvas.getBoundingClientRect();
      click = [(e.clientX - r.left) / r.width * 2 - 1, 1 - (e.clientY - r.top) / r.height * 2];
      clickT = t;
    });
  }

  function init() {
    var src = stage.getAttribute('data-island') || 'assets/island.bin';
    Promise.all([
      fetch('assets/sculpture.json').then(function (r) { return r.json(); }),
      fetch(src).then(function (r) {
        if (!/\.txt$/.test(src)) return r.arrayBuffer();
        return r.text().then(function (t) {                   // a base64 copy, for hosts that only serve text
          var b = atob(t.trim()), u = new Uint8Array(b.length);
          for (var q = 0; q < b.length; q++) u[q] = b.charCodeAt(q);
          return u.buffer;
        });
      })
    ]).then(function (res) {
      try { start(res[0], res[1]); } catch (err) { if (window.console) console.warn('live island off:', err); }
    }).catch(function () { /* the image stays */ });
  }

  function later() { (window.requestIdleCallback || function (fn) { setTimeout(fn, 400); })(init, { timeout: 2500 }); }
  if (document.readyState === 'complete') later(); else window.addEventListener('load', later);
})();
