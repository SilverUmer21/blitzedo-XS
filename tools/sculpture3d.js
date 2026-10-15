/*
 * Blitzedo home sculpture (build-time, three.js).
 *
 * A lowercase "b" standing on a floating round island, all built from the same large
 * charcoal stone cubes: 15-unit cubes for flat runs and 7.5 / 3.75-unit blocks where the
 * shape curves or steps (the b's rounded bowl, its arch and stairs; the island's cone).
 * No block is painted red: the red is light. A strong red spotlight from above-left lights
 * tops and edges and casts shadows, red lights in the doorway spill onto the floor and
 * steps, thin red area lights run along the b's edges, and a near-black fill keeps the
 * rest of the stone almost black. Everything is seeded, so the render is identical on
 * every run.
 *
 * Scene axes (units): X runs along the face of the b, Z is up, Y is depth (front = +Y).
 * three.js maps these to x = X, y = Z, z = Y.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

RectAreaLightUniformsLib.init();

const UNIT_PX = 10.6;          // output pixels per unit

/* ---------- seeded noise ---------- */
function hash3(x, y, z, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647) ^ Math.imul(s | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
function vnoise(x, y, z, sc, s) {
  x /= sc; y /= sc; z /= sc;
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
  const fx = smooth(x - x0), fy = smooth(y - y0), fz = smooth(z - z0);
  const c00 = lerp(hash3(x0, y0, z0, s), hash3(x0 + 1, y0, z0, s), fx);
  const c10 = lerp(hash3(x0, y0 + 1, z0, s), hash3(x0 + 1, y0 + 1, z0, s), fx);
  const c01 = lerp(hash3(x0, y0, z0 + 1, s), hash3(x0 + 1, y0, z0 + 1, s), fx);
  const c11 = lerp(hash3(x0, y0 + 1, z0 + 1, s), hash3(x0 + 1, y0 + 1, z0 + 1, s), fx);
  return lerp(lerp(c00, c10, fy), lerp(c01, c11, fy), fz);
}

/* ---------- layout (units) ----------
 * Measured from the reference (a coordinate grid laid over the b): the stem is two cubes wide and a cube and a half deep,
 * the bowl is a cube and a half deeper and runs 60 units past the stem with a big rounded top-right corner, the arched
 * door sits one gap-width from the stem with a one-cube recess, and the stairs are one prism in front of the wall: three
 * steps up to a small landing, then a thin ribbon of small steps down to the doorstep. The front faces of stem and bowl
 * are flush. */
const G = 3.75;                                    // finest letter cell; aligned groups merge into 7.5 and 15-unit cubes: the island's three tiers
const BODY_Y1 = 45;                                // front plane of the letter
const JF = BODY_Y1 / G;                            // cells through the depth of the bowl
// Measured from the reference on a fine grid, in units of the stem's width (2 cubes = 30):
const STEM = { x0: 30, x1: 60, h: 105, y0: 15 };  // 2 big cubes wide, 2 deep, 7 tall
const BOWL = { x0: 45, x1: 120, h: 60, rTop: 30, rBot: 0, y0: 15 };    // 2 big cubes deep and 4 tall: the right end is two big cubes thick, the curve carved from them
const DOOR = { x0: 60, x1: 90, zRect: 33.75, cx: 75, r: 15, recessY: 30 };   // starts at the stem's front corner; deep recess so the red inner wall shows   // narrow arch starting just right of the stem, 11.25 deep
const LANDING_Z = 52.5;                            // the landing against the stem where the explorer stands
const STAIR_Y1 = 60;                               // the stair block stands one cube proud of the b's face
const CELL = 15;                                   // island top cube; tiers below are CELL/2 and CELL/4
const PLAT_CX = 70, PLAT_CY = 34, PLAT_AX = 74, PLAT_AY = 46;   // island footprint, centred under the b

const inCircle = (x, z, cx, cz, r) => (x - cx) ** 2 + (z - cz) ** 2 <= r * r;
const inStem = (X, Z) => X >= STEM.x0 && X < STEM.x1 && Z >= 0 && Z < STEM.h;
function inBowl(X, Z) {
  if (X < BOWL.x0 || X >= BOWL.x1 || Z < 0 || Z >= BOWL.h) return false;
  const Xs = Math.floor(X / 7.5) * 7.5 + 3.75, Zs = Math.floor(Z / 7.5) * 7.5 + 3.75;   // the arc is cut on a half-cube grid: big cubes, a few half cubes on the curve
  const cxT = BOWL.x1 - BOWL.rTop, czT = BOWL.h - BOWL.rTop;
  if (Xs > cxT && Zs > czT && !inCircle(Xs, Zs, cxT, czT, BOWL.rTop)) return false;
  const cxB = BOWL.x1 - BOWL.rBot, czB = BOWL.rBot;
  if (Xs > cxB && Zs < czB && !inCircle(Xs, Zs, cxB, czB, BOWL.rBot)) return false;
  return true;
}
const inLetter = (X, Z) => inStem(X, Z) || inBowl(X, Z);
function inDoorOpening(X, Z) {
  if (X < DOOR.x0 || X >= DOOR.x1) return false;
  if (Z < DOOR.zRect) return true;
  return inCircle(X, Z, DOOR.cx, DOOR.zRect, DOOR.r);
}
/* ---------- blocks ---------- */
// block: { X, Y, Z (centre, scene units), s (size), f: [6 face tokens], t (brightness tint) }
// face order matches BoxGeometry: +x, -x, +y(up), -y, +z(front, scene +Y), -z
const blocks = [];
const cv = (a, b, c, n) => 'c' + Math.floor(hash3(a, b, c, 200 + n) * 4);
const baseFaces = () => ['c0', 'c0', 'c0', 'c0', 'c0', 'c0'];

/* ----- letter cells at G ----- */
const grid = new Map();
const gk = (i, j, k) => i + ',' + j + ',' + k;
const has = (i, j, k) => grid.has(gk(i, j, k));
const kindAt = (i, j, k) => grid.get(gk(i, j, k));
const cen = (i) => (i + 0.5) * G;

function buildLetter() {
  const chips = [];
  const put = (i, j, k, kind) => grid.set(gk(i, j, k), kind);
  const putBox = (x0, x1, y0, y1, z0, z1, kind) => {                       // all cells whose centres fall inside the box (units)
    for (let i = Math.round(x0 / G); i < Math.round(x1 / G); i++) for (let j = Math.round(y0 / G); j < Math.round(y1 / G); j++) for (let k = Math.round(z0 / G); k < Math.round(z1 / G); k++) put(i, j, k, kind);
  };
  // body: the bowl is 30 deep, the stem 22.5 deep, fronts flush
  for (let i = Math.round(STEM.x0 / G); i < Math.round(BOWL.x1 / G); i++) {
    for (let k = 0; k < Math.round(STEM.h / G); k++) {
      const X = cen(i), Z = cen(k);
      if (!inLetter(X, Z)) continue;
      const j0 = Math.round((inBowl(X, Z) ? BOWL.y0 : STEM.y0) / G);
      for (let j = j0; j < JF; j++) {
        if (inDoorOpening(X, Z) && cen(j) > DOOR.recessY) continue;       // recess: one cube deep
        put(i, j, k, 'body');
      }
    }
  }
  // nothing left of the stem; the stairs are built in emitStairs. Doorstep in front of the door:
  putBox(63.75, 93.75, 45, 52.5, 0, 3.75, 'step');
  chips.forEach(([i, j, k]) => grid.delete(gk(i, j, k)));
}

// Stairs, as in the reference. A landing against the stem (x 30..45, 52.5 high) where the explorer stands, on a block one cube proud of
// the b's face; three steps come forward toward the viewer. Then a flight of five steps (3.75 run, 7.5 rise) runs right along the wall,
// as deep as the landing block, down to the doorstep. Everything is stacked 3.75-unit blocks, so the walls under the steps read as fine masonry.
function emitStairs() {
  const q = 3.75;
  let c = 0;
  const stack = (X, Y, top) => {
    const n = Math.round(top / q);
    for (let k = 0; k < n; k++) {
      const f = baseFaces();
      f[2] = 'c' + Math.floor(hash3(c, k, 0, 250) * 4); f[0] = 'c' + Math.floor(hash3(c, k, 1, 251) * 4); f[4] = 'c' + Math.floor(hash3(c, k, 2, 252) * 4);
      blocks.push({ X, Y, Z: k * q + q / 2, s: q, f, t: k === n - 1 ? 0.95 : 0.5 + 0.35 * hash3(c, k, 3, 253) });
    }
    c++;
  };
  const firstFlight = [52.5, 48.75, 45, 41.25];                       // landing row, then three steps toward the viewer
  for (let r = 0; r < 4; r++) for (let x = 0; x < 4; x++) stack(30 + q / 2 + x * q, 45 + q / 2 + r * q, firstFlight[r]);
  for (let st = 0; st < 5; st++) for (let r = 0; r < 4; r++) stack(45 + q / 2 + st * q, 45 + q / 2 + r * q, 37.5 - st * 7.5);
}

/* merge aligned groups into the island's three tiers: 15-unit cubes (4x4x4 cells) where a full group fits, else 7.5-unit blocks
   (2x2x2), else 3.75-unit blocks. Flat runs become big cubes; the bowl's curve and the arch fall to the small blocks. */
function emitLetter() {
  const done = new Set();
  const emit = (i, j, k, n) => {              // cube covering cells [i,i+n) x [j,j+n) x [k,k+n)
    const s = n * G, X = (i + n / 2) * G, Y = (j + n / 2) * G, Z = (k + n / 2) * G;
    const anyCell = (fn) => { for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (fn(a, b)) return true; return false; };
    const f = baseFaces();
    const hid = (a, b, c) => 'c' + Math.floor(hash3(i + a, j + b, k + c, 210) * 4);
    // +x
    if (anyCell((b, c) => !has(i + n, j + b, k + c))) {
      const leftWall = anyCell((b, c) => !has(i + n, j + b, k + c) && cen(j + b) > DOOR.recessY) && X < DOOR.x0 && X > DOOR.x0 - s && Z < DOOR.zRect + DOOR.r - 2;
      f[0] = leftWall ? 'd1' : hid(1, 0, 0);
    }
    // +Y front
    if (anyCell((a, c) => !has(i + a, j + n, k + c))) {
      const backWall = Y > DOOR.recessY - s && Y < DOOR.recessY + s && X >= DOOR.x0 && X < DOOR.x1 && Z < DOOR.zRect + DOOR.r;
      f[4] = backWall && !has(i, j + n, k) ? 'd0' : hid(0, 1, 0);
    }
    // top
    if (anyCell((a, b) => !has(i + a, j + b, k + n))) f[2] = hid(0, 0, 1);
    // tint: darker in tight corners; a share of the blocks are near-black stone so the tops alternate red and black
    let occ = 0;
    for (let a = -1; a <= n; a++) for (let b = -1; b <= n; b++) for (let c = -1; c <= n; c++) if (has(i + a, j + b, k + c) && (a < 0 || b < 0 || c < 0 || a >= n || b >= n || c >= n)) occ++;
    const faceCells = 6 * n * n + 12 * n + 8;
    const ao = 1 - Math.max(0, occ / faceCells - 0.5);
    const kind = kindAt(i, j, k);
    const curved = n < 4 && kind === 'body' && X > BOWL.x1 - BOWL.rTop && Z > BOWL.h - BOWL.rTop - 6;
    const pDark = curved ? 0.45 : kind === 'stair' || kind === 'step' ? 0 : n === 4 ? 0.22 : 0.3;     // step treads are always red-lit
    blocks.push({ X, Y, Z, s, f, t: (hash3(i, j, k, 303) < pDark ? 0.04 : 0.85 + 0.3 * hash3(i, j, k, 300)) * Math.max(0.55, ao) });
  };
  const full = (i0, j0, k0, n, kind) => {
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) for (let c = 0; c < n; c++) {
      const kk = gk(i0 + a, j0 + b, k0 + c);
      if (!grid.has(kk) || grid.get(kk) !== kind || done.has(kk)) return false;
    }
    return true;
  };
  for (const [key] of grid) {
    if (done.has(key)) continue;
    const [i, j, k] = key.split(',').map(Number);
    const kind = grid.get(key);
    let n = 4, i0 = Math.floor(i / 4) * 4, j0 = Math.floor(j / 4) * 4, k0 = Math.floor(k / 4) * 4;
    if (!full(i0, j0, k0, 4, kind)) {
      n = 2; i0 = Math.floor(i / 2) * 2; j0 = Math.floor(j / 2) * 2; k0 = Math.floor(k / 2) * 2;
      if (!full(i0, j0, k0, 2, kind)) { n = 1; i0 = i; j0 = j; k0 = k; }
    }
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) for (let c = 0; c < n; c++) done.add(gk(i0 + a, j0 + b, k0 + c));
    emit(i0, j0, k0, n);
  }
}

