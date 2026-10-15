/*
 * Blitzedo home sculpture (build-time, three.js).
 *
 * A lowercase "b" built from large charcoal stone cubes. Every block is the same dark
 * stone (chunky chipped-stone pixel texture, no red paint): the red comes from light.
 * A strong red key light from above-left makes tops and edges glow and casts shadows,
 * red lights in the doorway spill onto the floor and steps, and a near-black fill keeps
 * the rest of the stone almost black. Cubes come in tiers: 9-unit blocks for the letter
 * (3-unit blocks at curves, steps and the arch) and 12 / 6 / 3-unit cubes for the
 * floating foundation. Everything is seeded, so the render is identical on every run.
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
const G = 3;                                       // finest letter cell; 3x3x3 groups merge into 9-unit cubes
const DOOR = { x0: 60, x1: 87, zRect: 36, cx: 73.5, r: 13.5, recessY: 9 };   // opening; recess from y=9 to the face at y=27
const BODY_Y1 = 27;
const JF = BODY_Y1 / G;                            // cells in the depth of the body
const STEM = { x0: 24, x1: 51, h: 108 };
const BOWL = { x0: 42, x1: 114, h: 72, rTop: 36, rBot: 24 };
const LANDING_Z = 45;
const PLAT = { x0: -12, x1: 132, y0: -12, y1: 48 };
const PLAT_CX = (PLAT.x0 + PLAT.x1) / 2, PLAT_CY = (PLAT.y0 + PLAT.y1) / 2;
const PLAT_AX = (PLAT.x1 - PLAT.x0) / 2, PLAT_AY = (PLAT.y1 - PLAT.y0) / 2;
const RIM_M = 0.74;
const CELL = 12;                                   // foundation top cube

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
const inFootprint = (x, y) => x > -4 && x < 120 && y > -4 && y < 36;   // cells under the letter, stairs and doorstep stay flat

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
const cen = (i) => (i + 0.5) * G;

function buildLetter() {
  const chips = [];
  const put = (i, j, k, kind) => grid.set(gk(i, j, k), kind);
  // main body
  for (let i = Math.floor(STEM.x0 / G); i < Math.ceil(BOWL.x1 / G); i++) {
    for (let k = 0; k < Math.ceil(STEM.h / G); k++) {
      const X = cen(i), Z = cen(k);
      if (!inLetter(X, Z)) continue;
      const edge = !inLetter(X - G, Z) || !inLetter(X + G, Z) || !inLetter(X, Z - G) || !inLetter(X, Z + G);
      for (let j = 0; j < BODY_Y1 / G; j++) {
        if (inDoorOpening(X, Z) && cen(j) > DOOR.recessY) continue;
        put(i, j, k, 'body');
        if (edge && k > 1 && hash3(i, j, k, 41) < 0.04) chips.push([i, j, k]);
      }
    }
  }
  // left block: three big steps (15 high, 9 wide) climbing to the landing
  for (let i = -1; i < 8; i++) {
    const top = 15 * (Math.floor((i + 1) / 3) + 1) / G;
    for (let k = 0; k < top; k++) for (let j = 0; j < JF + 1; j++) put(i, j, k, 'stair');
  }
  // landing ledge the explorer stands on
  for (let i = 8; i < 11; i++) for (let j = JF; j < JF + 2; j++) for (let k = (LANDING_Z - 6) / G; k < LANDING_Z / G; k++) put(i, j, k, 'stair');
  // ribbon of small steps down the wall to the doorway
  for (let st = 1; st <= 7; st++) {
    const top = LANDING_Z - 6 * st;
    for (let j = JF; j < JF + 2; j++) for (let k = Math.max(0, (top - 6) / G); k < top / G; k++) put(10 + st, j, k, 'stair');
  }
  // doorstep
  for (let i = 18; i < 30; i++) for (let j = JF; j < JF + 2; j++) put(i, j, 0, 'step');
  chips.forEach(([i, j, k]) => grid.delete(gk(i, j, k)));
}

/* merge aligned 2x2x2 groups into 6-unit cubes, emit the rest as 3-unit cubes */
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
    // light-tint: random per cube, darker in tight corners
    let occ = 0;
    for (let a = -1; a <= n; a++) for (let b = -1; b <= n; b++) for (let c = -1; c <= n; c++) if (has(i + a, j + b, k + c) && (a < 0 || b < 0 || c < 0 || a >= n || b >= n || c >= n)) occ++;
    const faceCells = 6 * n * n + 12 * n + 8;
    const ao = 1 - Math.max(0, occ / faceCells - 0.5);
    blocks.push({ X, Y, Z, s, f, t: (0.16 + 1.0 * Math.pow(hash3(i, j, k, 300), 1.2)) * Math.max(0.4, ao) });
  };
  const M = 3;                                 // merge aligned 3x3x3 cell groups into 9-unit cubes
  for (const [key] of grid) {
    if (done.has(key)) continue;
    const [i, j, k] = key.split(',').map(Number);
    const i0 = 8 + Math.floor((i - 8) / M) * M, j0 = Math.floor(j / M) * M, k0 = Math.floor(k / M) * M;
    let full = true;
    const kind = grid.get(key);
    for (let a = 0; a < M && full; a++) for (let b = 0; b < M && full; b++) for (let c = 0; c < M && full; c++) {
      const kk = gk(i0 + a, j0 + b, k0 + c);
      if (!grid.has(kk) || grid.get(kk) !== kind || done.has(kk)) full = false;
    }
    if (full && kind !== 'step') {
      for (let a = 0; a < M; a++) for (let b = 0; b < M; b++) for (let c = 0; c < M; c++) done.add(gk(i0 + a, j0 + b, k0 + c));
      emit(i0, j0, k0, M);
    } else {
      done.add(key);
      emit(i, j, k, 1);
    }
  }
}

