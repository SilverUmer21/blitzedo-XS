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
const BOWL = { x0: 45, x1: 135, y0: 15, y1: 45, h: 75, rTop: 40, rBot: 35 };   // a D: rounded top and bottom of the right end
const DOOR = { x0: 75, x1: 105, zRect: 37.5, cx: 90, r: 15, recessY: 30 };   // arched gate, recessed one big block
const inCircle = (x, z, ox, oz, r) => (x - ox) ** 2 + (z - oz) ** 2 <= r * r;
function inBowl(X, Z) {
  if (X < BOWL.x0 || X >= BOWL.x1 || Z < 0 || Z >= BOWL.h) return false;
  const ox = BOWL.x1 - BOWL.rTop, oz = BOWL.h - BOWL.rTop;
  if (X > ox && Z > oz && !inCircle(X, Z, ox, oz, BOWL.rTop)) return false;   // cut voxel by voxel: a round curve
  const bx = BOWL.x1 - BOWL.rBot, bz = BOWL.rBot;
  return !(BOWL.rBot && X > bx && Z < bz && !inCircle(X, Z, bx, bz, BOWL.rBot));
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
const STEP = 7.5;                                 // chunky steps: 3 voxels run and rise, like the reference
const MID_Z = 52.5, TOP_Z = 75;
const SMALL_DOOR = { x0: 30, x1: 37.5, y0: 37.5, y1: 45, z0: 70, zRect: 80, r: 3.75 };
const EXPLORER_AT = [20, 39, 65];
function buildStairs() {
  // as in the reference, one continuous path with a 5-unit rise everywhere: the explorer's landing at the stem's front-left corner
  // (65 high); two steps down toward the viewer onto the tower's top (50); then a long flight of nine small steps (5 run, 5 rise)
  // running right along the stem's front from the tower, down to the gate step. One big block deep.
  fillBox(10, 30, 30, 45, 0, 65, KIND.TOWER, newBlock(true));                                       // top landing (explorer)
  fillBox(10, 30, 45, 50, 0, 60, KIND.STAIR, newBlock(true));                                       // two steps down onto the tower
  fillBox(10, 30, 50, 55, 0, 55, KIND.STAIR, newBlock(true));
  fillBox(10, 30, 55, 62.5, 0, 50, KIND.TOWER, newBlock(true));                                     // the tower: the turn landing
  for (let s = 0; s < 9; s++) fillBox(30 + 5 * s, 35 + 5 * s, 45, 62.5, 0, 50 - 5 * (s + 1), KIND.STAIR, newBlock(true));
  // the gate's step: red tiles from the gate along the bowl's front, then curving in under the bowl's rounded bottom ending
  const stepBlock = newBlock(true);
  for (let i = vi(65); i < vi(137.5); i++) for (let j = vj(15); j < vj(62.5); j++) {
    const X = cx(i), Y = cy(j);
    const front = Y >= 45 && X < 110;                                        // in front of the gate only
    const under = false;
    if (!front && !under) continue;
    for (let k = vk(0); k < vk(5); k++) if (inb(i, j, k) && kind[idx(i, j, k)] === 0) { kind[idx(i, j, k)] = KIND.THRESH; bid[idx(i, j, k)] = stepBlock; }
  }
}

/* ---------- floating island ---------- */
const CELL = 15;
const PLAT = { cx: 70, cy: 36, ax: 88, ay: 50 };
const rOf = (x, y) => Math.pow(Math.abs((x - PLAT.cx) / PLAT.ax) ** 4 + Math.abs((y - PLAT.cy) / PLAT.ay) ** 4, 1 / 4);
const depthAt = (x, y) => 12 + 72 * Math.pow(Math.max(0, 1 - Math.min(1, rOf(x, y))), 1.2);
const underLetter = (x, y) => x > 0 && x < 140 && y > 0 && y < 65;
let LINE_CELLS = new Set();
function buildIsland() {
  // the three red light lines: front-row columns on the left half (the frontmost cell of chosen columns ci)
  for (const ci of [1, 3, 5]) for (let cj = 10; cj >= -6; cj--) {
    if (rOf(ci * CELL + CELL / 2, cj * CELL + CELL / 2) <= 1) { LINE_CELLS.add(ci + ',' + cj); break; }
  }
  for (let ci = -8; ci <= 14; ci++) for (let cj = -6; cj <= 10; cj++) {
    const x = ci * CELL + CELL / 2, y = cj * CELL + CELL / 2;
    const rr = rOf(x, y);
    if (rr > 1 || x > 145) continue;                                         // the bowl sits near the island's right edge
    const r = hash3(ci, cj, 0, 2);
    const covered = underLetter(x, y);
    const rim = rr > 0.78 && !covered;
    let top = 0;
    if (rim) top = r < 0.12 ? -7.5 : 0;                                      // uneven rim: the odd block sits lower
    const shadowed = x > 100 && y < 60;                                        // under and behind the bowl's curved end: dark stone, so the curve reads
    const red = covered || shadowed ? false : ((ci + cj) & 1) === (hash3(ci, cj, 5, 7) < 0.25 ? 1 : 0);
    const h1 = rim ? [15, 22.5][Math.floor(hash3(ci, cj, 2, 9) * 2)] : 15;
    fillBox(x - 7.5, x + 7.5, y - 7.5, y + 7.5, top - h1, top, KIND.ISLAND, newBlock(red));
    // hanging column: this block's own stalactite, tapering in jagged steps (5, 4, 3, 2, 1 voxels wide), a black gap to its neighbours
    const D = h1 + (22 + 48 * Math.pow(Math.max(0, 1 - rr), 0.7)) * (0.7 + 0.6 * r);
    const i0 = vi(x - 7.5), j0 = vj(y - 7.5);                                   // the cell's first voxel (6 voxels per side)
    let z = top - h1, w = 5, ox = Math.floor(hash3(ci, cj, 3, 1) * 2), oy = Math.floor(hash3(ci, cj, 4, 1) * 2);
    const b2 = newBlock(false); blocks[b2].column = true;
    if (LINE_CELLS.has(ci + ',' + cj)) blocks[b2].line = true;
    while (z > top - D && w > 0) {
      const lev = 3 + Math.floor(hash3(ci * 7 + w, cj, 5, 2) * 3);           // 3-5 voxels per step
      for (let ii = 0; ii < w; ii++) for (let jj = 0; jj < w; jj++) {
        if ((ii === 0 || ii === w - 1) && (jj === 0 || jj === w - 1) && hash3(ci * 31 + ii, cj * 17 + jj, w, 6) < 0.5) continue;   // chipped corners
        const I = i0 + ox + ii + (w < 5 ? 1 : 0), J = j0 + oy + jj + (w < 5 ? 1 : 0);
        for (let kk = 0; kk < lev; kk++) { const K2 = vk(z) - 1 - kk; if (inb(I, J, K2)) { kind[idx(I, J, K2)] = KIND.ISLAND; bid[idx(I, J, K2)] = b2; } }
      }
      z -= lev * V;
      w -= 1;
      if (w < 5) { ox = Math.min(5 - w, Math.max(0, ox + (hash3(ci, cj, w, 7) < 0.5 ? 0 : 1) - (w < 4 ? 1 : 0))); oy = Math.min(5 - w, Math.max(0, oy + (hash3(cj, ci, w, 8) < 0.5 ? 0 : 1) - (w < 4 ? 1 : 0))); }
    }
  }
}

/* ---------- loose floating cubes ---------- */
const LOOSE = [[-40, 70, -30, 11.25], [-10, 96, -52, 7.5], [150, 84, -44, 11.25], [172, 40, -26, 7.5]];
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

roughen();

/* ---------- rough surface: random one-voxel dents in the visible faces of the island and the b ---------- */
function roughen() {
  const out = [];
  for (let i = 1; i < NX - 1; i++) for (let j = 1; j < NY - 1; j++) for (let k = 1; k < NZ - 1; k++) {
    const kd = kind[idx(i, j, k)];
    if (kd !== KIND.ISLAND && kd !== KIND.LETTER) continue;
    const fx = !solid(i + 1, j, k) && solid(i - 1, j, k), fy = !solid(i, j + 1, k) && solid(i, j - 1, k);
    if (!(fx || fy) || !solid(i, j, k + 1)) continue;                         // side faces only, never the tops
    if (kd === KIND.LETTER && (K(i + 1, j, k) >= 254 || K(i, j + 1, k) >= 254 || cz(k) < 5)) continue;
    if (hash3(i, j, k, 90) < (kd === KIND.ISLAND ? 0.03 : 0.025)) out.push(idx(i, j, k));
  }
  out.forEach((n) => { kind[n] = 0; });
}

/* ---------- colour ---------- */
const STONE_FACE = { top: 1.5, front: 1.0, right: 0.74 };
const RED_FACE = { top: 1.0, front: 0.86, right: 0.66 };
const REDS = [[0.93, 0.17, 0.15], [0.88, 0.14, 0.12], [0.98, 0.27, 0.22], [0.74, 0.1, 0.09]];
const DEMO_REDTEX = !/demo=flatred/.test(location.search);   // pixel-art red tiles are the live look; ?demo=flatred renders the old flat red
const DEMO_STONETEX = /demo=(stonetex|pixeltex)/.test(location.search);
// red as a crafted pixel-art tile per big block (like the explorer's pixel art): lit top-left edge, shaded bottom-right
// edge, a dark corner, and a few highlight / shade specks inside
function redTile(i, j, k, f) {
  const loc = (v) => Math.floor((((v % 15) + 15) % 15) / V);          // 0..5 within the block
  const X = cx(i), Y = cy(j), Z = cz(k);
  const u = f === 2 ? loc(Y) : loc(X), w = f === 0 ? loc(Y) : 5 - loc(Z);
  const hb = Math.floor(X / 15) * 31 + Math.floor(Y / 15) * 17 + Math.floor(Z / 15) * 7;
  const C = { H: [1.0, 0.42, 0.33], h: [1.0, 0.31, 0.24], R: [0.9, 0.15, 0.13], r: [0.66, 0.08, 0.07], d: [0.42, 0.04, 0.04] };
  let c;
  if ((u === 5 && w === 5)) c = C.d;
  else if (u === 0 || w === 0) c = (u + w) % 3 === 0 ? C.h : C.H;
  else if (u === 5 || w === 5) c = C.r;
  else { const n = hash3(hb, u * 7 + w, f, 77); c = n < 0.12 ? C.h : n > 0.9 ? C.r : C.R; }
  const m = f === 0 ? 1.0 : f === 1 ? 0.86 : 0.68;
  return [c[0] * m, c[1] * m, c[2] * m];
}
function redColour(i, j, k, f) {
  if (DEMO_REDTEX) return redTile(i, j, k, f);
  const n = hash3(i, j, k, 40 + f);
  const c = n < 0.03 ? REDS[3] : n < 0.86 ? REDS[0] : n < 0.94 ? REDS[1] : REDS[2];
  const m = f === 0 ? RED_FACE.top : f === 1 ? RED_FACE.front : RED_FACE.right;
  return [c[0] * m, c[1] * m, c[2] * m];
}
// demo: stone as a crafted pixel-art tile per big block, the same idea as the red tile: a lit top-left edge, a shaded bottom-right
// edge with a dark corner, and inside two or three lighter chips (2 x 1 or 2 x 2), a few pits and flecks
function stoneTile(i, j, k, f, b) {
  const loc = (v) => Math.floor((((v % 15) + 15) % 15) / V);
  const X = cx(i), Y = cy(j), Z = cz(k);
  const u = f === 2 ? loc(Y) : loc(X), w = f === 0 ? loc(Y) : 5 - loc(Z);
  const hb = Math.floor(X / 15) * 31 + Math.floor(Y / 15) * 17 + Math.floor(Z / 15) * 7 + f * 3;
  let v = 0.112 + (blocks[b] ? blocks[b].tone : 0);
  if (u === 5 && w === 5) return v - 0.06;
  if (u === 0 || w === 0) return v + ((u + w) % 4 === 1 ? 0.03 : 0.055);
  if (u === 5 || w === 5) return v - 0.04;
  for (let c = 0; c < 3; c++) {                                // chips: lighter clusters at block-chosen spots
    const cu = 1 + Math.floor(hash3(hb, c, 1, 92) * 3), cw = 1 + Math.floor(hash3(hb, c, 2, 92) * 3), big = hash3(hb, c, 3, 92) < 0.5;
    if (c === 2 && hash3(hb, 9, 9, 92) < 0.5) break;
    if (u >= cu && u <= cu + 1 && w >= cw && w <= cw + (big ? 1 : 0)) return v + (u === cu && w === cw ? 0.1 : 0.07);
  }
  const n = hash3(hb, u * 7 + w, 4, 93);
  return n < 0.12 ? v - 0.045 : n > 0.9 ? v + 0.035 : v;
}
function stoneValue(i, j, k, f, b) {
  if (DEMO_STONETEX) return stoneTile(i, j, k, f, b);
  let v = 0.12 + (blocks[b] ? blocks[b].tone : 0);
  const n = hash3(i, j, k, 20 + f), c2 = hash3(i >> 1, j >> 1, k >> 1, 23 + f), c3 = hash3(Math.floor(i / 3), Math.floor(j / 3), Math.floor(k / 3), 24 + f);
  if (c2 > 0.76) v += 0.085;                                  // lighter 2 x 2 chips
  if (n > 0.86) v += 0.06;                                    // single light flecks
  if (n < 0.12) v -= 0.05;                                    // pits
  if (c3 < 0.18) v -= 0.035;                                  // darker 3 x 3 patches
  v += (vnoise(i, j, k, 5, 25 + f) - 0.5) * 0.05;
  return Math.max(0.025, v);
}

// distance (1..3, 0 = none) along an in-plane direction to the outside (real air, not the gate's recess)
function edgeDist(i, j, k, di, dj, dk) {
  for (let d = 1; d <= 2; d++) if (K(i + di * d, j + dj * d, k + dk * d) === 0) return d;
  return 0;
}

const AZ = 40 * Math.PI / 180, EL = 24 * Math.PI / 180;
const VIEW = [Math.sin(AZ) * Math.cos(EL), Math.cos(AZ) * Math.cos(EL), Math.sin(EL)];   // toward the camera, in (X, Y, Z)
// Is the edge of voxel (i, j, k) in direction (a, b, c), at distance d, on the silhouette? True when that neighbour is empty and the
// view ray behind it (away from the camera) never meets stone.
function silhouette(i, j, k, a, b, c, d) {
  for (let q = 1; q <= d; q++) if (solid(i + a * q, j + b * q, k + c * q)) return false;
  let x = i + a * d + 0.5, y = j + b * d + 0.5, z = k + c * d + 0.5;
  for (let t = 0; t < 320; t++) {
    x -= VIEW[0] * 0.5; y -= VIEW[1] * 0.5; z -= VIEW[2] * 0.5;
    const ci = Math.floor(x), cj = Math.floor(y), ck = Math.floor(z);
    if (!inb(ci, cj, ck)) return true;
    if (solid(ci, cj, ck)) return false;
  }
  return true;
}

const FACE_DIRS = [[0, 0, 1], [0, 1, 0], [1, 0, 0]];          // top (+Z), front (+Y), right (+X)
const IN_PLANE = [[[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]], [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]], [[0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]];

let FLAG = 0;                                     // set by faceColour: 1 = red light, 2 = gate glow (for the live page's effects)
function faceColour(i, j, k, f) {
  FLAG = 0;
  const kd = kind[idx(i, j, k)], b = bid[idx(i, j, k)], blk = blocks[b];
  const [di, dj, dk] = FACE_DIRS[f];
  const into = K(i + di, j + dj, k + dk);

  // the gate: faces looking into its recess glow
  if (into === KIND.DOOR) {
    FLAG = 2;
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
  if (kd === KIND.THRESH) {                                   // tiles: red tops with dark joints, black front below a red lip
    if (f === 0) { if (i % 4 === 0 || j === vj(51.25)) return [0.45, 0.07, 0.06]; red = true; }
    else red = exposedAbove;
  }
  else if (f === 0) {
    const onCurve = kd === KIND.LETTER && cx(i) > BOWL.x1 - BOWL.rTop && cz(k) > BOWL.h - BOWL.rTop && cz(k) < BOWL.h - 3;
    if (onCurve) red = silhouette(i, j, k, 0, 1, 0, 1) || silhouette(i, j, k, 0, -1, 0, 1);   // curved shoulder: red only at its front / back edge
    else if (kd === KIND.LETTER) {                            // letter tops: a red / dark checker of big blocks, a few swapped
      const hi = Math.floor(cx(i) / 15), hj = Math.floor(cy(j) / 15), hk = Math.floor(cz(k) / 15);
      red = ((hi + hj) & 1) === (hash3(hi, hj, hk, 11) < 0.2 ? 1 : 0);
    } else red = !!(blk && blk.redTop);
    if (kd === KIND.STAIR || kd === KIND.TOWER) red = true;
  } else if (exposedAbove && kd === KIND.STAIR && f === 1) {
    red = true;                                               // the tread's red front edge, one pixel
  } else if (exposedAbove && (kd === KIND.LETTER ? (((Math.floor(cx(i) / 15) + Math.floor(cy(j) / 15)) & 1) === (hash3(Math.floor(cx(i) / 15), Math.floor(cy(j) / 15), Math.floor(cz(k) / 15), 11) < 0.2 ? 1 : 0)) : blk && blk.redTop) && (kd === KIND.LOOSE || kd === KIND.ISLAND || kd === KIND.LETTER || kd === KIND.TOWER)) {
    red = hash3(i, j, k, 31 + f) < (kd === KIND.LETTER ? 0 : kd === KIND.TOWER ? 0 : 0.25);   // the red top wraps one voxel down the sides (a lit lip)
  }

  // red outline: a face pixel whose edge borders the background (the shape's silhouette from the camera) is lit red.
  // Inner edges, where the view ray past the edge hits more stone, stay black, so the b and the island read by their outline.
  if (!red && f > 0) {
    const letterish = kd === KIND.LETTER || kd === KIND.TOWER || kd === KIND.STAIR;
    for (const [a, bb, c] of IN_PLANE[f]) {
      if (c > 0 && letterish) continue;                       // top edges of the letter are covered by the top checker
      // band width: 1 voxel always, 2 often, 3 sometimes, so the inner edge of the red band is ragged (wider on the letter)
      if (!letterish && c > 0) continue;                      // island: no red along the tops' edges (the top checker shows there)
      const band = letterish ? [1, 0.8, 0.4] : [1, 0, 0];
      let hit = false;
      for (let d = 1; d <= 3 && !hit; d++) {
        if (!(band[d - 1] > 0) || (letterish && hash3(i, j, k, 36 + d) >= band[d - 1])) continue;
        let inner = true;                                     // the d-1 voxels toward the edge are part of this same face
        for (let q = 1; q < d && inner; q++) inner = solid(i + a * q, j + bb * q, k + c * q) && !solid(i + a * q + FACE_DIRS[f][0], j + bb * q + FACE_DIRS[f][1], k + c * q + FACE_DIRS[f][2]);
        if (inner && silhouette(i + a * (d - 1), j + bb * (d - 1), k + c * (d - 1), a, bb, c, 1)) hit = true;
      }
      if (hit) {
        red = letterish ? vnoise(c === 0 ? k : (a !== 0 ? i : j), a + 2 * bb + 4 * c, f, 5, 35) > 0.14
          : c < 0 ? true                                                      // island: the bottom edge of each column tip is red
          : !!(blk && blk.line) && cz(k) < 0;                                // island sides: only the three chosen columns carry a line
        if (red) break;
      }
    }
  }

  // red catching the underside edges of the island's stepped columns and dents: the inner red lines of the reference
  if (!red && f > 0 && (kd === KIND.ISLAND || kd === KIND.LOOSE) && cz(k) < -2) {
    // vertical red lines down the column edges that face a gap (between columns too), whole edge on or off per column
    if (blk && blk.line && f === 1) for (const [a2, b2, c2] of IN_PLANE[f]) {
      if (c2 !== 0 || a2 !== -1 || solid(i + a2, j + b2, k)) continue;      // one line: the column's left front edge
      red = true; break;
    }
  }

  // spill from the gate onto the frame and the floor just outside it
  let spill = 0;
  if (f === 1 && kd === KIND.LETTER) {
    const X = cx(i), Z = cz(k);
    const dx = X < DOOR.x0 ? DOOR.x0 - X : X > DOOR.x1 ? X - DOOR.x1 : 0;
    if (dx < 5 && Z < DOOR.zRect + 6) spill = Math.max(0, 0.35 - dx * 0.07) * (Z < 12 ? 1.3 : 1);
  }

  if (red && f === 0 && Math.abs(cz(k) + V / 2 - EXPLORER_AT[2]) < 0.1 && (cx(i) - EXPLORER_AT[0] - 0.6) ** 2 / 16 + (cy(j) - EXPLORER_AT[1]) ** 2 / 9 < 1) {
    FLAG = 1; const c = redColour(i, j, k, f); return [c[0] * 0.55, c[1] * 0.5, c[2] * 0.5];   // the explorer's soft shadow under his boots
  }
  if (red) { FLAG = 1; return redColour(i, j, k, f); }

  let v = stoneValue(i, j, k, f, b);
  v *= f === 0 ? STONE_FACE.top : f === 1 ? STONE_FACE.front : STONE_FACE.right;
  // seams and bevels where the block changes inside this face's plane
  const dirs = IN_PLANE[f];
  for (let q = 0; q < 4; q++) {
    const [a, bb, c] = dirs[q];
    const ni = i + a, nj = j + bb, nk = k + c;
    if (!DEMO_STONETEX && solid(ni, nj, nk) && bid[idx(ni, nj, nk)] !== b) {
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
const REC = [];                                   // face records for the live page: i, j, k, face, flag, r, g, b, block
function face(i, j, k, f, corners) {
  const c = faceColour(i, j, k, f);
  pushQuad(c, corners); faces++;
  REC.push([i, j, k, f, FLAG, ...c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)), bid[idx(i, j, k)]]);
}
for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) for (let k = 0; k < NZ; k++) {
  if (!solid(i, j, k)) continue;
  const x = GX0 + i * V, y = GY0 + j * V, z = GZ0 + k * V;
  if (!solid(i, j, k + 1)) face(i, j, k, 0, [[x, y, z + V], [x + V, y, z + V], [x + V, y + V, z + V], [x, y + V, z + V]]);
  if (!solid(i, j + 1, k)) face(i, j, k, 1, [[x, y + V, z], [x + V, y + V, z], [x + V, y + V, z + V], [x, y + V, z + V]]);
  if (!solid(i + 1, j, k)) face(i, j, k, 2, [[x + V, y, z], [x + V, y + V, z], [x + V, y + V, z + V], [x + V, y, z + V]]);
}
// Path distance from the gate for the live page's light pulse: Dijkstra over the surface voxels (26 neighbours), cheap through
// voxels that carry red light and dear through plain stone, so the pulse runs along the treads and the red outlines like a fuse.
const PATH = new Float32Array(NX * NY * NZ).fill(Infinity);
{
  const lit = new Uint8Array(NX * NY * NZ);      // 1 = surface voxel, 2 = surface voxel with red light: only the surface is walked
  REC.forEach((r) => { const n = idx(r[0], r[1], r[2]); lit[n] = Math.max(lit[n], r[4] ? 2 : 1); });
  const heap = [];                                // binary heap of [dist, cell]
  const push = (d, n) => { heap.push([d, n]); let q = heap.length - 1; while (q > 0) { const p = (q - 1) >> 1; if (heap[p][0] <= heap[q][0]) break; [heap[p], heap[q]] = [heap[q], heap[p]]; q = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let q = 0; for (;;) { const l = 2 * q + 1, r = l + 1; let m = q; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === q) break; [heap[m], heap[q]] = [heap[q], heap[m]]; q = m; } } return top; };
  for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) for (let k = 0; k < NZ; k++) {
    const n = idx(i, j, k);
    if (lit[n] && kind[n] === KIND.THRESH && cx(i) > DOOR.x0 && cx(i) < DOOR.x1 && cy(j) < 50) { PATH[n] = 0; push(0, n); }   // the gate's step
  }
  const NB = [];
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) if (a || b || c) NB.push([a, b, c, Math.hypot(a, b, c)]);
  while (heap.length) {
    const [d, n] = pop();
    if (d > PATH[n]) continue;
    const k = n % NZ, j = ((n - k) / NZ) % NY, i = (n - k - j * NZ) / (NY * NZ);
    for (const [a, b, c, len] of NB) {
      const i2 = i + a, j2 = j + b, k2 = k + c;
      if (!inb(i2, j2, k2)) continue;
      const m = idx(i2, j2, k2);
      if (!lit[m]) continue;
      const nd = d + len * (lit[m] === 2 ? 1 : 6);
      if (nd < PATH[m]) { PATH[m] = nd; push(nd, m); }
    }
  }
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
// The explorer is a separate animated pixel-art sprite on the page (js/explorer.js); window.__anchor marks where he stands.