/* ----- floating island: a round disc of 15-unit cubes over a deep, pointed gem cone. Under the top layer,
 *       7.5- and 3.75-unit cubes step down along a smooth cone profile ----- */
const rOf = (x, y) => Math.pow(Math.abs((x - PLAT_CX) / PLAT_AX) ** 3 + Math.abs((y - PLAT_CY) / PLAT_AY) ** 3, 1 / 3);   // 0 at the centre, 1 at the rim
function bowlDepth(x, y) {
  const r = Math.min(1, rOf(x, y));
  return 15 + 52 * Math.pow(1 - r, 0.9);                             // rim ~15 deep, centre ~107: a pointed gem, stepped by the cube tiers
}
const tierFaces = (h) => {
  const f = baseFaces();
  f[0] = cv(h, 0, 1, 1); f[4] = cv(h, 1, 1, 2); f[2] = cv(h, 2, 1, 3);
  return f;
};
const shadeDepth = (Z) => 1 - 0.4 * Math.min(1, Math.max(0, -Z / 100));
const darkCube = (a, b, c) => hash3(a, b, c, 302) < 0.4;                  // some cubes are near-black stone, so tops alternate red / black
const tintOf = (a, b, c, Z) => (darkCube(a, b, c) ? 0.03 : 0.45 + 0.8 * hash3(a, b, c, 301)) * shadeDepth(Z);
function emitPlatform() {
  for (let ci = -6; ci <= 14; ci++) {
    for (let cj = -8; cj <= 10; cj++) {
      const x = ci * CELL + CELL / 2, y = cj * CELL + CELL / 2;               // cell edges line up with the letter's 15-unit cubes
      const rr = rOf(x, y);
      if (rr > 1.0) continue;
      const r = hash3(ci, cj, 0, 2);
      const ring = rr > 0.8;
      const flat = cj >= 0 && cj <= 3 && x > -30 && x < 135;                  // keeps its height: under the letter, the stairs and the doorstep
      const under = cj >= 1 && cj <= 2 && x > 30 && x < 105;                       // hidden under the letter: no checker
      let top = 0;
      if (ring && !flat) top = r < 0.28 ? -CELL / 2 : r > 0.72 ? CELL / 2 : 0;  // uneven rim: cubes stand at three heights
      const D = bowlDepth(x, y) * (0.96 + 0.08 * hash3(ci, cj, 1, 4));
      const n1 = ring ? 1 : 1 + Math.floor(Math.max(0, D - CELL) / 40);
      const sy = ring ? [15, 22.5, 30][Math.floor(hash3(ci, cj, 2, 9) * 3)] : CELL;   // and hang to three depths, so the front is a broken, uneven edge
      const drop1 = ring ? sy : n1 * CELL;
      if (ring && !flat && hash3(ci, cj, 3, 11) < 0.22) {                    // a broken rim cube: four half cubes at mixed heights instead
        for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
          const hh = ci * 53 + cj * 17 + a * 3 + b, up = [7.5, 0, -7.5][Math.floor(hash3(hh, 1, 0, 12) * 3)];
          if (hash3(hh, 2, 0, 13) < 0.2) continue;                            // one may be missing
          for (let q = 0; q < 3; q++) blocks.push({ X: x - 3.75 + a * 7.5, Y: y - 3.75 + b * 7.5, Z: up - 3.75 - q * 7.5, s: 7.5, f: tierFaces(hh * 5 + q), t: q === 0 ? (hash3(hh, 3, 0, 14) < 0.4 ? 0.04 : 0.95) : tintOf(hh, q, 4, -q * 7.5) });
        }
        continue;
      }
      // tier 1: 15-unit cubes (stretched for the outer ring)
      for (let q = 0; q < n1; q++) {
        const Z = top - sy / 2 - q * CELL;
        const f = tierFaces(ci * 31 + cj * 7 + q);
        if (q === 0 && x > DOOR.x0 && x < DOOR.x1 && y > DOOR.recessY && y < BODY_Y1) f[2] = 'd0';   // door floor glows
        const checkerDark = q === 0 && !under && ((ci + cj) & 1) === (hash3(ci, cj, 5, 7) < 0.25 ? 1 : 0);   // mostly alternating red-lit / near-black tops, a few swapped
        blocks.push({ X: x, Y: y, Z, s: CELL, sy, f, t: checkerDark ? 0.04 : q === 0 && !under ? 0.75 + 0.45 * hash3(ci, cj, q, 301) : tintOf(ci, cj, q, Z) });
      }
      const z1 = top - drop1;
      // tier 2: 7.5-cubes in a 2x2 pattern, depth read from the cone profile at each sub-column
      const h2 = CELL / 2, q4 = CELL / 4;
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
        const xs = x - q4 + a * h2, ys = y - q4 + b * h2, hh = ci * 977 + cj * 131 + a * 17 + b * 5;
        const D2 = bowlDepth(xs, ys) * (0.9 + 0.2 * hash3(hh, 0, 0, 240)) - drop1;
        const len2 = Math.max(0, Math.round(0.7 * D2 / h2));
        for (let q = 0; q < len2; q++) {
          const Z = z1 - h2 / 2 - q * h2;
          blocks.push({ X: xs, Y: ys, Z, s: h2, f: tierFaces(hh * 7 + q), t: tintOf(hh, q, 2, Z) });
        }
        // tier 3: 3.75-cubes under each, again 2x2
        const z2 = z1 - len2 * h2;
        for (let c = 0; c < 2; c++) for (let d = 0; d < 2; d++) {
          const xt = xs - q4 / 2 + c * q4, yt = ys - q4 / 2 + d * q4, h3 = hh * 13 + c * 3 + d;
          const D3 = bowlDepth(xt, yt) * (0.85 + 0.3 * hash3(h3, 0, 0, 241)) - drop1 - len2 * h2;
          const len3 = Math.min(7, Math.max(0, Math.round(1.0 * D3 / q4)));
          for (let q = 0; q < len3; q++) {
            const Z = z2 - q4 / 2 - q * q4;
            blocks.push({ X: xt, Y: yt, Z, s: q4, f: tierFaces(h3 * 5 + q), t: tintOf(h3, q, 3, Z) });
          }
        }
      }
    }
  }
}