/* ----- floating foundation: 12-unit rim cubes, then 6- and 3-unit cubes tapering to points ----- */
const tierFaces = (h) => {
  const f = baseFaces();
  f[0] = cv(h, 0, 1, 1); f[4] = cv(h, 1, 1, 2); f[2] = cv(h, 2, 1, 3);
  return f;
};
const shadeDepth = (Z) => 1 - 0.35 * Math.min(1, Math.max(0, -Z / 70));
function emitPlatform() {
  for (let ci = Math.floor(PLAT.x0 / CELL); ci < Math.ceil(PLAT.x1 / CELL); ci++) {
    for (let cj = Math.floor(PLAT.y0 / CELL); cj < Math.ceil(PLAT.y1 / CELL); cj++) {
      const x = (ci + 0.5) * CELL, y = (cj + 0.5) * CELL;
      const m = platM(x, y);
      if (m + (vnoise(x, y, 0, 24, 1) - 0.5) * 0.16 > 1) continue;
      const r = hash3(ci, cj, 0, 2), core = 1 - m;
      const onRim = m > RIM_M && !inFootprint(x, y);
      let top = 0;
      if (onRim) top = r < 0.34 ? -6 : (r > 0.62 && x > 30 ? 6 : 0);                 // rim cubes stand at different heights
      const H = 24 + 72 * Math.pow(core, 1.3) * (0.7 + 0.5 * r);                      // total hang (inverted pyramid)
      let rem = H - CELL;
      const extra = Math.floor(rem * 0.3 / CELL);
      const n12 = 1 + extra;
      rem -= extra * CELL;
      for (let q = 0; q < n12; q++) {
        if (q > 0 && hash3(ci, cj, q, 235) < 0.1) continue;
        const Z = top - CELL / 2 - q * CELL;
        const f = tierFaces(ci * 31 + cj * 7 + q);
        if (q === 0 && x > DOOR.x0 && x < DOOR.x1 && y > DOOR.recessY && y < BODY_Y1) f[2] = 'd0';   // door floor glows
        blocks.push({ X: x, Y: y, Z, s: CELL, f, t: (0.16 + 1.0 * Math.pow(hash3(ci, cj, q, 301), 1.2)) * shadeDepth(Z) });
      }
      const z12 = top - n12 * CELL;
      if (rem < 3) continue;
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
        const X6 = x - 3 + a * 6, Y6 = y - 3 + b * 6, h6 = ci * 977 + cj * 131 + a * 17 + b * 5;
        const len6 = Math.floor(rem * 0.62 / 6 * (0.5 + 0.9 * hash3(h6, 0, 0, 240)));
        for (let q = 0; q < len6; q++) {
          const Z = z12 - 3 - q * 6;
          blocks.push({ X: X6, Y: Y6, Z, s: 6, f: tierFaces(h6 * 7 + q), t: (0.16 + 1.0 * Math.pow(hash3(h6, q, 0, 302), 1.2)) * shadeDepth(Z) });
        }
        const z6 = z12 - len6 * 6, rem2 = rem - len6 * 6;
        for (let c = 0; c < 2; c++) for (let d = 0; d < 2; d++) {
          const h3 = h6 * 13 + c * 3 + d, len3 = Math.floor(Math.max(0, rem2) / 3 * (0.35 + 0.9 * hash3(h3, 0, 0, 241)));
          for (let q = 0; q < len3; q++) {
            const Z = z6 - 1.5 - q * 3;
            blocks.push({ X: X6 - 1.5 + c * 3, Y: Y6 - 1.5 + d * 3, Z, s: 3, f: tierFaces(h3 * 5 + q), t: (0.16 + 1.0 * Math.pow(hash3(h3, q, 0, 303), 1.2)) * shadeDepth(Z) });
          }
        }
      }
      // a few lone raised cubes on the island top, clear of the letter
      if (!inFootprint(x, y) && m < 0.9 && m > 0.45 && hash3(ci, cj, 0, 250) > 0.88) {
        const sz = hash3(ci, cj, 1, 251) > 0.5 ? 6 : 3;
        blocks.push({ X: x + 2, Y: y - 2, Z: top + sz / 2, s: sz, f: tierFaces(ci * 3 + cj), t: 0.9 });
      }
    }
  }
}

