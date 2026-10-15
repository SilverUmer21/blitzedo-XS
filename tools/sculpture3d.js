/*
 * Blitzedo home sculpture (build-time, three.js).
 *
 * A lowercase "b" built from real cubes: 2-unit blocks for the letter and stairs,
 * 4-unit blocks (plus small tips) for the floating foundation, each face carrying a
 * pixel-art texture. Lit by a shadow-casting key light, a red point light inside the
 * doorway that spills onto the floor and steps, emissive red surfaces and a bloom
 * pass. Everything is seeded, so the render is identical on every run.
 *
 * Scene axes (units): X runs along the face of the b, Z is up, Y is depth (front = +Y).
 * three.js maps these to x = X, y = Z, z = Y.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

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

/* ---------- layout (units) ---------- */
const B = 2;                                       // letter block size
const DOOR = { x0: 64, x1: 88, zRect: 36, cx: 76, r: 12, recessY: 8 };   // opening; recess from y=8 to the face at y=24
const BODY_Y1 = 24;
const STEM = { x0: 24, x1: 50, h: 110 };
const BOWL = { x0: 40, x1: 118, h: 76, rTop: 27, rBot: 17 };
const LANDING_Z = 48;
const PLAT = { x0: -24, x1: 128, y0: -16, y1: 40 };
const PLAT_CX = (PLAT.x0 + PLAT.x1) / 2, PLAT_CY = (PLAT.y0 + PLAT.y1) / 2;
const PLAT_AX = (PLAT.x1 - PLAT.x0) / 2, PLAT_AY = (PLAT.y1 - PLAT.y0) / 2;
const RIM_M = 0.8;