/* ----- loose floating cubes ----- */
const LOOSE = [
  // x, y, z (centre), size
  [-8, 70, -34, 11.25], [14, 92, -62, 7.5], [56, 100, -88, 15],
  [112, 98, -70, 7.5], [150, 80, -52, 15], [170, 44, -30, 11.25]
];
function emitLoose() {
  LOOSE.forEach(([X, Y, Z, s], n) => blocks.push({ X, Y, Z, s, f: tierFaces(900 + n), t: 0.85 }));
}

/* ---------- chunky chipped-stone pixel textures ---------- */
function texelsFor(s) { return s <= 4 ? 6 : s <= 8 ? 8 : s <= 10 ? 9 : s <= 12 ? 12 : 14; }
const texCache = new Map();
function makeTexture(kind, variant, n) {
  const key = kind + variant + '_' + n;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d');
  const img = g.createImageData(n, n);
  const seed = (kind.charCodeAt(0) * 31 + variant * 977 + n * 7) | 0;
  const rnd = (x, y, s) => hash3(x, y, seed, s);
  // Voronoi chips: each texel belongs to its nearest site; each site has its own brightness
  const sites = [];
  const count = Math.max(4, Math.round(n * n / 11));
  for (let i = 0; i < count; i++) sites.push({ x: rnd(i, 0, 1) * n, y: rnd(i, 1, 2) * n, v: 0.55 + 0.5 * Math.pow(rnd(i, 2, 3), 1.2) });
  const owner = new Int16Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let best = 0, bd = 1e9;
    sites.forEach((s, i) => { const d = (s.x - x - 0.5) ** 2 + (s.y - y - 0.5) ** 2; if (d < bd) { bd = d; best = i; } });
    owner[y * n + x] = best;
  }
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const o = owner[y * n + x];
      let f = sites[o].v;
      const edge = (x > 0 && owner[y * n + x - 1] !== o) || (y > 0 && owner[(y - 1) * n + x] !== o);
      if (edge && rnd(x, y, 4) < 0.45) f *= 0.7;                           // cracks between chips
      if (rnd(x, y, 5) < 0.02) f *= 0.6;                                   // pits
      if (rnd(x, y, 6) < 0.025) f *= 1.25;                                  // chalky flecks
      // bevel: lit top-left edges, shaded bottom-right
      if (y === 0) f *= 1.7;
      if (x === 0) f *= 1.25;
      if (y === n - 1) f *= 0.6;
      if (x === n - 1) f *= 0.7;
      const v = Math.max(0, Math.min(255, 124 * f));
      const p = (y * n + x) * 4;
      img.data[p] = v; img.data[p + 1] = v * 0.985; img.data[p + 2] = v * 0.96; img.data[p + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

const matCache = new Map();
function material(token, n) {
  const key = token + '_' + n;
  if (matCache.has(key)) return matCache.get(key);
  const kind = token[0], v = +token.slice(1);
  let m;
  if (kind === 'c') {
    m = new THREE.MeshStandardMaterial({ map: makeTexture('c', v, n), roughness: 0.62, metalness: 0 });
  } else {
    // doorway interior: light-emitting surfaces (the doorway is the glowing source in the scene)
    const t = makeTexture('c', v, n);
    m = new THREE.MeshStandardMaterial({ map: t, color: 0xff2a1e, roughness: 0.7, emissive: 0xff1a12, emissiveMap: t, emissiveIntensity: v === 0 ? 1.7 : 1.0 });
  }
  matCache.set(key, m);
  return m;
}

/* ---------- build ---------- */
buildLetter();
emitLetter();
emitStairs();
emitPlatform();
emitLoose();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const groups = new Map();
for (const b of blocks) {
  const key = b.s + 'x' + (b.sy || b.s) + '|' + b.f.join(',');
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(b);
}
const geoCache = new Map();
const darkCubes = [];
const col = new THREE.Color();
const dummy = new THREE.Object3D();
for (const [, list] of groups) {
  const s = list[0].s, sy = list[0].sy || s;
  const gkey = s + 'x' + sy;
  if (!geoCache.has(gkey)) geoCache.set(gkey, new THREE.BoxGeometry(s * 0.95, sy * 0.95, s * 0.95));
  const n = texelsFor(s);
  const mesh = new THREE.InstancedMesh(geoCache.get(gkey), list[0].f.map((t) => material(t, n)), list.length);
  list.forEach((b, i) => {
    dummy.position.set(b.X, b.Z, b.Y);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    if (b.t < 0.1) {                                                        // near-black stone: sits in the red key's shadow (below), so its top shows the grey fill
      col.setScalar(0.34);                                                // dim surface: the other red lights barely touch it, the fill shows it as dark stone
      darkCubes.push(b);
    } else col.setScalar(Math.min(1.3, b.t));
    mesh.setColorAt(i, col);
  });
  mesh.castShadow = true; mesh.receiveShadow = true;
  scene.add(mesh);
}

/* invisible plates just above the near-black cubes: they cast a shadow from the key light only */
{
  const plate = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }), darkCubes.length);
  darkCubes.forEach((b, i) => {
    dummy.position.set(b.X, b.Z + (b.sy || b.s) / 2 + 0.7, b.Y);
    dummy.scale.set(b.s * 1.02, 0.4, b.s * 1.02);
    dummy.updateMatrix();
    plate.setMatrixAt(i, dummy.matrix);
  });
  dummy.scale.set(1, 1, 1);
  plate.castShadow = true;
  scene.add(plate);
}

