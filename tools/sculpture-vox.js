/*
 * Blitzedo home sculpture (build-time, three.js): a pixel-art voxel diorama.
 *
 * Everything is built from voxels (V units; a big block is 6 x 6 x 6 of them). Each visible voxel face gets one flat colour,
 * so the render reads as pixel art, like the reference (design/references/sculpture/*):
 *   - charcoal stone with lighter chips, pits and per-block tone, dark seams between blocks and a lit bevel on their upper edges
 *   - red light painted the pixel-art way: red-lit block tops (a checker of red and dark blocks), broken red rims along the
 *     letter's edges, red treads, red stalactite tips under the island
 *   - a recessed gate with a stepped pixel arch: coral back wall, dark red side wall, red floor tiles, a red threshold outside
 *   - stairs that start at the gate, run left along the stem's front to a mid landing, turn, and climb back to the top landing
 * Faces are shaded by orientation (tops light, fronts mid, right faces darker), so no lights or shadows are needed.
 * Only +X, +Y and +Z faces are built: the camera can never see the others.
 *
 * Scene axes (units): X runs along the b's face, Z is up, Y is depth (front = +Y). three.js maps these to x = X, y = Z, z = Y.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const UNIT_PX = 10.6;                 // output pixels per unit
const V = 2.5;                        // voxel size: a 15-unit big block is 6 voxels across (chunky pixels)

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

/* ---------- voxel grid ---------- */
const GX0 = -90, GY0 = -60, GZ0 = -150;          // grid origin (units)
const NX = 130, NY = 84, NZ = 124;
const kind = new Uint8Array(NX * NY * NZ);        // 0 empty, 255 door air (empty, but not an outer edge), else material
const bid = new Int32Array(NX * NY * NZ);         // block id: seams are drawn where it changes
const idx = (i, j, k) => (i * NY + j) * NZ + k;
const inb = (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < NX && j < NY && k < NZ;
const K = (i, j, k) => (inb(i, j, k) ? kind[idx(i, j, k)] : 0);
const solid = (i, j, k) => { const v = K(i, j, k); return v !== 0 && v < 254; };
const vi = (X) => Math.round((X - GX0) / V), vj = (Y) => Math.round((Y - GY0) / V), vk = (Z) => Math.round((Z - GZ0) / V);
const cx = (i) => GX0 + (i + 0.5) * V, cy = (j) => GY0 + (j + 0.5) * V, cz = (k) => GZ0 + (k + 0.5) * V;

const KIND = { LETTER: 1, ISLAND: 2, STAIR: 3, THRESH: 4, LOOSE: 5, TOWER: 6, SMALLDOOR: 254, DOOR: 255 };
const blocks = [null];                            // block id -> { redTop, tone }
function newBlock(redTop, tone) { blocks.push({ redTop, tone: tone ?? (hash3(blocks.length, 7, 1, 3) - 0.5) * 0.03 }); return blocks.length - 1; }
function fillBox(x0, x1, y0, y1, z0, z1, k, b) {  // units; cells whose centres fall inside
  for (let i = vi(x0); i < vi(x1); i++) for (let j = vj(y0); j < vj(y1); j++) for (let kk = vk(z0); kk < vk(z1); kk++) {
    if (!inb(i, j, kk)) continue;
    kind[idx(i, j, kk)] = k; bid[idx(i, j, kk)] = b;
  }
}

/* ---------- the b ---------- */
const STEM = { x0: 30, x1: 60, y0: 15, y1: 45, h: 120 };
const BOWL = { x0: 45, x1: 135, y0: 15, y1: 45, h: 75, rTop: 37.5 };
const DOOR = { x0: 75, x1: 105, zRect: 37.5, cx: 90, r: 15, recessY: 30 };   // arched gate, recessed one big block
const inCircle = (x, z, ox, oz, r) => (x - ox) ** 2 + (z - oz) ** 2 <= r * r;
function inBowl(X, Z) {
  if (X < BOWL.x0 || X >= BOWL.x1 || Z < 0 || Z >= BOWL.h) return false;
  const ox = BOWL.x1 - BOWL.rTop, oz = BOWL.h - BOWL.rTop;
  const Xs = Math.floor(X / 5) * 5 + 2.5, Zs = Math.floor(Z / 5) * 5 + 2.5;     // the curve is cut on a 2-voxel grid: bigger steps
  return !(Xs > ox && Zs > oz && !inCircle(Xs, Zs, ox, oz, BOWL.rTop));
}
const inStem = (X, Z) => X >= STEM.x0 && X < STEM.x1 && Z >= 0 && Z < STEM.h;
const inDoor = (X, Z) => X >= DOOR.x0 && X < DOOR.x1 && Z >= 0 && (Z < DOOR.zRect || inCircle(X, Z, DOOR.cx, DOOR.zRect, DOOR.r));

function buildLetter() {
  const cells = new Map();                        // big-block cells of the letter, so seams fall on the 15-unit grid
  const cellBlock = (X, Y, Z) => {
    const key = Math.floor(X / 15) + ',' + Math.floor(Y / 15) + ',' + Math.floor(Z / 15);
    if (!cells.has(key)) {
      const top = Math.floor(Z / 15);
      const ci = Math.floor(X / 7.5), cj = Math.floor(Y / 7.5);
      cells.set(key, newBlock(((ci + cj) & 1) === (hash3(ci, cj, top, 11) < 0.2 ? 1 : 0)));   // red / dark checker, a few swapped
    }
    return cells.get(key);
  };
  for (let i = vi(STEM.x0); i < vi(BOWL.x1); i++) for (let k = vk(0); k < vk(STEM.h); k++) {
    const X = cx(i), Z = cz(k);
    if (!inStem(X, Z) && !inBowl(X, Z)) continue;
    for (let j = vj(STEM.y0); j < vj(STEM.y1); j++) {
      const Y = cy(j);
      if (inDoor(X, Z) && Y > DOOR.recessY) { kind[idx(i, j, k)] = KIND.DOOR; continue; }
      kind[idx(i, j, k)] = KIND.LETTER; bid[idx(i, j, k)] = cellBlock(X, Y, Z);
    }
  }
}

/* ---------- stairs: from the gate, left along the stem's front to a mid landing, turn, back up to the top landing ---------- */
// The tower at the front-left carries the mid landing (its front, 45 high) and the upper flight, which climbs back (-Y) to the top
// landing beside the stem's front-left corner; there a small dark doorway is cut into the stem. The lower flight runs along the
// stem's front from the tower down to the gate's threshold. Steps are 5 run / 5 rise (two voxels).
const STEP = 5;
const MID_Z = 45, TOP_Z = 65;
const SMALL_DOOR = { x0: 30, x1: 37.5, y0: 37.5, y1: 45, z0: TOP_Z, zRect: 75, r: 3.75 };
function buildStairs() {
  fillBox(10, 30, 50, 62.5, 0, MID_Z, KIND.TOWER, newBlock(true));                                 // mid landing (tower front)
  for (let s = 1; s <= 3; s++) fillBox(10, 30, 50 - STEP * s, 55 - STEP * s, 0, MID_Z + STEP * s, KIND.STAIR, newBlock(true));
  fillBox(10, 30, 25, 35, 0, TOP_Z, KIND.TOWER, newBlock(true));                                    // top landing, beside the stem
  for (let s = 0; s < 8; s++) fillBox(30 + STEP * s, 35 + STEP * s, 45, 55, 0, MID_Z - STEP * (s + 1), KIND.STAIR, newBlock(true));
  fillBox(70, 110, 45, 55, 0, 2.5, KIND.THRESH, newBlock(true));                                   // threshold: two tile rows
  // the small doorway: a dark recess in the stem's front at the top landing
  for (let i = vi(SMALL_DOOR.x0); i < vi(SMALL_DOOR.x1); i++) for (let j = vj(SMALL_DOOR.y0); j < vj(SMALL_DOOR.y1); j++) for (let k = vk(SMALL_DOOR.z0); k < vk(SMALL_DOOR.zRect + SMALL_DOOR.r); k++) {
    const X = cx(i), Z = cz(k);
    if (Z >= SMALL_DOOR.zRect && !inCircle(X, Z, (SMALL_DOOR.x0 + SMALL_DOOR.x1) / 2, SMALL_DOOR.zRect, SMALL_DOOR.r + 0.1)) continue;
    if (inb(i, j, k)) kind[idx(i, j, k)] = KIND.SMALLDOOR;
  }
}

/* ---------- floating island ---------- */
const CELL = 15;
const PLAT = { cx: 70, cy: 36, ax: 88, ay: 50 };
const rOf = (x, y) => Math.pow(Math.abs((x - PLAT.cx) / PLAT.ax) ** 4 + Math.abs((y - PLAT.cy) / PLAT.ay) ** 4, 1 / 4);
const depthAt = (x, y) => 12 + 72 * Math.pow(Math.max(0, 1 - Math.min(1, rOf(x, y))), 1.2);
const underLetter = (x, y) => x > 0 && x < 140 && y > 0 && y < 65;
function buildIsland() {
  for (let ci = -8; ci <= 14; ci++) for (let cj = -6; cj <= 10; cj++) {
    const x = ci * CELL + CELL / 2, y = cj * CELL + CELL / 2;
    const rr = rOf(x, y);
    if (rr > 1) continue;
    const r = hash3(ci, cj, 0, 2);
    const covered = underLetter(x, y);
    const rim = rr > 0.78 && !covered;
    let top = 0;
    if (rim) top = r < 0.12 ? -7.5 : 0;                                      // uneven rim: the odd block sits lower
    const red = covered ? false : ((ci + cj) & 1) === (hash3(ci, cj, 5, 7) < 0.25 ? 1 : 0);
    const h1 = rim ? [15, 22.5][Math.floor(hash3(ci, cj, 2, 9) * 2)] : 15;
    fillBox(x - 7.5, x + 7.5, y - 7.5, y + 7.5, top - h1, top, KIND.ISLAND, newBlock(red));
    // hanging columns: 2 x 2 half blocks, each with 2 x 2 quarter-block tips
    const D = depthAt(x, y);
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
      const xs = x - 3.75 + a * 7.5, ys = y - 3.75 + b * 7.5, hh = ci * 977 + cj * 131 + a * 17 + b * 5;
      const L2 = Math.max(0, Math.round((D * (0.55 + 0.7 * hash3(hh, 1, 0, 3)) - h1) / 7.5));
      const z1 = top - h1;
      for (let q = 0; q < L2; q++) fillBox(xs - 3.75, xs + 3.75, ys - 3.75, ys + 3.75, z1 - 7.5 * (q + 1), z1 - 7.5 * q, KIND.ISLAND, newBlock(false));
      const z2 = z1 - 7.5 * L2;
      for (let c = 0; c < 2; c++) for (let d = 0; d < 2; d++) {
        const h3 = hh * 13 + c * 3 + d;
        const L3 = hash3(h3, 2, 0, 4) < 0.6 ? 1 + Math.floor(hash3(h3, 3, 0, 5) * 4) : 0;   // pointed tips
        if (L3) fillBox(xs - 3.75 + c * 3.75, xs + c * 3.75, ys - 3.75 + d * 3.75, ys + d * 3.75, z2 - 3.75 * L3, z2, KIND.ISLAND, newBlock(false));
      }
    }
  }
}