const inCircle = (x, z, cx, cz, r) => (x - cx) ** 2 + (z - cz) ** 2 <= r * r;
function inLetter(X, Z) {
  if (X >= STEM.x0 && X < STEM.x1 && Z >= 0 && Z < STEM.h) return true;
  if (X >= BOWL.x0 && X < BOWL.x1 && Z >= 0 && Z < BOWL.h) {
    const cxT = BOWL.x1 - BOWL.rTop, czT = BOWL.h - BOWL.rTop;
    if (X > cxT && Z > czT && !inCircle(X, Z, cxT, czT, BOWL.rTop)) return false;
    const cxB = BOWL.x1 - BOWL.rBot, czB = BOWL.rBot;
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
function platM(x, y) {
  const u = Math.abs(x - PLAT_CX) / PLAT_AX, v = Math.abs(y - PLAT_CY) / PLAT_AY;
  return Math.pow(u ** 7 + v ** 7, 1 / 7);
}
const inFootprint = (x, y) => x > -4 && x < 122 && y > -4 && y < 38;

/* ---------- block collection ---------- */
// block: { X, Y, Z (centre, scene units), s (size), f: [6 face tokens], t (brightness tint) }
// face order matches BoxGeometry: +x, -x, +y(up), -y, +z(front, scene +Y), -z
const blocks = [];

/* ----- letter grid (block size B) ----- */
const grid = new Map();            // final occupancy (after chips)
const clean = new Set();           // clean shape, used for rim light and AO
const gk = (i, j, k) => i + ',' + j + ',' + k;
const mats = new Map();            // grid key -> 'body' | 'stair' | 'step'

function put(i, j, k, kind) { grid.set(gk(i, j, k), kind); clean.add(gk(i, j, k)); }
const has = (i, j, k) => grid.has(gk(i, j, k));
const hasClean = (i, j, k) => clean.has(gk(i, j, k));

function buildLetter() {
  const chips = [];
  for (let i = STEM.x0 / B; i < BOWL.x1 / B; i++) {
    const X = (i + 0.5) * B;
    for (let k = 0; k < STEM.h / B; k++) {
      const Z = (k + 0.5) * B;
      if (!inLetter(X, Z)) continue;
      const edge = !inLetter(X - B, Z) || !inLetter(X + B, Z) || !inLetter(X, Z - B) || !inLetter(X, Z + B);
      for (let j = 0; j < BODY_Y1 / B; j++) {
        const Y = (j + 0.5) * B;
        if (inDoorOpening(X, Z) && Y > DOOR.recessY) continue;
        put(i, j, k, 'body');
        if (edge && k > 1 && hash3(i, j, k, 41) < 0.1) chips.push([i, j, k]);
      }
    }
  }
  // left block: three big steps climbing to the landing
  for (let i = 0; i < 12; i++) {
    const top = 16 * (Math.floor(i / 4) + 1) / B;                    // three steps: 16, 32, 48 high, 8 wide
    for (let k = 0; k < top; k++) for (let j = 0; j < 15; j++) {
      put(i, j, k, 'stair');
      
    }
  }
  // landing ledge the explorer stands on
  for (let i = 11; i < 16; i++) for (let j = 12; j < 15; j++) for (let k = (LANDING_Z - 6) / B; k < LANDING_Z / B; k++) put(i, j, k, 'stair');
  // ribbon of small steps down the wall to the doorway
  for (let st = 1; st <= 7; st++) {
    const top = LANDING_Z - 6 * st;
    for (let i = 16 + 2 * (st - 1); i < 16 + 2 * st; i++) for (let j = 12; j < 15; j++) {
      for (let k = Math.max(0, (top - 8) / B); k < top / B; k++) put(i, j, k, 'stair');
    }
  }
  // doorstep
  for (let i = 30; i < 46; i++) for (let j = 12; j < 15; j++) put(i, j, 0, 'step');

  chips.forEach(([i, j, k]) => grid.delete(gk(i, j, k)));
}

/* face colouring for letter blocks: returns a token */
const RIMP_SIDE = [0, 0.9];
function letterFaces(i, j, k, kind) {
  const X = (i + 0.5) * B, Y = (j + 0.5) * B, Z = (k + 0.5) * B;
  const f = ['c0', 'c0', 'c0', 'c0', 'c0', 'c0'];
  const rv = (n) => 'r' + Math.floor(hash3(i, j, k, 200 + n) * 3);
  const cv = (n) => 'c' + Math.floor(hash3(i, j, k, 210 + n) * 4);
  const rim = (dirs) => {
    for (let d = 1; d <= 1; d++) for (const [a, b, c] of dirs) if (!hasClean(i + a * d, j + b * d, k + c * d)) return d;
    return 0;
  };

  // doorway interior: emissive red on the back wall and the left wall
  const doorX = X > DOOR.x0 - 3 && X < DOOR.x1;
  const backWall = !has(i, j + 1, k) && Y > DOOR.recessY - B && Y < DOOR.recessY + B && X >= DOOR.x0 && X < DOOR.x1 && Z < DOOR.zRect + DOOR.r;
  const leftWall = !has(i + 1, j, k) && X > DOOR.x0 - B && X < DOOR.x0 && Y > DOOR.recessY && Z < DOOR.zRect + DOOR.r - 2;

  // +x face
  if (!has(i + 1, j, k)) {
    if (leftWall) f[0] = 'd1';
    else {
      const d = rim([[0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]);
      const gate = kind === 'stair' ? 0.04 : (vnoise(X, Y, Z, 9, 30) > 0.46 ? 1 : 0.25);
      const p = (RIMP_SIDE[d] || 0) * gate;
      f[0] = hash3(i, j, k, 70) < p || hash3(i, j, k, 80) < 0.008 ? rv(0) : cv(0);
    }
  }
  // front face (+Y)
  if (!has(i, j + 1, k)) {
    if (backWall) f[4] = 'd0';
    else {
      const d = rim([[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]);
      const gate = kind === 'stair' ? 0.04 : (vnoise(X, Y, Z, 9, 30) > 0.46 ? 1 : 0.25);
      const p = (RIMP_SIDE[d] || 0) * gate;
      f[4] = hash3(i, j, k, 71) < p || hash3(i, j, k, 81) < 0.008 ? rv(1) : cv(1);
    }
  }
  // top face
  if (!has(i, j, k + 1)) {
    let p = 0;
    const d = rim([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]]);
    const curved = kind === 'body' && X > BOWL.x1 - BOWL.rTop && Z > BOWL.h - BOWL.rTop - 2 && Z > 20;
    if (kind === 'stair' || kind === 'step') p = 0.94;
    else if (curved) p = (j === 0 || j === BODY_Y1 / B - 1) ? 0.9 : 0.05;
    else {
      p = vnoise(X, Y, 0, 8, 31) > 0.5 ? 0.95 : 0;
      p = Math.max(p, d === 1 ? 0.85 : 0);
    }
    f[2] = hash3(i, j, k, 72) < p ? rv(2) : cv(2);
  }
  return f;
}

function emitLetter() {
  for (const [key, kind] of grid) {
    const [i, j, k] = key.split(',').map(Number);
    const f = letterFaces(i, j, k, kind);
    // ambient occlusion: concave spots (many occupied neighbours) get darker
    let occ = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) if ((a || b || c) && has(i + a, j + b, k + c)) occ++;
    const ao = 1 - 0.55 * Math.max(0, (occ - 17) / 9);
    const t = (0.7 + 0.5 * hash3(i, j, k, 300)) * ao;
    blocks.push({ X: (i + 0.5) * B, Y: (j + 0.5) * B, Z: (k + 0.5) * B, s: B, f, t });
  }
}

/* ----- floating foundation: three tiers of cubes (8, 4 and 2 units) tapering to a point ----- */
const CELL = 8;
const platCell = (x, y) => hash3(Math.floor(x / CELL), Math.floor(y / CELL), 0, 2);
const tierFaces = (h, tipP, sideP) => {
  const f = ['c0', 'c0', 'c0', 'c0', 'c0', 'c0'];
  const rvv = (a) => 'r' + Math.floor(hash3(h, a, 1, 230) * 3), cvv = (a) => 'c' + Math.floor(hash3(h, a, 2, 220) * 4);
  f[0] = hash3(h, 0, 3, 233) < (tipP || sideP) ? rvv(0) : cvv(0);
  f[4] = hash3(h, 1, 3, 234) < (tipP || sideP) ? rvv(1) : cvv(1);
  f[2] = cvv(2);
  return f;
};
function emitPlatform() {
  for (let ci = Math.floor(PLAT.x0 / CELL); ci < Math.ceil(PLAT.x1 / CELL); ci++) {
    for (let cj = Math.floor(PLAT.y0 / CELL); cj < Math.ceil(PLAT.y1 / CELL); cj++) {
      const x = (ci + 0.5) * CELL, y = (cj + 0.5) * CELL;
      const m = platM(x, y);
      if (m + (vnoise(x, y, 0, 18, 1) - 0.5) * 0.14 > 1) continue;
      const r = hash3(ci, cj, 0, 2), core = 1 - m;
      const onRim = m > RIM_M && !inFootprint(x, y);
      let top = 0;
      if (onRim) top = r < 0.3 ? -4 : (r > 0.72 && x > 36 ? 4 : 0);                // rim cubes stand out
      // total hang for this column (inverted pyramid), split over the tiers
      const H = 8 + 74 * Math.pow(core, 1.15) * (0.7 + 0.5 * r);
      let rem = H - CELL;
      const extra8 = Math.floor(rem * 0.4 / CELL);
      const n8 = 1 + extra8;
      rem -= extra8 * CELL;
      // tier 1: big 8-cubes
      for (let q = 0; q < n8; q++) {
        if (q > 0 && hash3(ci, cj, q, 235) < 0.1) continue;                         // the odd missing cube
        const Z = top - CELL / 2 - q * CELL;
        const f = tierFaces(ci * 31 + cj * 7 + q, q === n8 - 1 && n8 > 1 ? 0.3 : 0, onRim && q === 0 ? 0.1 : 0.012);
        if (q === 0) {
          let red;
          if (onRim) red = platCell(x, y) < 0.42 ? 0.97 : 0.04;
          else red = vnoise(x, y, 0, 16, 31) > 0.6 ? 0.9 : 0.04;
          f[2] = hash3(ci, cj, 9, 232) < red ? 'r' + Math.floor(hash3(ci, cj, 5, 231) * 3) : 'c' + Math.floor(hash3(ci, cj, 6, 221) * 4);
          if (x > DOOR.x0 && x < DOOR.x1 && y > DOOR.recessY && y < BODY_Y1) f[2] = 'd0';     // door floor glows
        }
        blocks.push({ X: x, Y: y, Z, s: CELL, f, t: (0.75 + 0.45 * hash3(ci, cj, q, 301)) * (1 - 0.3 * Math.min(1, -Z / 60)) });
      }
      const z8 = top - n8 * CELL;
      if (rem < 3) continue;
      // tier 2: 4-cubes in a 2x2 pattern; tier 3: 2-cubes under each
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
        const X4 = x - 2 + a * 4, Y4 = y - 2 + b * 4, h4 = ci * 977 + cj * 131 + a * 17 + b * 5;
        const len4 = Math.floor(rem * 0.7 / 4 * (0.55 + 0.9 * hash3(h4, 0, 0, 240)));
        for (let q = 0; q < len4; q++) {
          const Z = z8 - 2 - q * 4, last = q === len4 - 1;
          blocks.push({ X: X4, Y: Y4, Z, s: 4, f: tierFaces(h4 * 7 + q, last ? 0.24 : 0, 0.01), t: (0.72 + 0.45 * hash3(h4, q, 0, 302)) * (1 - 0.3 * Math.min(1, -Z / 60)) });
        }
        const z4 = z8 - len4 * 4, rem2 = rem - len4 * 4;
        for (let c = 0; c < 2; c++) for (let d = 0; d < 2; d++) {
          const h2 = h4 * 13 + c * 3 + d, len2 = Math.floor(Math.max(0, rem2) / 2 * (0.4 + 0.9 * hash3(h2, 0, 0, 241)));
          for (let q = 0; q < len2; q++) {
            const Z = z4 - 1 - q * 2, last = q === len2 - 1;
            blocks.push({ X: X4 - 1 + c * 2, Y: Y4 - 1 + d * 2, Z, s: 2, f: tierFaces(h2 * 5 + q, last ? 0.3 : 0, 0.008), t: (0.7 + 0.45 * hash3(h2, q, 0, 303)) * (1 - 0.3 * Math.min(1, -Z / 60)) });
          }
        }
      }
      // a few lone raised cubes on the island top, clear of the letter
      if (!inFootprint(x, y) && m < 0.9 && m > 0.45 && hash3(ci, cj, 0, 250) > 0.9) {
        const sz = hash3(ci, cj, 1, 251) > 0.5 ? 4 : 2;
        const f = ['c0', 'c0', 'c0', 'c0', 'c0', 'c0'];
        f[2] = hash3(ci, cj, 2, 252) < 0.6 ? 'r1' : 'c1';
        f[0] = 'c2'; f[4] = hash3(ci, cj, 3, 253) < 0.3 ? 'r2' : 'c3';
        blocks.push({ X: x, Y: y, Z: top + sz / 2, s: sz, f, t: 1 });
      }
    }
  }
}

/* ----- loose floating cubes ----- */
const LOOSE = [
  // x, y, z (centre), size
  [-18, 40, -30, 8], [8, 44, -46, 4], [46, 45, -68, 8], [76, 46, -72, 4],
  [100, 45, -48, 8], [126, 34, -28, 6], [26, 48, -58, 4], [90, 46, -42, 6]
];
function emitLoose() {
  LOOSE.forEach(([X, Y, Z, s], n) => {
    const f = ['c0', 'c0', 'c0', 'c0', 'c0', 'c0'];
    f[2] = 'r' + (n % 3);
    f[0] = hash3(n, 1, 0, 260) < 0.5 ? 'r' + ((n + 1) % 3) : 'c1';
    f[4] = hash3(n, 2, 0, 261) < 0.35 ? 'r' + ((n + 2) % 3) : 'c2';
    blocks.push({ X, Y, Z, s, f, t: 0.95 });
  });
}

/* ---------- pixel-art textures ---------- */
const texCache = new Map();
function makeTexture(kind, variant, n) {
  const key = kind + variant + '_' + n;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d');
  const img = g.createImageData(n, n);
  const seed = (kind.charCodeAt(0) * 31 + variant * 977 + n) | 0;
  const rnd = (x, y, s) => hash3(x, y, seed, s);
  const cracks = new Set();
  if (kind === 'c' && rnd(0, 0, 9) < 0.5) {            // one ragged crack per charcoal texture
    let cx = Math.floor(rnd(1, 1, 10) * n), cy = Math.floor(rnd(2, 2, 11) * n);
    for (let s = 0; s < n * 0.9; s++) {
      cracks.add(cx + ',' + cy);
      cx += Math.floor(rnd(s, 3, 12) * 3) - 1; cy += rnd(s, 4, 13) < 0.7 ? 1 : 0;
      if (cx < 0 || cy < 0 || cx >= n || cy >= n) break;
    }
  }
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let r, gg, b;
      const q = rnd(x, y, 1), low = vnoise(x, y, variant, n / 3, seed) - 0.5;
      if (kind === 'c') {
        let v = 36 + q * 26 + low * 22;
        if (rnd(x, y, 2) < 0.07) v *= 0.55;                // pits
        if (rnd(x, y, 3) < 0.05) v += 40;                  // chalky flecks
        if (cracks.has(x + ',' + y)) v *= 0.4;
        r = v; gg = v; b = v * 0.97;
      } else {
        const p = rnd(x, y, 4);
        let base = [226, 30, 30];
        if (p < 0.12) base = [168, 18, 22];
        else if (p < 0.15) base = [28, 8, 8];
        else if (p > 0.88) base = [255, 82, 66];
        const s = 1 + low * 0.35 * (kind === 'd' ? 0.4 : 1);
        r = base[0] * s; gg = base[1] * s; b = base[2] * s;
        if (kind === 'd') { r = Math.min(255, r * 0.98 + 14); gg *= 0.8; b *= 0.85; }
      }
      // bevel: lit top-left, shaded bottom-right
      let bev = 0;
      if (y === 0) bev += 26; if (x === 0) bev += 14;
      if (y === n - 1) bev -= 22; if (x === n - 1) bev -= 16;
      const k = (kind === 'c') ? 1 : 0.5;
      r += bev * k; gg += bev * k * 0.5; b += bev * k * 0.5;
      const o = (y * n + x) * 4;
      img.data[o] = Math.max(0, Math.min(255, r)); img.data[o + 1] = Math.max(0, Math.min(255, gg));
      img.data[o + 2] = Math.max(0, Math.min(255, b)); img.data[o + 3] = 255;
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
  const map = makeTexture(kind, v, n);
  let m;
  if (kind === 'c') m = new THREE.MeshStandardMaterial({ map, roughness: 0.95, metalness: 0 });
  else if (kind === 'r') m = new THREE.MeshStandardMaterial({ map, roughness: 0.8, metalness: 0, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.5 });
  else m = new THREE.MeshStandardMaterial({ map, roughness: 0.7, metalness: 0, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: v === 0 ? 1.15 : 0.75 });
  matCache.set(key, m);
  return m;
}

/* ---------- scene ---------- */
buildLetter();
emitLetter();
emitPlatform();
emitLoose();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// group blocks by (size, face tokens) into instanced meshes
const groups = new Map();
for (const b of blocks) {
  const key = b.s + '|' + b.f.join(',');
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(b);
}
const geoCache = new Map();
const col = new THREE.Color();
const dummy = new THREE.Object3D();
for (const [key, list] of groups) {
  const s = list[0].s;
  if (!geoCache.has(s)) geoCache.set(s, new THREE.BoxGeometry(s * 0.965, s * 0.965, s * 0.965));
  const n = s * 4;                                         // texels across a face: same pixel density everywhere
  const mesh = new THREE.InstancedMesh(geoCache.get(s), list[0].f.map((t) => material(t, n)), list.length);
  list.forEach((b, i) => {
    dummy.position.set(b.X, b.Z, b.Y);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    col.setScalar(Math.min(1.25, b.t));
    mesh.setColorAt(i, col);
  });
  mesh.castShadow = true; mesh.receiveShadow = true;
  scene.add(mesh);
}

/* ---------- explorer (3D, lit like everything else) ---------- */
(function explorer() {
  const g = new THREE.Group();
  const ivory = new THREE.MeshStandardMaterial({ color: 0xf6f1e6, roughness: 0.55, emissive: 0x6a645a });
  const ivoryShade = new THREE.MeshStandardMaterial({ color: 0xdcd4c3, roughness: 0.7, emissive: 0x4a453c });
  const red = new THREE.MeshStandardMaterial({ color: 0xe5262b, roughness: 0.7, emissive: 0x5a0a0c, side: THREE.DoubleSide });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0b0b0a, roughness: 0.4 });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
  };
  // legs and feet
  add(new THREE.CapsuleGeometry(0.85, 3.6, 4, 10), ivoryShade, -0.3, 2.6, -1.3);
  add(new THREE.CapsuleGeometry(0.85, 3.6, 4, 10), ivory, 0.9, 2.6, 1.3);
  add(new THREE.SphereGeometry(1.0, 12, 8), ivoryShade, -0.1, 0.55, -1.3).scale.set(1.3, 0.6, 0.9);
  add(new THREE.SphereGeometry(1.0, 12, 8), ivory, 1.3, 0.55, 1.3).scale.set(1.3, 0.6, 0.9);
  // tunic
  add(new THREE.CylinderGeometry(2.3, 3.0, 6.6, 18), ivory, 0.3, 7.6, 0);
  add(new THREE.CylinderGeometry(2.5, 2.5, 0.5, 16), red, 0.3, 4.6, 0).scale.set(0.9, 1, 0.9);   // red lining at the hem
  // arm reaching toward the stairs
  add(new THREE.CapsuleGeometry(0.7, 3.0, 4, 8), ivory, 2.3, 8.0, 2.6, 0.35, 0, -0.9);
  add(new THREE.CapsuleGeometry(0.65, 2.6, 4, 8), ivoryShade, 1.3, 8.2, -2.6, -0.2, 0, -0.3);
  // head and visor
  add(new RoundedBoxGeometry(6.4, 6.8, 6.4, 4, 2.4), ivory, 0.6, 14.6, 0);
  add(new THREE.BoxGeometry(0.5, 2.6, 2.4), dark, 3.8, 14.9, 1.0);
  // scarf: collar and trailing tail
  add(new THREE.TorusGeometry(2.9, 0.75, 8, 24), red, 0.5, 10.9, 0, Math.PI / 2, 0, 0).scale.set(1, 1, 0.9);
  const tail = new THREE.Shape();
  tail.moveTo(0, 0.4); tail.lineTo(-4.5, 2.6); tail.lineTo(-10.5, 4.6); tail.lineTo(-8.8, 2.6); tail.lineTo(-11.4, 1.6);
  tail.lineTo(-8.4, 0.2); tail.lineTo(-4.2, -2.0); tail.lineTo(0, -2.6); tail.closePath();
  add(new THREE.ExtrudeGeometry(tail, { depth: 0.4, bevelEnabled: false }), red, -1.2, 11.4, -0.2, 0, 0.15, 0);
  g.position.set(26.5, LANDING_Z, 27);
  g.scale.setScalar(1.0);
  scene.add(g);
})();