/* ----- loose floating cubes ----- */
const LOOSE = [
  // x, y, z (centre), size
  [-20, 52, -28, 12], [10, 58, -48, 6], [46, 60, -76, 12], [80, 60, -80, 6],
  [104, 58, -52, 12], [130, 44, -30, 9], [26, 62, -66, 6], [92, 60, -40, 9]
];
function emitLoose() {
  LOOSE.forEach(([X, Y, Z, s], n) => blocks.push({ X, Y, Z, s, f: tierFaces(900 + n), t: 0.85 }));
}

/* ---------- chunky chipped-stone pixel textures ---------- */
function texelsFor(s) { return s <= 3 ? 6 : s <= 6 ? 8 : s <= 9 ? 9 : 12; }
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
  const count = Math.max(4, Math.round(n * n / 9));
  for (let i = 0; i < count; i++) sites.push({ x: rnd(i, 0, 1) * n, y: rnd(i, 1, 2) * n, v: 0.38 + 0.8 * Math.pow(rnd(i, 2, 3), 1.3) });
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
      if (edge && rnd(x, y, 4) < 0.7) f *= 0.45;                           // cracks between chips
      if (rnd(x, y, 5) < 0.03) f *= 0.5;                                   // pits
      if (rnd(x, y, 6) < 0.04) f *= 1.35;                                  // chalky flecks
      // bevel: lit top-left edges, shaded bottom-right
      if (y === 0) f *= 1.9;
      if (x === 0) f *= 1.35;
      if (y === n - 1) f *= 0.55;
      if (x === n - 1) f *= 0.65;
      const v = Math.max(0, Math.min(255, 150 * f));
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
emitPlatform();
emitLoose();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const groups = new Map();
for (const b of blocks) {
  const key = b.s + '|' + b.f.join(',');
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(b);
}
const geoCache = new Map();
const col = new THREE.Color();
const dummy = new THREE.Object3D();
for (const [, list] of groups) {
  const s = list[0].s;
  if (!geoCache.has(s)) geoCache.set(s, new THREE.BoxGeometry(s * 0.95, s * 0.95, s * 0.95));
  const n = texelsFor(s);
  const mesh = new THREE.InstancedMesh(geoCache.get(s), list[0].f.map((t) => material(t, n)), list.length);
  list.forEach((b, i) => {
    dummy.position.set(b.X, b.Z, b.Y);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    col.setScalar(Math.min(1.3, b.t));
    mesh.setColorAt(i, col);
  });
  mesh.castShadow = true; mesh.receiveShadow = true;
  scene.add(mesh);
}