/* ---------- loose floating cubes ---------- */
const LOOSE = [[-40, 70, -40, 11.25], [-10, 100, -75, 7.5], [40, 112, -100, 11.25], [118, 104, -78, 7.5], [160, 84, -50, 11.25], [175, 40, -30, 7.5]];
function buildLoose() {
  LOOSE.forEach(([X, Y, Z, s]) => {
    fillBox(X - s / 2, X + s / 2, Y - s / 2, Y + s / 2, Z - s / 2, Z + s / 2, KIND.LOOSE, newBlock(true));
    fillBox(X - s / 4, X + s / 4, Y - s / 4, Y + s / 4, Z - s / 2 - 3.75, Z - s / 2, KIND.LOOSE, newBlock(false));   // a small tip below
  });
}

buildIsland();
buildLetter();
buildStairs();
buildLoose();

/* ---------- colour ---------- */
const STONE_FACE = { top: 1.5, front: 1.0, right: 0.74 };
const RED_FACE = { top: 1.0, front: 0.86, right: 0.66 };
const REDS = [[0.93, 0.17, 0.15], [0.88, 0.14, 0.12], [0.98, 0.27, 0.22], [0.74, 0.1, 0.09]];
function redColour(i, j, k, f) {
  const n = hash3(i, j, k, 40 + f);
  const c = n < 0.03 ? REDS[3] : n < 0.86 ? REDS[0] : n < 0.94 ? REDS[1] : REDS[2];
  const m = f === 0 ? RED_FACE.top : f === 1 ? RED_FACE.front : RED_FACE.right;
  return [c[0] * m, c[1] * m, c[2] * m];
}
function stoneValue(i, j, k, f, b) {
  let v = 0.125 + (blocks[b] ? blocks[b].tone : 0);
  const n = hash3(i, j, k, 20 + f), c2 = hash3(i >> 1, j >> 1, k >> 1, 23 + f);
  if (c2 > 0.8) v += 0.055;                                   // lighter 2 x 2 chips
  if (n > 0.9) v += 0.04;                                     // single light flecks
  if (n < 0.08) v -= 0.035;                                   // pits
  v += (vnoise(i, j, k, 5, 25 + f) - 0.5) * 0.04;
  return Math.max(0.03, v);
}