/* ---------- explorer (self-lit ivory so the red light does not tint him) ---------- */
(function explorer() {
  const g = new THREE.Group();
  // bright ivory, self-lit so the red light does not tint him; a darker twin gives the form some shading
  const ivory = new THREE.MeshStandardMaterial({ color: 0xa09b90, roughness: 0.55, emissive: 0xf6f1e6, emissiveIntensity: 0.78 });
  const ivoryShade = new THREE.MeshStandardMaterial({ color: 0x77736a, roughness: 0.7, emissive: 0xd8d1c2, emissiveIntensity: 0.6 });
  const red = new THREE.MeshStandardMaterial({ color: 0xe5262b, roughness: 0.7, emissive: 0xd01c20, emissiveIntensity: 0.6, side: THREE.DoubleSide });
  const redDark = new THREE.MeshStandardMaterial({ color: 0x8a1014, roughness: 0.8, emissive: 0x6a0a0e, emissiveIntensity: 0.6, side: THREE.DoubleSide });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0b0b0a, roughness: 0.4 });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
  };
  // short legs and small feet
  add(new THREE.CapsuleGeometry(0.9, 2.0, 4, 10), ivoryShade, -0.4, 2.2, -1.4);
  add(new THREE.CapsuleGeometry(0.9, 2.0, 4, 10), ivory, 0.9, 2.2, 1.4);
  add(new THREE.SphereGeometry(1.0, 12, 8), ivoryShade, 0.1, 0.5, -1.4).scale.set(1.3, 0.55, 0.9);
  add(new THREE.SphereGeometry(1.0, 12, 8), ivory, 1.5, 0.5, 1.4).scale.set(1.3, 0.55, 0.9);
  // bell-shaped tunic with a red lining at the hem
  add(new THREE.CylinderGeometry(2.1, 3.5, 6.8, 20), ivory, 0.3, 7.0, 0);
  add(new THREE.CylinderGeometry(3.4, 3.4, 0.45, 20), red, 0.3, 3.9, 0).scale.set(0.96, 1, 0.96);
  // arms: one reaching toward the stairs, one tucked back
  add(new THREE.CapsuleGeometry(0.7, 2.8, 4, 8), ivory, 2.4, 7.6, 2.5, 0.4, 0, -0.95);
  add(new THREE.CapsuleGeometry(0.65, 2.4, 4, 8), ivoryShade, 1.2, 7.9, -2.5, -0.2, 0, -0.3);
  // large rounded head with a dark visor on the side facing the stairs
  add(new RoundedBoxGeometry(6.8, 6.4, 6.6, 4, 2.7), ivory, 0.7, 13.2, 0);
  add(new THREE.BoxGeometry(0.5, 2.5, 2.4), dark, 4.15, 13.5, 0.9);
  // scarf: collar, a short knot, and a notched tail trailing left
  add(new THREE.TorusGeometry(2.7, 0.7, 8, 24), red, 0.5, 10.1, 0, Math.PI / 2, 0, 0).scale.set(1, 1, 0.92);
  const tail = new THREE.Shape();
  tail.moveTo(0, 0.5); tail.lineTo(-4.8, 2.9); tail.lineTo(-11.0, 4.9); tail.lineTo(-9.2, 2.8); tail.lineTo(-12.0, 1.7);
  tail.lineTo(-8.8, 0.2); tail.lineTo(-4.4, -2.2); tail.lineTo(0, -2.8); tail.closePath();
  add(new THREE.ExtrudeGeometry(tail, { depth: 0.45, bevelEnabled: false }), red, -1.2, 10.5, -0.2, 0, 0.15, 0);
  add(new THREE.ExtrudeGeometry(tail, { depth: 0.3, bevelEnabled: false }), redDark, -1.0, 9.9, -0.9, 0, 0.35, 0.05).scale.set(0.7, 0.6, 1);
  g.scale.setScalar(0.95);
  g.position.set(37.5, LANDING_Z, 47);
  scene.add(g);
})();