/* ---------- explorer (self-lit ivory so the red light does not tint him) ---------- */
(function explorer() {
  const g = new THREE.Group();
  const ivory = new THREE.MeshStandardMaterial({ color: 0x8a867c, roughness: 0.6, emissive: 0xf0ebe0, emissiveIntensity: 0.62 });
  const ivoryShade = new THREE.MeshStandardMaterial({ color: 0x6c685f, roughness: 0.7, emissive: 0xd0c9ba, emissiveIntensity: 0.5 });
  const red = new THREE.MeshStandardMaterial({ color: 0xe5262b, roughness: 0.7, emissive: 0xc01a1e, emissiveIntensity: 0.55, side: THREE.DoubleSide });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0b0b0a, roughness: 0.4 });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
  };
  add(new THREE.CapsuleGeometry(0.85, 3.6, 4, 10), ivoryShade, -0.3, 2.6, -1.3);
  add(new THREE.CapsuleGeometry(0.85, 3.6, 4, 10), ivory, 0.9, 2.6, 1.3);
  add(new THREE.SphereGeometry(1.0, 12, 8), ivoryShade, -0.1, 0.55, -1.3).scale.set(1.3, 0.6, 0.9);
  add(new THREE.SphereGeometry(1.0, 12, 8), ivory, 1.3, 0.55, 1.3).scale.set(1.3, 0.6, 0.9);
  add(new THREE.CylinderGeometry(2.3, 3.0, 6.6, 18), ivory, 0.3, 7.6, 0);
  add(new THREE.CylinderGeometry(2.5, 2.5, 0.5, 16), red, 0.3, 4.6, 0).scale.set(0.9, 1, 0.9);
  add(new THREE.CapsuleGeometry(0.7, 3.0, 4, 8), ivory, 2.3, 8.0, 2.6, 0.35, 0, -0.9);
  add(new THREE.CapsuleGeometry(0.65, 2.6, 4, 8), ivoryShade, 1.3, 8.2, -2.6, -0.2, 0, -0.3);
  add(new RoundedBoxGeometry(6.4, 6.8, 6.4, 4, 2.4), ivory, 0.6, 14.6, 0);
  add(new THREE.BoxGeometry(0.5, 2.6, 2.4), dark, 3.8, 14.9, 1.0);
  add(new THREE.TorusGeometry(2.9, 0.75, 8, 24), red, 0.5, 10.9, 0, Math.PI / 2, 0, 0).scale.set(1, 1, 0.9);
  const tail = new THREE.Shape();
  tail.moveTo(0, 0.4); tail.lineTo(-4.5, 2.6); tail.lineTo(-10.5, 4.6); tail.lineTo(-8.8, 2.6); tail.lineTo(-11.4, 1.6);
  tail.lineTo(-8.4, 0.2); tail.lineTo(-4.2, -2.0); tail.lineTo(0, -2.6); tail.closePath();
  add(new THREE.ExtrudeGeometry(tail, { depth: 0.4, bevelEnabled: false }), red, -1.2, 11.4, -0.2, 0, 0.15, 0);
  g.position.set(28.5, LANDING_Z, 30);
  scene.add(g);
})();

/* ---------- lights: red is the main light; the white fill is almost nothing ---------- */
scene.add(new THREE.AmbientLight(0xffffff, 0.1));
scene.add(new THREE.HemisphereLight(0xb8b4c0, 0x120c0c, 0.1));
const fill = new THREE.DirectionalLight(0xc8ccd8, 0.38);              // keeps the left faces a touch lighter than the right
fill.position.set(-80, 70, 160);
scene.add(fill);

const key = new THREE.DirectionalLight(0xff2a1c, 12);                // the red key: from above, slightly left and in front
key.position.set(-26, 240, 10);
key.target.position.set(60, 20, 10);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
Object.assign(key.shadow.camera, { left: -150, right: 150, top: 150, bottom: -150, near: 1, far: 500 });
key.shadow.bias = -0.0005; key.shadow.normalBias = 0.3; key.shadow.radius = 3;
scene.add(key, key.target);

const rim = new THREE.DirectionalLight(0xff1a10, 0);                // grazing red from the left lights the left edges of the front faces
rim.position.set(-160, 40, 110);
scene.add(rim);

const doorInner = new THREE.PointLight(0xff2a1e, 900, 70, 2);         // glow inside the recess
doorInner.position.set(DOOR.cx, 22, 18);
const doorMouth = new THREE.PointLight(0xff2418, 1700, 65, 2);        // spill onto floor, steps and wall
doorMouth.position.set(DOOR.cx, 14, 36);
scene.add(doorInner, doorMouth);

const edgeLights = [];
const edgeLight = (X, Y, Z, intensity, dist) => {
  const l = new THREE.PointLight(0xff2418, intensity, dist, 2);
  l.position.set(X, Z, Y);                                            // scene (X, Y, Z) -> three (x, z, y)
  edgeLights.push(l); scene.add(l);
};
for (const z of [92, 70, 48]) edgeLight(19, 31, z, 150, 26);          // left edge of the stem
for (const z of [60, 36, 14]) edgeLight(117, 34, z, 130, 26);         // right end of the bowl
edgeLight(48, 30, 100, 90, 22);
edgeLight(56, 76, -52, 330, 80);                                      // low red glow under the island: the stalactite tips catch it
edgeLight(112, 62, -44, 240, 70);
edgeLight(6, 62, -38, 200, 60);                                       // top front corner of the stem

/* ---------- camera + render ---------- */
const bbox = new THREE.Box3();
blocks.forEach((b) => bbox.expandByPoint(new THREE.Vector3(b.X, b.Z, b.Y)));
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
  g2.filter = 'blur(' + Math.round(UNIT_PX * 1.3) + 'px)';
  g2.drawImage(t, 0, 0);
  octx.globalCompositeOperation = 'screen';
  octx.globalAlpha = 0.5;
  octx.drawImage(t2, 0, 0);
}

window.__sculptureSize = [W, H];
window.__sculptureCanvas = out;
window.__sculptureStats = { blocks: blocks.length, draws: groups.size, minZ: Math.min(...blocks.map((b) => b.Z)) };
window.__sculptureReady = true;
