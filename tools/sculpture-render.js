/*
 * Blitzedo home sculpture generator (build-time).
 *
 * A lowercase "b" built from small charcoal voxels: arched red doorway, stair
 * wedge, floating rock foundation and loose cubes, drawn isometrically with
 * per-face lighting, ambient occlusion, cast shadows, red rim light and a
 * glowing doorway. The ivory explorer is a smooth sprite on top, as in the
 * approved concept. Everything is seeded, so output is identical every run.
 *
 * Run `node tools/build-sculpture.js` to render assets/sculpture.webp.
 */
(function () {
  'use strict';

  var canvas = document.getElementById('sculpture');
  var ctx = canvas.getContext('2d');

  var K = 2;                     // voxels per unit (unit = layout coordinates below)
  var PX_PER_VOXEL = 5.6;        // output scale
  var UNIT_PX = PX_PER_VOXEL * K;

  /* ---------- palette (red tied to DESIGN.md #D51D22) ---------- */
  var RED_TOP = [255, 54, 46];
  var RED_LEFT = [213, 29, 34];
  var RED_RIGHT = [140, 17, 21];

  /* ---------- noise ---------- */
  function hash3(x, y, z, s) {
    var h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^
            Math.imul(z | 0, 2147483647) ^ Math.imul(s | 0, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  // value noise; scale in units
  function vnoise(x, y, z, sc, s) {
    sc *= K;
    x /= sc; y /= sc; z /= sc;
    var x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
    var fx = smooth(x - x0), fy = smooth(y - y0), fz = smooth(z - z0);
    var c00 = lerp(hash3(x0, y0, z0, s), hash3(x0 + 1, y0, z0, s), fx);
    var c10 = lerp(hash3(x0, y0 + 1, z0, s), hash3(x0 + 1, y0 + 1, z0, s), fx);
    var c01 = lerp(hash3(x0, y0, z0 + 1, s), hash3(x0 + 1, y0, z0 + 1, s), fx);
    var c11 = lerp(hash3(x0, y0 + 1, z0 + 1, s), hash3(x0 + 1, y0 + 1, z0 + 1, s), fx);
    return lerp(lerp(c00, c10, fy), lerp(c01, c11, fy), fz);
  }

  /* ---------- voxel grid (indices are voxels; geometry is written in units) ---------- */
  var OX = 44 * K, OY = 56 * K, OZ = 112 * K;
  var NX = 200 * K, NY = 124 * K, NZ = 250 * K;
  var solid = new Uint8Array(NX * NY * NZ);
  var chips = [];                 // voxels removed after the clean shape is captured (weathering)
  var shape = null;               // clean shape, used for rim light so chips do not read as edges
  function ix(x, y, z) { return ((x + OX) * NY + (y + OY)) * NZ + (z + OZ); }
  function inb(x, y, z) {
    return x + OX >= 0 && y + OY >= 0 && z + OZ >= 0 && x + OX < NX && y + OY < NY && z + OZ < NZ;
  }
  function get(x, y, z) { return inb(x, y, z) ? solid[ix(x, y, z)] : 0; }
  function put(x, y, z, v) { if (inb(x, y, z)) solid[ix(x, y, z)] = v; }
  function un(i) { return (i + 0.5) / K; }    // voxel index -> unit coordinate (center)

  /* Letter plane: X along the face, Z up, Y is depth (front = +Y). Body y in [0,24);
   * the stair wedge sits in front of it, y in [24,33).                              */
  var BODY_Y1 = 24, WEDGE_Y1 = 33;
  var DOOR = { x0: 64, x1: 86, zRect: 36, cx: 75, r: 11, recess: 16 };
  var STEM = { x0: 24, x1: 54, h: 110 };
  var BOWL = { x0: 40, x1: 118, h: 76, rTop: 27, rBot: 17 };
  var LANDING = { x0: 24, x1: 28, z: 50 };

  function inCircle(px, pz, cx, cz, r) { var dx = px - cx, dz = pz - cz; return dx * dx + dz * dz <= r * r; }

  function inLetter(X, Z) {
    if (X >= STEM.x0 && X < STEM.x1 && Z >= 0 && Z < STEM.h) return true;
    if (X >= BOWL.x0 && X < BOWL.x1 && Z >= 0 && Z < BOWL.h) {
      var cxT = BOWL.x1 - BOWL.rTop, czT = BOWL.h - BOWL.rTop;
      if (X > cxT && Z > czT && !inCircle(X, Z, cxT, czT, BOWL.rTop)) return false;
      var cxB = BOWL.x1 - BOWL.rBot, czB = BOWL.rBot;
      if (X > cxB && Z < czB && !inCircle(X, Z, cxB, czB, BOWL.rBot)) return false;
      return true;
    }
    return false;
  }
  function inDoorOpening(X, Z) {
    if (X < DOOR.x0 || X >= DOOR.x1) return false;
    if (Z < DOOR.zRect) return true;
    return inCircle(X, Z, DOOR.cx, DOOR.zRect, DOOR.r);
  }

  // left flight climbs to the landing, right flight descends to the doorway
  var STAIR_X0 = 9;
  function stairTop(X) {
    if (X < STAIR_X0) return 0;
    if (X < LANDING.x0) return 8 * (Math.floor((X - STAIR_X0) / 2.5) + 1);
    if (X < LANDING.x1) return LANDING.z;
    var k = Math.floor((X - LANDING.x1) / 4);
    var z = LANDING.z - 6.25 * k;
    return z > 3 ? z : 0;
  }

  function buildLetter() {
    var i, j, k;
    // main body
    for (i = STEM.x0 * K; i < BOWL.x1 * K; i++) {
      var X = un(i);
      for (k = 0; k < STEM.h * K; k++) {
        var Z = un(k);
        if (!inLetter(X, Z)) continue;
        var edge = !inLetter(X - 0.6, Z) || !inLetter(X + 0.6, Z) || !inLetter(X, Z - 0.6) || !inLetter(X, Z + 0.6);
        for (j = 0; j < BODY_Y1 * K; j++) {
          if (inDoorOpening(X, Z) && j >= (BODY_Y1 - DOOR.recess) * K) continue; // doorway recess
          put(i, j, k, 1);
          if (edge && Z > 2 && hash3(i, j, k, 41) < 0.1) chips.push(ix(i, j, k)); // chipped silhouette
        }
      }
    }
    // small weathering chips in the face, away from the doorway
    for (i = STEM.x0 * K; i < BOWL.x1 * K; i++) {
      for (k = 0; k < STEM.h * K; k++) {
        var jj = BODY_Y1 * K - 1, xu = un(i), zu = un(k);
        if (get(i, jj, k) && hash3(i, 0, k, 43) < 0.006 &&
            !(xu > DOOR.x0 - 4 && xu < DOOR.x1 + 4 && zu < 52)) {
          chips.push(ix(i, jj, k));
          if (hash3(i, 1, k, 44) < 0.5) chips.push(ix(i + 1, jj, k));
          if (hash3(i, 2, k, 44) < 0.3) chips.push(ix(i, jj, k - 1));
        }
      }
    }
    // stair wedge in front of the face
    for (i = STAIR_X0 * K; i < 62 * K; i++) {
      var top = Math.round(stairTop(un(i)) * K);
      for (k = 0; k < top; k++) {
        for (j = BODY_Y1 * K; j < WEDGE_Y1 * K; j++) {
          put(i, j, k, 4);
          if (k > 4 && hash3(i, j, k, 45) < 0.012) chips.push(ix(i, j, k));
        }
      }
    }
    // doorstep: red-lit tiles in front of the door
    for (i = 59 * K; i < 92 * K; i++) {
      for (j = BODY_Y1 * K; j < (BODY_Y1 + 7) * K; j++) {
        if (hash3(i, j, 0, 46) < 0.02) continue;
        put(i, j, 0, 2); put(i, j, 1, 2); put(i, j, 2, 2);
      }
    }
  }

  var PLAT = { x0: -22, x1: 130, y0: -22, y1: 46 };
  var PLAT_CX = (PLAT.x0 + PLAT.x1) / 2, PLAT_CY = (PLAT.y0 + PLAT.y1) / 2;
  var PLAT_AX = (PLAT.x1 - PLAT.x0) / 2, PLAT_AY = (PLAT.y1 - PLAT.y0) / 2;
  // rounded-square distance: 0 at the centre, 1 at the rim
  function platM(x, y) {
    var u = Math.abs(x - PLAT_CX) / PLAT_AX, v = Math.abs(y - PLAT_CY) / PLAT_AY;
    return Math.pow(Math.pow(u, 7) + Math.pow(v, 7), 1 / 7);
  }
  var RIM_M = 0.8;
  function platCell(x, y) { return hash3(Math.floor(x / 3.5), Math.floor(y / 3.5), 0, 2); }

  function buildPlatform() {
    for (var i = PLAT.x0 * K; i < PLAT.x1 * K; i++) {
      for (var j = PLAT.y0 * K; j < PLAT.y1 * K; j++) {
        var x = un(i), y = un(j);
        var m = platM(x, y);
        var n = vnoise(i, j, 0, 6, 1);
        if (m + (n - 0.5) * 0.14 > 1) continue;
        var cellL = platCell(x, y);                                             // chunky 3.5-unit columns
        var cellS = hash3(Math.floor(x / 1.75), Math.floor(y / 1.75), 0, 4);
        var vox = hash3(i, j, 0, 3);
        var core = 1 - m;                                                       // linear taper: inverted pyramid
        var rock = vnoise(i, j, 0, 7, 6);
        var hang = 4 + 74 * Math.pow(core, 1.5) * (0.55 + 0.45 * rock) * (0.62 + 0.76 * cellS) + 10 * Math.pow(cellL, 1.3) * Math.pow(m, 1.2) +
                   1.5 * vox;
        hang = Math.round(hang * K);
        var inFootprint = x > -3 && x < 121 && y > -3 && y < 37;
        var top = -1;
        if (m > RIM_M && !inFootprint) top += Math.round((cellL < 0.28 ? -1.5 : cellL > 0.78 ? 1.5 : 0) * K);   // rim cubes stand out
        else if (!inFootprint && hash3(Math.floor(x / 4.5), Math.floor(y / 4.5), 1, 5) > 0.93) top += 3 * K;
        for (var k = -hang; k <= top; k++) {
          put(i, j, k, 1);
          if (k < -4 * K && vnoise(i, j, k, 3.5, 9) > 0.8) chips.push(ix(i, j, k)); // cracks in the rock
        }
      }
    }
  }

  var CUBES = [
    // x, y, z (bottom), size  (units)
    [-14, 40, -26, 5], [10, 43, -42, 3], [46, 43, -58, 5], [72, 44, -60, 3],
    [102, 43, -46, 5], [126, 35, -30, 4], [28, 46, -54, 3], [90, 44, -38, 3]
  ];
  function buildCubes() {
    CUBES.forEach(function (c, n) {
      var s = c[3] * K;
      for (var a = 0; a < s; a++) for (var b = 0; b < s; b++) for (var d = 0; d < s; d++) {
        if (hash3(a, b, d + n * 7, 60) < 0.08) continue;
        put(c[0] * K + a, c[1] * K + b, c[2] * K + d, 3);
      }
    });
  }

  buildPlatform();
  buildLetter();
  buildCubes();
  shape = solid.slice();
  for (var ci = 0; ci < chips.length; ci++) solid[chips[ci]] = 0;

  /* ---------- projection ---------- */
  var CXs = 0.8660254 * PX_PER_VOXEL, CYs = 0.5 * PX_PER_VOXEL;
  function sx(x, y) { return (x - y) * CXs; }
  function sy(x, y, z) { return (x + y) * CYs - z * PX_PER_VOXEL; }

  var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, X, Y, Z;
  for (X = -OX; X < NX - OX; X++) for (Y = -OY; Y < NY - OY; Y++) for (Z = -OZ; Z < NZ - OZ; Z++) {
    if (!solid[ix(X, Y, Z)]) continue;
    var a1 = sx(X, Y + 1), a2 = sx(X + 1, Y);
    if (a1 < minX) minX = a1;
    if (a2 > maxX) maxX = a2;
    var b1 = sy(X, Y, Z + 1), b2 = sy(X + 1, Y + 1, Z);
    if (b1 < minY) minY = b1;
    if (b2 > maxY) maxY = b2;
  }
  var PAD = 40;
  var W = Math.ceil(maxX - minX + PAD * 2), H = Math.ceil(maxY - minY + PAD * 2);
  canvas.width = W; canvas.height = H;
  var ox = PAD - minX, oy = PAD - minY;
  function px(x, y) { return ox + sx(x, y); }
  function py(x, y, z) { return oy + sy(x, y, z); }

  /* ---------- lighting ---------- */
  var L = (function () { var v = [-0.28, 0.55, 0.8], n = Math.hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n]; })();

  function shadowed(x, y, z, f) {
    var p0 = x + 0.5 + (f === 2 ? 0.6 : 0), p1 = y + 0.5 + (f === 1 ? 0.6 : 0), p2 = z + 0.5 + (f === 0 ? 0.6 : 0);
    for (var t = 1.4; t < 36 * K; t += 1) {
      var qz = Math.floor(p2 + L[2] * t);
      if (qz > 125 * K) break;
      if (get(Math.floor(p0 + L[0] * t), Math.floor(p1 + L[1] * t), qz)) return 1;
    }
    return 0;
  }

  function aoOf(x, y, z, f) {
    var c = 0, w = 0, i, j, r;
    for (r = 1; r <= 2; r++) {
      var wt = r === 1 ? 1 : 0.6;
      for (i = -r; i <= r; i += r) for (j = -r; j <= r; j += r) {
        if (!i && !j) continue;
        c += wt * (f === 0 ? get(x + i, y + j, z + 1) : f === 1 ? get(x + i, y + 1, z + j) : get(x + 1, y + i, z + j));
        w += wt;
      }
    }
    return c / w;
  }

  // distance (in voxels, 1..4) to the nearest convex edge in the face plane, 0 if none
  function rimOf(x, y, z, f) {
    var dirs = f === 0 ? [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]]
             : f === 1 ? [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]
             :           [[0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    var best = 0;
    for (var d = 1; d <= 4; d++) {
      for (var q = 0; q < 4; q++) {
        var v = dirs[q];
        var qx = x + d * v[0], qy = y + d * v[1], qz = z + d * v[2];
        if (!(inb(qx, qy, qz) && shape[ix(qx, qy, qz)])) return d;
      }
    }
    return best;
  }

  var DOOR_BACK_J = (BODY_Y1 - DOOR.recess) * K - 1;
  var DOOR_LEFT_I = DOOR.x0 * K - 1;
  function doorFace(x, y, z, f) {
    var xu = un(x), yu = un(y);
    if (xu < DOOR.x0 - 1 || xu > DOOR.x1 + 1) return 0;
    if (f === 1 && y === DOOR_BACK_J && z >= 0 && un(z) < 49) return 1;                  // back wall
    if (f === 2 && x === DOOR_LEFT_I && y > DOOR_BACK_J && z >= 0 && un(z) < 49) return 2; // left wall
    if (f === 0 && z === -1 && xu >= DOOR.x0 && xu < DOOR.x1 && yu >= BODY_Y1 - DOOR.recess && yu < BODY_Y1) return 3; // floor
    return 0;
  }

  var MOUTH = [75, 27, 14];
  function mix(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
  function mul(c, s) { return [c[0] * s, c[1] * s, c[2] * s]; }

  function shade(x, y, z, f, mat) {
    var xu = un(x), yu = un(y), zu = un(z);

    /* doorway interior: emissive red */
    var df = doorFace(x, y, z, f);
    if (df) {
      var t = Math.min(1, Math.max(0, zu / 46));
      var arch = 1 - Math.abs(xu - DOOR.cx) / 12;
      var glow = df === 1 ? 0.78 + 0.34 * arch * (0.4 + t) : df === 2 ? 0.58 + 0.2 * t : 0.9;
      var gr = 0.9 + 0.2 * hash3(x, y, z, 12) + 0.1 * (vnoise(x, y, z, 1.5, 13) - 0.5);
      var base = df === 2 ? RED_LEFT : RED_TOP;
      return [Math.min(255, base[0] * glow * gr), Math.min(255, base[1] * glow * gr * 0.85), Math.min(255, base[2] * glow * gr * 0.9)];
    }

    /* charcoal stone */
    var jit = (hash3(x, y, z, 10 + f) - 0.5) * 20 + (hash3(x >> 2, y >> 2, z >> 2, 14 + f) - 0.5) * 16 +
              (hash3(Math.floor(x / 6), Math.floor(y / 6), Math.floor(z / 6), 17 + f) - 0.5) * 12 + (vnoise(x, y, z, 2.5, 20) - 0.5) * 14;
    var base0 = f === 0 ? 62 : f === 1 ? 40 : 25;
    var g = base0 + jit;
    // dark seams between larger 3-unit blocks, with the odd gap
    var sa = f === 0 ? x : f === 1 ? x : y, sb = f === 0 ? y : z;
    if ((sa % 6 === 0 || sb % 6 === 0) && hash3(x, y, z, 19) > 0.25) g *= 0.7;
    if (hash3(x, y, z, 21) < 0.012) g *= 0.35;                            // pits
    var ao = aoOf(x, y, z, f);
    g *= 1 - 0.5 * ao;
    var sh = shadowed(x, y, z, f);
    if (sh) g *= 0.5;
    if (z < -6 * K) g *= 1 - 0.32 * Math.min(1, -zu / 70);
    g = Math.max(5, g);
    var stone = [g, g, g * 0.98];

    /* red: flat top surfaces, rim light on convex edges, rare specks */
    var deep = zu < -9 && mat !== 3;
    var rim = rimOf(x, y, z, f);
    var rimP = rim === 0 ? 0 : (mat === 1 && zu <= 0 ? [0, 0.85, 0.6, 0.3, 0.1] : [0, 0.92, 0.82, 0.55, 0.28])[rim];
    var p = 0;
    if (f === 0) {
      var curved = mat === 1 && xu > BOWL.x1 - BOWL.rTop && zu > BOWL.h - BOWL.rTop - 2 && zu > 20 && yu >= 0 && yu < BODY_Y1;
      if (curved) {
        p = (yu > BODY_Y1 - 2.2 || yu < 2.2) ? 0.85 : 0.05;               // red lip on the curved shoulder only
      } else {
        var patch = vnoise(x, y, 0, 8, 31 + (z & 3));
        var onRim = mat === 1 && zu <= 2 && platM(xu, yu) > RIM_M && !(xu > -3 && xu < 121 && yu > -3 && yu < 37);
        if (patch > (zu <= 0 && mat === 1 ? 0.54 : 0.44)) p = hash3(x, y, z, 33) < 0.1 ? 0.2 : 0.95;
        if (mat === 4 || mat === 2) p = 0.93;
        if (onRim) p = platCell(xu, yu) < 0.52 ? 0.96 : 0.06;              // chunky red / black cubes along the rim
        else p = Math.max(p, rimP);
      }
    } else {
      var gate = mat === 3 || mat === 4 ? 1 : (vnoise(x, y, z, 9, 30) > 0.46 ? 1 : 0.25);
      p = rimP * gate;
      if (mat === 2) p = 0.9;
    }
    if (deep) p *= f === 0 ? 0.35 : 0.14;
    var speck = deep ? 0.001 : 0.005;
    var isRed = hash3(x, y, z, 70 + f) < p || hash3(x, y, z, 80 + f) < speck;

    var dx = xu - MOUTH[0], dy = (yu - MOUTH[1]) * 1.1, dz = (zu - MOUTH[2]) * 1.2;
    var spill = (f === 0 ? 0.95 : 0.5) * Math.exp(-(dx * dx + dy * dy + dz * dz) / (2 * 17 * 17));
    if (yu < BODY_Y1) spill *= 0.15;

    var rc = f === 0 ? RED_TOP : f === 1 ? RED_LEFT : RED_RIGHT;
    var rj = 0.78 + 0.36 * hash3(x, y, z, 90) + 0.14 * (vnoise(x, y, z, 1.5, 91) - 0.5);
    var redCol = mul([rc[0], rc[1] * 0.92, rc[2] * 0.92], rj * (sh ? 0.62 : 1) * (1 - 0.38 * ao));

    if (isRed) return redCol;
    if (spill > 0.05) return mix(stone, redCol, Math.min(1, spill * (0.5 + 0.7 * hash3(x, y, z, 95))));
    return stone;
  }

  /* ---------- draw ---------- */
  ctx.clearRect(0, 0, W, H);
  ctx.lineJoin = 'round';

  function rgb(c) { return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'; }

  function face(x, y, z, f, mat) {
    var col = rgb(shade(x, y, z, f, mat)), p;
    if (f === 0) {
      p = [px(x, y), py(x, y, z + 1), px(x + 1, y), py(x + 1, y, z + 1), px(x + 1, y + 1), py(x + 1, y + 1, z + 1), px(x, y + 1), py(x, y + 1, z + 1)];
    } else if (f === 1) {
      p = [px(x, y + 1), py(x, y + 1, z), px(x + 1, y + 1), py(x + 1, y + 1, z), px(x + 1, y + 1), py(x + 1, y + 1, z + 1), px(x, y + 1), py(x, y + 1, z + 1)];
    } else {
      p = [px(x + 1, y), py(x + 1, y, z), px(x + 1, y + 1), py(x + 1, y + 1, z), px(x + 1, y + 1), py(x + 1, y + 1, z + 1), px(x + 1, y), py(x + 1, y, z + 1)];
    }
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]); ctx.lineTo(p[2], p[3]); ctx.lineTo(p[4], p[5]); ctx.lineTo(p[6], p[7]);
    ctx.closePath();
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 0.8;
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.26)'; ctx.lineWidth = 0.45;       // fine voxel seam
    ctx.stroke();
  }

  for (X = -OX; X < NX - OX; X++) {
    for (Y = -OY; Y < NY - OY; Y++) {
      for (Z = -OZ; Z < NZ - OZ; Z++) {
        var m = solid[ix(X, Y, Z)];
        if (!m) continue;
        if (!get(X, Y + 1, Z)) face(X, Y, Z, 1, m);
        if (!get(X + 1, Y, Z)) face(X, Y, Z, 2, m);
        if (!get(X, Y, Z + 1)) face(X, Y, Z, 0, m);
      }
    }
  }

  /* ---------- doorway bloom ---------- */
  (function bloom() {
    var cx = px(DOOR.cx * K, BODY_Y1 * K), cy = py(DOOR.cx * K, BODY_Y1 * K, 22 * K);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 34 * UNIT_PX);
    g.addColorStop(0, 'rgba(255,40,34,0.32)');
    g.addColorStop(0.45, 'rgba(230,28,30,0.12)');
    g.addColorStop(1, 'rgba(213,29,34,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var fx = px(DOOR.cx * K, (BODY_Y1 + 8) * K), fy = py(DOOR.cx * K, (BODY_Y1 + 8) * K, 0);
    var g2 = ctx.createRadialGradient(fx, fy, 0, fx, fy, 26 * UNIT_PX);
    g2.addColorStop(0, 'rgba(255,42,36,0.2)');
    g2.addColorStop(1, 'rgba(213,29,34,0)');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  })();

  /* ---------- explorer: smooth ivory sprite with a red scarf ---------- */
  (function explorer() {
    var fxp = px((LANDING.x0 + 1.8) * K, 29 * K), fyp = py((LANDING.x0 + 1.8) * K, 29 * K, LANDING.z * K);
    var s = UNIT_PX * 1.02;                       // 1 sprite unit
    ctx.save();
    ctx.translate(fxp, fyp);
    ctx.scale(s, s);
    var IV = '#F6F1E7', IV_SH = '#D3CCBC', IV_DK = '#A9A294', RD = '#E5262B', RD_DK = '#A5141A';

    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    ctx.fillStyle = 'rgba(0,0,0,0.55)';                           // contact shadow
    ctx.beginPath(); ctx.ellipse(1.4, 0.2, 3.6, 1.1, -0.1, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = RD;                                           // scarf tail, trailing left
    ctx.beginPath();
    ctx.moveTo(-1.0, -12.4); ctx.lineTo(-5.6, -11.4); ctx.lineTo(-10.4, -9.2); ctx.lineTo(-9.2, -8.4);
    ctx.lineTo(-11.0, -7.8); ctx.lineTo(-8.6, -7.5); ctx.lineTo(-5.4, -9.0); ctx.lineTo(-1.2, -10.6);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = RD_DK;
    ctx.beginPath(); ctx.moveTo(-5.6, -11.4); ctx.lineTo(-10.4, -9.2); ctx.lineTo(-9.6, -8.8); ctx.lineTo(-5.4, -10.4); ctx.closePath(); ctx.fill();

    ctx.fillStyle = IV_SH; roundRect(0.0, -4.8, 1.5, 4.8, 0.7); ctx.fill();    // back leg
    ctx.fillStyle = IV;    roundRect(2.1, -5.0, 1.6, 5.0, 0.8); ctx.fill();    // front leg
    ctx.fillStyle = IV_SH; ctx.beginPath(); ctx.ellipse(0.7, -0.2, 1.0, 0.55, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = IV;    ctx.beginPath(); ctx.ellipse(3.0, -0.2, 1.1, 0.55, 0, 0, Math.PI * 2); ctx.fill();

    var gb = ctx.createLinearGradient(-2.2, 0, 4.0, 0);                       // tunic, slight forward lean
    gb.addColorStop(0, IV_DK); gb.addColorStop(0.4, IV); gb.addColorStop(1, IV);
    ctx.fillStyle = gb;
    ctx.beginPath();
    ctx.moveTo(-1.2, -11.2); ctx.quadraticCurveTo(2.4, -12.1, 4.3, -10.8); ctx.lineTo(4.5, -5.8);
    ctx.quadraticCurveTo(1.9, -4.7, -1.9, -5.4); ctx.quadraticCurveTo(-2.2, -8.2, -1.2, -11.2);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = RD_DK;                                                    // red lining under the hem
    ctx.beginPath(); ctx.moveTo(2.2, -6.0); ctx.lineTo(3.6, -5.9); ctx.lineTo(3.4, -4.9); ctx.lineTo(2.3, -5.0); ctx.closePath(); ctx.fill();

    ctx.fillStyle = IV;                                                        // arm
    ctx.beginPath();
    ctx.moveTo(3.8, -10.4); ctx.quadraticCurveTo(6.0, -8.8, 6.8, -7.4); ctx.lineTo(6.0, -7.0);
    ctx.quadraticCurveTo(4.8, -8.2, 3.4, -8.6); ctx.closePath(); ctx.fill();

    var gh = ctx.createLinearGradient(-2.2, 0, 4.4, 0);                       // head
    gh.addColorStop(0, IV_SH); gh.addColorStop(0.4, IV); gh.addColorStop(1, '#FFFFFF');
    ctx.fillStyle = gh; roundRect(-2.2, -19.0, 6.8, 7.0, 3.0); ctx.fill();
    ctx.fillStyle = '#0B0B0A'; roundRect(2.4, -16.9, 1.8, 2.4, 0.3); ctx.fill(); // visor

    ctx.fillStyle = RD;                                                        // scarf collar
    ctx.beginPath();
    ctx.moveTo(-2.4, -12.8); ctx.quadraticCurveTo(1.0, -11.3, 4.8, -12.6); ctx.lineTo(4.7, -11.4);
    ctx.quadraticCurveTo(1.2, -10.1, -2.4, -11.5); ctx.closePath(); ctx.fill();
    ctx.restore();
  })();

  window.__sculptureSize = [W, H];
  window.__sculptureReady = true;
})();