// distance (1..3, 0 = none) along an in-plane direction to the outside (real air, not the gate's recess)
function edgeDist(i, j, k, di, dj, dk) {
  for (let d = 1; d <= 2; d++) if (K(i + di * d, j + dj * d, k + dk * d) === 0) return d;
  return 0;
}

const FACE_DIRS = [[0, 0, 1], [0, 1, 0], [1, 0, 0]];          // top (+Z), front (+Y), right (+X)
const IN_PLANE = [[[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]], [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]], [[0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]];

function faceColour(i, j, k, f) {
  const kd = kind[idx(i, j, k)], b = bid[idx(i, j, k)], blk = blocks[b];
  const [di, dj, dk] = FACE_DIRS[f];
  const into = K(i + di, j + dj, k + dk);

  // the gate: faces looking into its recess glow
  if (into === KIND.DOOR) {
    const n = hash3(i, j, k, 60 + f);
    if (f === 1) {                                            // back wall: flat coral, faint pixel grain, a little brighter low down
      const low = Math.max(0, 1 - (cz(k) / 50));
      const base = n > 0.97 ? [0.96, 0.3, 0.24] : n < 0.03 ? [0.84, 0.18, 0.15] : [0.92, 0.25, 0.2];
      return base.map((c, q) => Math.min(1, c * (0.94 + 0.1 * low) + (q === 0 ? 0 : 0.02 * low)));
    }
    if (f === 2) {                                            // side wall (jamb): darker red with dark specks
      const base = n < 0.08 ? [0.48, 0.07, 0.06] : n > 0.92 ? [0.74, 0.13, 0.11] : [0.64, 0.1, 0.09];
      return base;
    }
    return n > 0.8 ? [0.98, 0.33, 0.26] : [0.9, 0.22, 0.18];  // floor tiles
  }

  if (into === KIND.SMALLDOOR) { const n = hash3(i, j, k, 66); return n < 0.2 ? [0.02, 0.02, 0.02] : [0.05, 0.045, 0.045]; }

  const exposedAbove = !solid(i, j, k + 1);
  let red = false;
  if (kd === KIND.THRESH) red = true;
  else if (f === 0) {
    if (kd === KIND.LETTER) {                                 // letter tops: a red / dark checker of big blocks, a few swapped
      const hi = Math.floor(cx(i) / 15), hj = Math.floor(cy(j) / 15), hk = Math.floor(cz(k) / 15);
      red = ((hi + hj) & 1) === (hash3(hi, hj, hk, 11) < 0.2 ? 1 : 0);
    } else red = !!(blk && blk.redTop);
    if (kd === KIND.STAIR || kd === KIND.TOWER) red = true;
  } else if (exposedAbove && (kd === KIND.LETTER ? (((Math.floor(cx(i) / 15) + Math.floor(cy(j) / 15)) & 1) === (hash3(Math.floor(cx(i) / 15), Math.floor(cy(j) / 15), Math.floor(cz(k) / 15), 11) < 0.2 ? 1 : 0)) : blk && blk.redTop) && (kd === KIND.LOOSE || kd === KIND.ISLAND || kd === KIND.LETTER || kd === KIND.TOWER)) {
    red = hash3(i, j, k, 31 + f) < (kd === KIND.LETTER ? 0.12 : kd === KIND.TOWER ? 0.5 : 0.6);   // the red top wraps one voxel down the sides (a lit lip)
  }

  // broken red rims along the letter's and the stairs' outer edges
  if (!red && f > 0 && (kd === KIND.LETTER || kd === KIND.TOWER)) {
    const dirs = IN_PLANE[f].filter((d) => d[2] === 0);         // vertical edges only: left / right ends of a face
    let dmin = 9, along = 0;
    for (const [a, bb, c] of dirs) {
      const d = edgeDist(i, j, k, a, bb, c);
      if (d && d < dmin) { dmin = d; along = k; }
    }
    if (dmin <= 3) {
      const w = 1 + (hash3(along, f, kd, 33) > 0.6 ? 1 : 0);
      const on = vnoise(along, f, kd, 4, 35) > 0.28;
      if (on && dmin <= w) red = hash3(i, j, k, 36) < 0.92;
    }
  }

  // island: red stalactite tips and a few red pixels on the fronts
  if (!red && (kd === KIND.ISLAND || kd === KIND.LOOSE)) {
    const bottom = !solid(i, j, k - 1) && cz(k) < -12;
    const tip = bottom && !solid(i + 1, j, k) && !solid(i, j + 1, k);   // the lowest voxel of a free-hanging column
    if (bottom) red = hash3(i, j, k, 37) < (tip ? 0.8 : 0.08);
    else if (f > 0) red = hash3(i, j, k, 39) < 0.008;
  } else if (!red && f > 0 && kd === KIND.LETTER) red = hash3(i, j, k, 39) < 0.006;

  // spill from the gate onto the frame and the floor just outside it
  let spill = 0;
  if (f === 1 && kd === KIND.LETTER) {
    const X = cx(i), Z = cz(k);
    const dx = X < DOOR.x0 ? DOOR.x0 - X : X > DOOR.x1 ? X - DOOR.x1 : 0;
    if (dx < 5 && Z < DOOR.zRect + 6) spill = Math.max(0, 0.35 - dx * 0.07) * (Z < 12 ? 1.3 : 1);
  }

  if (red) return redColour(i, j, k, f);

  let v = stoneValue(i, j, k, f, b);
  v *= f === 0 ? STONE_FACE.top : f === 1 ? STONE_FACE.front : STONE_FACE.right;
  // seams and bevels where the block changes inside this face's plane
  const dirs = IN_PLANE[f];
  for (let q = 0; q < 4; q++) {
    const [a, bb, c] = dirs[q];
    const ni = i + a, nj = j + bb, nk = k + c;
    if (solid(ni, nj, nk) && bid[idx(ni, nj, nk)] !== b) {
      const lowSide = (f === 0 && (a > 0 || bb > 0)) || (f !== 0 && (c < 0 || a > 0 || bb < 0));
      v *= lowSide ? 0.72 : 1.16;
    }
  }
  // contact shadow on tops right in front of a taller wall
  if (f === 0 && (solid(i, j - 1, k + 1) || solid(i - 1, j, k + 1))) v *= 0.7;
  const col = [v, v * 0.98, v * 0.96];
  if (spill) return [col[0] + spill * 0.7, col[1] + spill * 0.08, col[2] + spill * 0.06];
  return col;
}