/* ---------- lights ---------- */
scene.add(new THREE.HemisphereLight(0xa8a4b0, 0x1a1414, 0.4));
scene.add(new THREE.AmbientLight(0xffffff, 0.15));
const fill = new THREE.DirectionalLight(0x9aa2b8, 0.45);               // soft cool fill from the right/front, no shadows
fill.position.set(120, 50, 140);
scene.add(fill);
const key = new THREE.DirectionalLight(0xfff1e4, 2.5);
key.position.set(-70, 150, 110);                         // upper-left, in front: the face with the doorway is lit
key.target.position.set(60, 30, 10);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
Object.assign(key.shadow.camera, { left: -150, right: 150, top: 150, bottom: -150, near: 1, far: 500 });
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.25; key.shadow.radius = 3;
scene.add(key, key.target);

const doorInner = new THREE.PointLight(0xff2a1e, 260, 60, 2);          // glow inside the recess
doorInner.position.set(DOOR.cx, 20, 16);
const doorMouth = new THREE.PointLight(0xff2418, 520, 55, 2);          // spill onto floor, steps and wall
doorMouth.position.set(DOOR.cx, 14, 34);
scene.add(doorInner, doorMouth);

/* ---------- camera + render ---------- */
const bbox = new THREE.Box3();
blocks.forEach((b) => bbox.expandByPoint(new THREE.Vector3(b.X, b.Z, b.Y)));
bbox.expandByScalar(5);
const centre = bbox.getCenter(new THREE.Vector3());
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2000);
camera.position.copy(centre).add(new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(700));
camera.lookAt(centre);
camera.updateMatrixWorld(true);
let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
const corner = new THREE.Vector3();
for (const b of blocks) {
  const h = b.s / 2;
  for (const dx of [-h, h]) for (const dy of [-h, h]) for (const dz of [-h, h]) {
    corner.set(b.X + dx, b.Z + dy, b.Y + dz).applyMatrix4(camera.matrixWorldInverse);
    minX = Math.min(minX, corner.x); maxX = Math.max(maxX, corner.x); minY = Math.min(minY, corner.y); maxY = Math.max(maxY, corner.y);
  }
}
minX -= 4; maxX += 4; minY -= 4; maxY += 4;
Object.assign(camera, { left: minX, right: maxX, top: maxY, bottom: minY });
camera.updateProjectionMatrix();
const W = Math.ceil((maxX - minX) * UNIT_PX), H = Math.ceil((maxY - minY) * UNIT_PX);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
renderer.render(scene, camera);

/* red-only glow: blur the saturated red pixels and add them back (stone and explorer stay clean) */
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
    if (!(d[i] > 150 && d[i] > d[i + 1] * 2.4)) d[i + 3] = 0;
  }
  g.putImageData(img, 0, 0);
  const t2 = document.createElement('canvas');
  t2.width = W; t2.height = H;
  const g2 = t2.getContext('2d');
  g2.filter = 'blur(' + Math.round(UNIT_PX * 1.3) + 'px)';
  g2.drawImage(t, 0, 0);
  octx.globalCompositeOperation = 'screen';
  octx.globalAlpha = 0.55;
  octx.drawImage(t2, 0, 0);
}

window.__sculptureSize = [W, H];
window.__sculptureCanvas = out;
window.__sculptureStats = { blocks: blocks.length, draws: groups.size, below10: blocks.filter((b) => b.Z < -10).length, below40: blocks.filter((b) => b.Z < -40).length, minZ: Math.min(...blocks.map((b) => b.Z)) };
window.__sculptureReady = true;