/* ---------- lights: red is the main light; the white fill is almost nothing ---------- */
scene.add(new THREE.AmbientLight(0xffffff, 0.075));
scene.add(new THREE.HemisphereLight(0xb8b4c0, 0x120c0c, 0.1));
const fill = new THREE.DirectionalLight(0xc8ccd8, 0.26);              // keeps the left faces a touch lighter than the right
fill.position.set(-80, 70, 160);
scene.add(fill);

// The red key: a spotlight high up, left and slightly in front. Its soft cone makes a pool of light that is
// brightest over the b and falls off toward the island's rim and the cone below; it casts the shadows.
const key = new THREE.SpotLight(0xff2a1c, 15, 0, 0.62, 1.0, 0);
key.position.set(-45, 280, 6);
key.target.position.set(66, 40, 20);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
key.shadow.camera.near = 50; key.shadow.camera.far = 600;
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.35; key.shadow.radius = 3;
scene.add(key, key.target);

const doorInner = new THREE.PointLight(0xff2a1e, 420, 70, 2);         // glow inside the recess
doorInner.position.set(DOOR.cx, 22, 39);
const doorMouth = new THREE.PointLight(0xff2418, 520, 38, 2);         // spill onto the floor, doorstep and nearby steps only
doorMouth.position.set(DOOR.cx, 12, 54);
scene.add(doorInner, doorMouth);