/* ---------- geometry: one quad per visible voxel face ---------- */
const pos = [], cols = [];
const tmp = new THREE.Color();
function pushQuad(c, corners) {
  tmp.setRGB(Math.min(1, c[0]), Math.min(1, c[1]), Math.min(1, c[2]), THREE.SRGBColorSpace);
  for (const n of [0, 1, 2, 0, 2, 3]) {
    const [X, Y, Z] = corners[n];
    pos.push(X, Z, Y);
    cols.push(tmp.r, tmp.g, tmp.b);
  }
}
let faces = 0;
for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) for (let k = 0; k < NZ; k++) {
  if (!solid(i, j, k)) continue;
  const x = GX0 + i * V, y = GY0 + j * V, z = GZ0 + k * V;
  if (!solid(i, j, k + 1)) { pushQuad(faceColour(i, j, k, 0), [[x, y, z + V], [x + V, y, z + V], [x + V, y + V, z + V], [x, y + V, z + V]]); faces++; }
  if (!solid(i, j + 1, k)) { pushQuad(faceColour(i, j, k, 1), [[x, y + V, z], [x + V, y + V, z], [x + V, y + V, z + V], [x, y + V, z + V]]); faces++; }
  if (!solid(i + 1, j, k)) { pushQuad(faceColour(i, j, k, 2), [[x + V, y, z], [x + V, y + V, z], [x + V, y + V, z + V], [x + V, y, z + V]]); faces++; }
}
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
scene.add(new THREE.AmbientLight(0xffffff, 1.0));                 // only the explorer uses lights