/* ---------- camera + render ---------- */
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000);
const centre = new THREE.Vector3(60, 0, 30);
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

/* ---------- the explorer: a 3D voxel figure, rendered with the same camera into animation frames ---------- */
// Voxels of e = 1.25 units (half the world voxel): finer, so he reads as a detailed pixel-art figure. He faces +X (down the stairs).
function explorerVoxels(fr) {
  const v = new Map();
  const set = (x, y, z, c) => v.set(x + ',' + y + ',' + z, c);
  const box = (x0, x1, y0, y1, z0, z1, c, skip) => { for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) if (!skip || !skip(x, y, z)) set(x, y, z, typeof c === 'function' ? c(x, y, z) : c); };
  const b = fr.bob;
  // legs and boots (one leg a step forward)
  box(-2, 0, -2, 0, 0, 4, 'w'); box(0, 2, 0, 2, 0, 4, 'W');
  box(-2, 1, -2, 0, 0, 1, 'B'); box(0, 3, 0, 2, 0, 1, 'B');
  // tunic: wider at the hem, a red lining at the bottom edge
  box(-3, 3, -3, 3, 4 + b, 6 + b, 'W', (x, y) => Math.abs(x + 0.5) > 2.5 && Math.abs(y + 0.5) > 2.5);
  box(-3, 3, -3, 3, 4 + b, 5 + b, (x, y) => (x === 2 || y === 2) && (x + y) % 2 === 0 ? 'r' : 'W', (x, y) => Math.abs(x + 0.5) > 2.5 && Math.abs(y + 0.5) > 2.5);
  box(-2, 2, -2, 2, 6 + b, 10 + b, 'W');
  // arms: the back arm hangs, the front arm hangs or waves
  box(-1, 1, -3, -2, 6 + b, 9 + b, 'w');
  if (fr.wave === 0) box(0, 1, 2, 3, 6 + b, 9 + b, 'W');
  else {                                                    // waving: the arm comes out in front of the helmet, hand high
    box(0, 1, 2, 4, 8 + b, 10 + b, 'W'); box(fr.wave === 1 ? 1 : 0, fr.wave === 1 ? 2 : 1, 4, 5, 10 + b, 15 + b, 'W'); set(fr.wave === 1 ? 2 : -1, 4, 15 + b, 'w');
  }
  // scarf: a collar ring with a highlight, and a tail streaming behind (-X), waving
  box(-3, 3, -3, 3, 10 + b, 12 + b, (x, y, z) => z === 11 + b && (x + y) % 3 === 0 ? 'H' : 'R', (x, y) => Math.abs(x + 0.5) < 1.6 && Math.abs(y + 0.5) < 1.6);
  for (let c = 1; c <= 9; c++) {
    const x = -3 - c;
    const zc = 10 + b - Math.round(c * 0.35) + Math.round(Math.sin(c * 0.8 - fr.tail * Math.PI / 2) * (0.4 + c * 0.12));
    const yc = Math.round(Math.sin(c * 0.6 - fr.tail * Math.PI / 2 + 1) * 0.8);
    const th = c < 4 ? 2 : 1;
    for (let q = 0; q < th; q++) { set(x, yc, zc + q, q === th - 1 ? 'R' : 'r'); set(x, yc - 1, zc + q, 'r'); }
    if (c === 9) { set(x - 1, yc, zc + 1, 'R'); set(x - 1, yc - 1, zc - 1, 'r'); }
  }
  // helmet: a rounded box with a seam, a black visor on the +X face (on the +Y face when glancing at the viewer)
  box(-4, 4, -4, 4, 12 + b, 19 + b, (x, y, z) => (z === 18 + b ? 'W' : x === -4 || y === -4 ? 'w' : 'W'),
    (x, y, z) => (Math.abs(x + 0.5) > 3 && Math.abs(y + 0.5) > 3) || ((z === 12 + b || z === 18 + b) && (Math.abs(x + 0.5) > 3 || Math.abs(y + 0.5) > 3)));
  if (!fr.look) { box(4, 5, -1, 3, 14 + b, 17 + b, 'K'); set(4, 2, 16 + b, 'L'); }
  else { box(0, 4, 4, 5, 14 + b, 17 + b, 'K'); set(3, 4, 16 + b, 'L'); }
  return v;
}
const EXP_COL = { W: [0.97, 0.95, 0.91], w: [0.86, 0.83, 0.77], B: [0.17, 0.15, 0.14], K: [0.03, 0.03, 0.03], L: [0.45, 0.45, 0.45],
  R: [0.89, 0.15, 0.17], r: [0.62, 0.08, 0.1], H: [1.0, 0.36, 0.29] };