const edgeLight = (X, Y, Z, intensity, dist) => {
  const l = new THREE.PointLight(0xff2418, intensity, dist, 2);
  l.position.set(X, Z, Y);                                            // scene (X, Y, Z) -> three (x, z, y)
  scene.add(l);
};
// thin area lights hugging the edges: a continuous red band along the first column of blocks
const stripLight = (X, Y, Z, w, h, face, intensity) => {                  // scene coords; face: 'front' (+Y) or 'right' (+X)
  const l = new THREE.RectAreaLight(0xff2418, intensity, w, h);
  l.position.set(X, Z, Y);
  l.lookAt(face === 'front' ? X : X - 1, Z, face === 'front' ? Y - 1 : Y);   // RectAreaLight emits away from the lookAt target
  scene.add(l);
};
stripLight(28, 46, 75, 4, 45, 'front', 8);                                // left edge of the stem above the landing
stripLight(118, 46, 30, 4, 60, 'front', 8);                               // front edge at the right end of the bowl
stripLight(122, 30, 30, 4, 60, 'right', 3);                               // right end face, along its front edge
edgeLight(67, 92, -70, 160, 100);                                     // low red glow under the island: the cone's tips catch it
edgeLight(160, 80, -45, 90, 60);
edgeLight(-45, 70, -40, 80, 55);