/* ---------- explorer ---------- */
const LANDING_Z = TOP_Z;
(function explorer() {
  // The explorer from the reference: a chibi figure with a big round white helmet and a black visor, a small white body, short arms and
  // legs mid-stride, and a red scarf whose long tail streams out behind him. Self-lit ivory so the red light does not tint him.
  const g = new THREE.Group();
  const ivory = new THREE.MeshStandardMaterial({ color: 0xb0aba0, roughness: 0.5, emissive: 0xf6f1e6, emissiveIntensity: 0.8 });
  const shade = new THREE.MeshStandardMaterial({ color: 0x8a857b, roughness: 0.6, emissive: 0xcdc6b7, emissiveIntensity: 0.62 });
  const red = new THREE.MeshStandardMaterial({ color: 0xe5262b, roughness: 0.6, emissive: 0xd81c20, emissiveIntensity: 0.7, side: THREE.DoubleSide });
  const redDark = new THREE.MeshStandardMaterial({ color: 0x8a1014, roughness: 0.8, emissive: 0x7a0c10, emissiveIntensity: 0.7, side: THREE.DoubleSide });
  const black = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.25, metalness: 0.2 });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    m.castShadow = true; g.add(m); return m;
  };
  // legs mid-stride and boots
  add(new THREE.BoxGeometry(1.7, 3.6, 1.8), shade, -0.8, 1.9, -1.0, 0, 0, 0.18);
  add(new THREE.BoxGeometry(1.7, 3.6, 1.8), ivory, 0.9, 1.9, 1.0, 0, 0, -0.22);
  // body: a white tunic, wider at the hem
  add(new THREE.CylinderGeometry(2.3, 3.0, 5.2, 12), ivory, 0, 6.2, 0);
  // arms
  add(new THREE.BoxGeometry(1.3, 3.8, 1.4), ivory, 2.6, 6.2, 1.8, 0.35, 0, -0.45);
  add(new THREE.BoxGeometry(1.3, 3.6, 1.4), shade, -2.4, 6.3, -1.6, -0.3, 0, 0.4);
  // helmet: a rounded box about as wide as the shoulders, black visor on the viewer's side
  add(new RoundedBoxGeometry(5.8, 5.4, 5.8, 3, 1.8), ivory, 0.2, 11.4, 0);
  add(new RoundedBoxGeometry(0.8, 2.2, 2.6, 2, 0.3), black, 3.05, 11.6, 0.9, 0, 0.15, 0);
  // scarf: a collar and a long notched tail streaming behind
  add(new THREE.TorusGeometry(2.3, 0.7, 8, 24), red, 0.1, 8.75, 0, Math.PI / 2, 0, 0);
  const tail = new THREE.Shape();
  tail.moveTo(0, 0.6); tail.lineTo(-5, 2.0); tail.lineTo(-11.5, 2.4); tail.lineTo(-9.6, 0.9); tail.lineTo(-12.4, -0.6);
  tail.lineTo(-8.6, -1.0); tail.lineTo(-4.4, -1.6); tail.lineTo(0, -1.4); tail.closePath();
  add(new THREE.ExtrudeGeometry(tail, { depth: 0.4, bevelEnabled: false }), red, -1.4, 8.9, -0.4, 0, 0.35, -0.05);
  add(new THREE.ExtrudeGeometry(tail, { depth: 0.3, bevelEnabled: false }), redDark, -1.2, 8.3, -1.2, 0, 0.55, 0.08).scale.set(0.75, 0.7, 1);
  g.scale.setScalar(1.3);
  g.rotation.y = -0.4;                                                     // facing right, down the flight toward the gate
  g.position.set(21, LANDING_Z, 40);
  scene.add(g);
})();