function explorerMesh(fr) {
  const e = 1.25, vox = explorerVoxels(fr), ps = [], cs = [], c3 = new THREE.Color();
  const has = (x, y, z) => vox.has(x + ',' + y + ',' + z);
  const ox = EXPLORER_AT[0], oy = EXPLORER_AT[1], oz = EXPLORER_AT[2];
  const quad = (col, m, q) => {
    c3.setRGB(Math.min(1, col[0] * m), Math.min(1, col[1] * m), Math.min(1, col[2] * m), THREE.SRGBColorSpace);
    for (const n of [0, 1, 2, 0, 2, 3]) { const [X, Y, Z] = q[n]; ps.push(ox + X * e, oz + Z * e, oy + Y * e); cs.push(c3.r, c3.g, c3.b); }
  };
  for (const [key, ch] of vox) {
    const [x, y, z] = key.split(',').map(Number), col = EXP_COL[ch];
    const n = 0.97 + 0.06 * hash3(x, y, z, 501);                 // a faint pixel grain
    // red rim light from the sculpture's glow on the faces looking left (-X) and the edges
    if (!has(x, y, z + 1)) quad(col, 1.0 * n, [[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]]);
    if (!has(x, y + 1, z)) quad(col, (ch === 'W' || ch === 'w') && !has(x - 1, y, z) ? 0.84 * n : 0.88 * n, [[x, y + 1, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]]);
    if (!has(x + 1, y, z)) quad(col, 0.72 * n, [[x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x + 1, y, z + 1]]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(ps, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3));
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
}
{
  // frames: 0-7 idle (scarf in 4 phases, breathing), 8-11 wave, 12-13 glance
  const FR = [];
  for (let n = 0; n < 8; n++) FR.push({ tail: n % 4, bob: n >= 4 ? 1 : 0, wave: 0, look: 0 });
  for (let n = 0; n < 4; n++) FR.push({ tail: n % 4, bob: 0, wave: 1 + (n % 2), look: 0 });
  for (let n = 0; n < 2; n++) FR.push({ tail: n * 2, bob: 0, wave: 0, look: 1 });
  // crop box around him (in output pixels)
  let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
  for (const dx of [-17, 9]) for (const dy of [-8, 8]) for (const dz of [-1, 26]) {
    const p = window.__project(EXPLORER_AT[0] + dx, EXPLORER_AT[1] + dy, EXPLORER_AT[2] + dz);
    bx0 = Math.min(bx0, p[0]); by0 = Math.min(by0, p[1]); bx1 = Math.max(bx1, p[0]); by1 = Math.max(by1, p[1]);
  }
  bx0 = Math.floor(bx0); by0 = Math.floor(by0); const fw = Math.ceil(bx1) - bx0, fh = Math.ceil(by1) - by0;
  const r2 = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
  r2.setPixelRatio(1); r2.setSize(W, H, false); r2.setClearColor(0x000000, 0);
  const sheet = document.createElement('canvas'); sheet.width = fw * FR.length; sheet.height = fh;
  const sctx = sheet.getContext('2d');
  FR.forEach((fr, n) => {
    const sc = new THREE.Scene(); sc.add(explorerMesh(fr));
    r2.render(sc, camera);
    sctx.drawImage(r2.domElement, bx0, by0, fw, fh, n * fw, 0, fw, fh);
  });
  window.__explorerSheet = sheet;
  window.__explorerFrames = { count: FR.length, x: bx0 / W, y: by0 / H, w: fw / W, h: fh / H };
}

window.__sculptureSize = [W, H];
window.__sculptureCanvas = out;
window.__sculptureStats = { faces, blocks: blocks.length };
{ const p = window.__project(EXPLORER_AT[0], EXPLORER_AT[1], EXPLORER_AT[2]), q = window.__project(EXPLORER_AT[0], EXPLORER_AT[1], EXPLORER_AT[2] + 15);
  window.__anchor = { x: p[0] / W, y: p[1] / H, block: (p[1] - q[1]) / H }; }   // feet position and one big block's height, as fractions of the image
{
  // the live island: one 12-byte record per face (i, j, k, face | flag << 2, r, g, b, pad, block u16, path u16), plus the camera
  let maxPath = 0;
  REC.forEach((r) => { const d = PATH[idx(r[0], r[1], r[2])]; if (r[4] && isFinite(d)) maxPath = Math.max(maxPath, d); });
  const buf = new ArrayBuffer(REC.length * 12), dv = new DataView(buf);
  REC.forEach((r, n) => {
    const o = n * 12, d = PATH[idx(r[0], r[1], r[2])];
    dv.setUint8(o, r[0]); dv.setUint8(o + 1, r[1]); dv.setUint8(o + 2, r[2]); dv.setUint8(o + 3, r[3] | (r[4] << 2));
    dv.setUint8(o + 4, r[5]); dv.setUint8(o + 5, r[6]); dv.setUint8(o + 6, r[7]);
    dv.setUint16(o + 8, r[8], true);
    dv.setUint16(o + 10, isFinite(d) && d <= maxPath ? Math.round(d / maxPath * 65534) : 65535, true);
  });
  let bin = ''; const u8 = new Uint8Array(buf);
  for (let n = 0; n < u8.length; n += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(n, n + 0x8000));
  window.__islandBin = btoa(bin);
  const gq = [[DOOR.x0, 45, 0], [DOOR.x1, 45, 0], [DOOR.x0, 45, DOOR.zRect + DOOR.r], [DOOR.x1, 45, DOOR.zRect + DOOR.r]].map((p) => window.__project(...p));
  window.__island = {
    grid: [GX0, GY0, GZ0, V], count: REC.length, maxPath,
    view: camera.matrixWorldInverse.elements.map((v) => +v.toFixed(6)),
    bounds: [camera.left, camera.right, camera.top, camera.bottom, camera.near, camera.far].map((v) => +v.toFixed(4)),
    explorerBlock: bid[idx(vi(EXPLORER_AT[0]), vj(EXPLORER_AT[1]), vk(EXPLORER_AT[2] - V))],
    gate: { x: Math.min(...gq.map((p) => p[0])) / W, y: Math.min(...gq.map((p) => p[1])) / H, w: (Math.max(...gq.map((p) => p[0])) - Math.min(...gq.map((p) => p[0]))) / W, h: (Math.max(...gq.map((p) => p[1])) - Math.min(...gq.map((p) => p[1]))) / H },
    door: [DOOR.x0, DOOR.x1, DOOR.recessY, 45, DOOR.zRect + DOOR.r]
  };
}
window.__sculptureReady = true;