/* ---------- camera + render ---------- */
const bbox = new THREE.Box3();
blocks.forEach((b) => bbox.expandByPoint(new THREE.Vector3(b.X, b.Z, b.Y)));
const centre = bbox.getCenter(new THREE.Vector3());
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2000);
// Camera measured from the reference: the bowl's right end is half as wide on screen as its front (45 deep x 75 wide), which
// means 40 deg around from the b's face; 21 deg up from the top-face proportions.
const AZ = 41 * Math.PI / 180, EL = 18 * Math.PI / 180;
camera.position.copy(centre).add(new THREE.Vector3(Math.sin(AZ) * Math.cos(EL), Math.sin(EL), Math.cos(AZ) * Math.cos(EL)).multiplyScalar(700));
camera.lookAt(centre);
camera.updateMatrixWorld(true);
let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
const corner = new THREE.Vector3();
for (const b of blocks) {
  const h = b.s / 2, hy = (b.sy || b.s) / 2;
  for (const dx of [-h, h]) for (const dy of [-hy, hy]) for (const dz of [-h, h]) {
    corner.set(b.X + dx, b.Z + dy, b.Y + dz).applyMatrix4(camera.matrixWorldInverse);
    minX = Math.min(minX, corner.x); maxX = Math.max(maxX, corner.x); minY = Math.min(minY, corner.y); maxY = Math.max(maxY, corner.y);
  }
}
minX -= 4; maxX += 4; minY -= 4; maxY += 4;
Object.assign(camera, { left: minX, right: maxX, top: maxY, bottom: minY });
camera.updateProjectionMatrix();
const W = Math.ceil((maxX - minX) * UNIT_PX), H = Math.ceil((maxY - minY) * UNIT_PX);
// world (scene X, Y, Z) -> output pixel, used by tools to align the render with the reference
window.__project = (X, Y, Z) => { const v = new THREE.Vector3(X, Z, Y).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
renderer.render(scene, camera);

/* soft red glow: blur the saturated red pixels and add them back (stone and explorer stay clean) */
const out = document.createElement('canvas');
out.width = W; out.height = H;
const octx = out.getContext('2d');
octx.drawImage(renderer.domElement, 0, 0);
{
  const t = document.createElement('canvas');
  t.width = W; t.height = H;
  const g = t.getContext('2d');
  g.drawImage(out, 0, 0);
  const img = g.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!(d[i] > 140 && d[i] > d[i + 1] * 2.4)) d[i + 3] = 0;
  }
  g.putImageData(img, 0, 0);
  const t2 = document.createElement('canvas');
  t2.width = W; t2.height = H;
  const g2 = t2.getContext('2d');
  g2.filter = 'blur(' + Math.round(UNIT_PX * 0.9) + 'px)';
  g2.drawImage(t, 0, 0);
  octx.globalCompositeOperation = 'screen';
  octx.globalAlpha = 0.3;
  octx.drawImage(t2, 0, 0);
}

window.__sculptureSize = [W, H];
window.__sculptureCanvas = out;
window.__sculptureStats = { blocks: blocks.length, draws: groups.size, minZ: Math.min(...blocks.map((b) => b.Z)), darkTops: darkCubes.length, tops15: blocks.filter((b) => b.s === 15 && b.Z === -7.5).length };
window.__sculptureReady = true;