/* ---------- camera + render ---------- */
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000);
const centre = new THREE.Vector3(60, 0, 30);
const AZ = 40 * Math.PI / 180, EL = 24 * Math.PI / 180;
camera.position.copy(centre).add(new THREE.Vector3(Math.sin(AZ) * Math.cos(EL), Math.sin(EL), Math.cos(AZ) * Math.cos(EL)).multiplyScalar(1500));
camera.lookAt(centre);
camera.updateMatrixWorld(true);
let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
const pv = new THREE.Vector3();
for (let n = 0; n < pos.length; n += 3) {
  pv.set(pos[n], pos[n + 1], pos[n + 2]).applyMatrix4(camera.matrixWorldInverse);
  if (pv.x < minX) minX = pv.x; if (pv.x > maxX) maxX = pv.x; if (pv.y < minY) minY = pv.y; if (pv.y > maxY) maxY = pv.y;
}
minX -= 4; maxX += 4; minY -= 4; maxY += 6;
Object.assign(camera, { left: minX, right: maxX, top: maxY, bottom: minY });
camera.updateProjectionMatrix();
const W = Math.ceil((maxX - minX) * UNIT_PX), H = Math.ceil((maxY - minY) * UNIT_PX);
window.__project = (X, Y, Z) => { const v = new THREE.Vector3(X, Z, Y).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
document.body.appendChild(renderer.domElement);
renderer.render(scene, camera);

// a soft halo only around the gate's glow
const out = document.createElement('canvas');
out.width = W; out.height = H;
const octx = out.getContext('2d');
octx.drawImage(renderer.domElement, 0, 0);
{
  const t = document.createElement('canvas'); t.width = W; t.height = H;
  const g = t.getContext('2d'); g.drawImage(out, 0, 0);
  const img = g.getImageData(0, 0, W, H), d = img.data;
  for (let n = 0; n < d.length; n += 4) if (!(d[n] > 225 && d[n + 1] > 50 && d[n + 1] < 140)) d[n + 3] = 0;
  g.putImageData(img, 0, 0);
  const t2 = document.createElement('canvas'); t2.width = W; t2.height = H;
  const g2 = t2.getContext('2d'); g2.filter = 'blur(' + Math.round(UNIT_PX * 2.2) + 'px)'; g2.drawImage(t, 0, 0);
  octx.globalCompositeOperation = 'screen'; octx.globalAlpha = 0.25; octx.drawImage(t2, 0, 0);
}

window.__sculptureSize = [W, H];
window.__sculptureCanvas = out;
window.__sculptureStats = { faces, blocks: blocks.length };
window.__sculptureReady = true;
