/*
 * Blitzedo contact scene (build-time, three.js): a crimson voxel mailbox on a stone post, a letter in its mouth, standing in a
 * field of broken stone pillars. Same pixel-art voxel method, palette and camera as the home sculpture (tools/sculpture-vox.js):
 * one flat colour per visible voxel face, stone grain with block seams, red as crafted pixel tiles, a red rim on the silhouette.
 *
 * Scene axes (units): X runs left-right, Y is depth (front = +Y), Z is up. three.js gets x = X, y = Z, z = Y.
 * ?frame=<name> renders an animation state (see FRAMES below) instead of the rest pose.
 */
import * as THREE from 'three';

const UNIT_PX = 10.6;
const V = 2.5;                                     // one voxel; a ground cube is 3 voxels, a pillar block 6

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

/* ---------- grid ---------- */
const GX0 = -110, GY0 = -95, GZ0 = -10;
const NX = 92, NY = 82, NZ = 56;
const kind = new Uint8Array(NX * NY * NZ);
const bid = new Int32Array(NX * NY * NZ);
const idx = (i, j, k) => (i * NY + j) * NZ + k;
const inb = (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < NX && j < NY && k < NZ;
const K = (i, j, k) => (inb(i, j, k) ? kind[idx(i, j, k)] : 0);
const solid = (i, j, k) => { const v = K(i, j, k); return v !== 0 && v < 254; };
const vi = (X) => Math.round((X - GX0) / V), vj = (Y) => Math.round((Y - GY0) / V), vk = (Z) => Math.round((Z - GZ0) / V);
const cx = (i) => GX0 + (i + 0.5) * V, cy = (j) => GY0 + (j + 0.5) * V, cz = (k) => GZ0 + (k + 0.5) * V;

const M = { STONE: 1, POST: 2, RED: 3, IVORY: 4, INK: 5, SEAL: 6, REDCUBE: 7, INSIDE: 254 };   // INSIDE: the box's hollow (air)
const blocks = [null];
function newBlock(o) { blocks.push(Object.assign({ tone: (hash3(blocks.length, 7, 1, 3) - 0.5) * 0.03 }, o)); return blocks.length - 1; }
function fillBox(x0, x1, y0, y1, z0, z1, m, b, test) {
  for (let i = vi(x0); i < vi(x1); i++) for (let j = vj(y0); j < vj(y1); j++) for (let k = vk(z0); k < vk(z1); k++) {
    if (!inb(i, j, k) || (test && !test(cx(i), cy(j), cz(k)))) continue;
    kind[idx(i, j, k)] = m; bid[idx(i, j, k)] = b;
  }
}

const FRAME = new URLSearchParams(location.search).get('frame') || 'rest';

/* ---------- ground: a field of small dark cubes, thinning out toward the edges ---------- */
const POST = { x: 0, y: 0, h: 75 };
function buildGround() {
  for (let ci = -13; ci <= 13; ci++) for (let cj = -11; cj <= 11; cj++) {
    const x = ci * 7.5, y = cj * 7.5;
    const r = Math.hypot(x / 95, y / 80);
    const keep = 1 - smooth(Math.min(1, Math.max(0, (r - 0.55) / 0.45)));
    if (hash3(ci, cj, 1, 3) > keep) continue;
    const top = [0, 0, 2.5, 2.5, 5, 7.5][Math.floor(hash3(ci, cj, 2, 3) * 6)] * (r < 0.25 ? 0.5 : 1);
    const red = Math.hypot(x, y) < 32 && hash3(ci, cj, 3, 3) < 0.22;          // light from the box falls on the cubes round the post
    fillBox(x - 3.75, x + 3.75, y - 3.75, y + 3.75, -7.5, top, M.STONE, newBlock({ redTop: red, ground: true }));
  }
}

/* ---------- broken pillars of stacked blocks ---------- */
const PILLARS = [
  // x, y, footprint (units), height (units), red cube on top
  [-62, -6, 15, 52.5, true], [-47, -26, 15, 37.5, false], [-74, 16, 7.5, 22.5, false],
  [58, -36, 15, 45, false], [70, -8, 15, 30, false], [44, -54, 7.5, 22.5, false],
  [-28, 44, 15, 22.5, false], [22, 48, 15, 15, false], [52, 30, 7.5, 15, false], [-56, 38, 7.5, 15, false],
  [-18, -40, 7.5, 15, false]
];
function buildPillars() {
  PILLARS.forEach(([x, y, s, h, cap], n) => {
    const step = 7.5;                                                      // each pillar is stacked from 7.5-unit cubes
    for (let a = 0; a < s / step; a++) for (let b = 0; b < s / step; b++) {
      const bx = x - s / 2 + a * step, by = y - s / 2 + b * step;
      const hh = h - (hash3(n, a, b, 9) < 0.5 ? step : 0) * (s > step ? 1 : 0);   // a ragged top
      for (let z = 0; z < hh; z += step) fillBox(bx, bx + step, by, by + step, z, z + step, M.STONE, newBlock({ rim: true }));
    }
    if (cap) fillBox(x - 3.75, x + 3.75, y - 3.75, y + 3.75, h, h + 7.5, M.REDCUBE, newBlock({}));
  });
  // a few loose red cubes on the ground
  [[14, 18], [-16, 24], [26, -12], [38, 26], [-44, 30], [6, 62], [-8, 14]].forEach(([x, y], n) => {
    const s = n % 3 === 0 ? 7.5 : 5;
    fillBox(x - s / 2, x + s / 2, y - s / 2, y + s / 2, 0, s, M.REDCUBE, newBlock({}));
  });
}

/* ---------- the post and the mailbox ---------- */
const BOX = { x0: -25, x1: 22.5, y0: -15, y1: 15, z0: 75, zr: 97.5, r: 15 };   // rectangular to zr, then an arched top (r about Y = 0)
const inBoxShape = (X, Y, Z, inset) => X >= BOX.x0 + inset && X < BOX.x1 && Y >= BOX.y0 + inset && Y < BOX.y1 - inset && Z >= BOX.z0 + inset &&
  (Z < BOX.zr || Y * Y + (Z - BOX.zr) ** 2 <= (BOX.r - inset) ** 2);
function buildMailbox() {
  // the post: one 15 x 15 column of 7.5 cubes, with red light caught on its front
  for (let z = 0; z < POST.h; z += 7.5) for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]])
    fillBox(POST.x - 7.5 + a * 7.5, POST.x + a * 7.5, POST.y - 7.5 + b * 7.5, POST.y + b * 7.5, z, z + 7.5, M.POST, newBlock({ rim: true }));
  // the box: a crimson shell, open at the +X end (its mouth), hollow inside
  const shell = newBlock({});
  for (let i = vi(BOX.x0); i < vi(BOX.x1); i++) for (let j = vj(BOX.y0); j < vj(BOX.y1); j++) for (let k = vk(BOX.z0); k < vk(BOX.zr + BOX.r); k++) {
    const X = cx(i), Y = cy(j), Z = cz(k);
    if (!inBoxShape(X, Y, Z, 0)) continue;
    const inner = inBoxShape(X, Y, Z, V) && X >= BOX.x0 + V;
    kind[idx(i, j, k)] = inner ? M.INSIDE : M.RED; bid[idx(i, j, k)] = shell;
  }
  // the flag on the front side: down at rest, up once a letter is in
  const up = FRAME === 'flag-up' || FRAME.startsWith('sent');
  const flag = newBlock({});
  if (!up) { fillBox(-20, -2.5, 15, 17.5, 90, 92.5, M.IVORY, flag); fillBox(-7.5, -2.5, 15, 17.5, 85, 95, M.IVORY, flag); }
  else { fillBox(-20, -17.5, 15, 17.5, 90, 112.5, M.IVORY, flag); fillBox(-20, -12.5, 15, 17.5, 105, 112.5, M.IVORY, flag); }
  fillBox(-22.5, -17.5, 15, 17.5, 87.5, 95, M.IVORY, flag);                 // the pivot
  // the letter: a thin ivory slab sticking out of the mouth, tilted up, a red seal on it
  const out = { rest: 12.5, 'in-1': 7.5, 'in-2': 2.5, 'in-3': -10, 'flag-up': -10, 'sent-1': -10 }[FRAME] ?? 12.5;
  if (out > -10) {
    const env = newBlock({});
    for (let i = vi(-2.5); i < vi(BOX.x1 + out); i++) for (let j = vj(-10); j < vj(10); j++) {
      const X = cx(i), Y = cy(j);
      const z = 82.5 + Math.floor((X + 2.5) / 7.5) * V;                   // tilted up in voxel steps
      const k = vk(z);
      if (!inb(i, j, k)) continue;
      const tip = BOX.x1 + out - X, u = Math.abs(Y);                      // the flap's V: ink lines from the corners to the middle
      const ink = Math.abs(tip - (10 - u) * 0.8) < 1.3 && tip < 9;
      const seal = tip > 3 && tip < 8.5 && u < 2.6;
      kind[idx(i, j, k)] = seal ? M.SEAL : ink ? M.INK : M.IVORY; bid[idx(i, j, k)] = env;
    }
  }
}

buildGround();
buildPillars();
buildMailbox();

/* ---------- colour ---------- */
const AZ = 40 * Math.PI / 180, EL = 24 * Math.PI / 180;
const VIEW = [Math.sin(AZ) * Math.cos(EL), Math.cos(AZ) * Math.cos(EL), Math.sin(EL)];
function silhouette(i, j, k, a, b, c) {
  if (solid(i + a, j + b, k + c)) return false;
  let x = i + a + 0.5, y = j + b + 0.5, z = k + c + 0.5;
  for (let t = 0; t < 300; t++) {
    x -= VIEW[0] * 0.5; y -= VIEW[1] * 0.5; z -= VIEW[2] * 0.5;
    const ci = Math.floor(x), cj = Math.floor(y), ck = Math.floor(z);
    if (!inb(ci, cj, ck)) return true;
    if (solid(ci, cj, ck)) return false;
  }
  return true;
}
const FACE_DIRS = [[0, 0, 1], [0, 1, 0], [1, 0, 0]];
const IN_PLANE = [[[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]], [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]], [[0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]];
const SHADE = [1.5, 1.0, 0.74];

// red as a crafted pixel tile per cell of `size` units (the live red of the home page): lit top-left edge, shaded bottom-right
function redTile(i, j, k, f, size) {
  const n = Math.round(size / V), loc = (v) => Math.floor((((v % size) + size) % size) / V);
  const X = cx(i), Y = cy(j), Z = cz(k);
  const u = f === 2 ? loc(Y) : loc(X), w = f === 0 ? loc(Y) : n - 1 - loc(Z);
  const hb = Math.floor(X / size) * 31 + Math.floor(Y / size) * 17 + Math.floor(Z / size) * 7;
  const C = { H: [1.0, 0.42, 0.33], h: [1.0, 0.31, 0.24], R: [0.9, 0.15, 0.13], r: [0.66, 0.08, 0.07], d: [0.42, 0.04, 0.04] };
  let c;
  if (u === n - 1 && w === n - 1) c = C.d;
  else if (u === 0 || w === 0) c = (u + w) % 3 === 0 ? C.h : C.H;
  else if (u === n - 1 || w === n - 1) c = C.r;
  else { const q = hash3(hb, u * 7 + w, f, 77); c = q < 0.12 ? C.h : q > 0.9 ? C.r : C.R; }
  const m = f === 0 ? 1.0 : f === 1 ? 0.86 : 0.68;
  return [c[0] * m, c[1] * m, c[2] * m];
}
function stoneValue(i, j, k, f, b) {
  let v = 0.12 + (blocks[b] ? blocks[b].tone : 0);
  const n = hash3(i, j, k, 20 + f), c2 = hash3(i >> 1, j >> 1, k >> 1, 23 + f), c3 = hash3(Math.floor(i / 3), Math.floor(j / 3), Math.floor(k / 3), 24 + f);
  if (c2 > 0.76) v += 0.085;
  if (n > 0.86) v += 0.06;
  if (n < 0.12) v -= 0.05;
  if (c3 < 0.18) v -= 0.035;
  v += (vnoise(i, j, k, 5, 25 + f) - 0.5) * 0.05;
  return Math.max(0.025, v);
}

function faceColour(i, j, k, f) {
  const m = kind[idx(i, j, k)], b = bid[idx(i, j, k)], blk = blocks[b] || {};
  const [di, dj, dk] = FACE_DIRS[f];
  const into = K(i + di, j + dj, k + dk);
  if (into === M.INSIDE) {                                       // the box's insides, seen through its mouth: deep shadow, warm
    const d = 0.1 + 0.05 * hash3(i, j, k, 61);
    return [d * 1.25, d * 0.42, d * 0.38];
  }
  if (m === M.RED) {
    // the mouth's rim catches more light
    if (f === 2 && cx(i) > BOX.x1 - V) return redTile(i, j, k, 0, 7.5).map((v) => Math.min(1, v * 1.12));
    return redTile(i, j, k, f, 7.5);
  }
  if (m === M.REDCUBE) return redTile(i, j, k, f, 7.5);
  if (m === M.IVORY || m === M.INK || m === M.SEAL) {
    const base = m === M.SEAL ? [0.86, 0.14, 0.12] : m === M.INK ? [0.62, 0.58, 0.52] : [0.97, 0.94, 0.88];
    const s = [1.0, 0.86, 0.72][f] * (0.97 + 0.05 * hash3(i, j, k, 70));
    return base.map((v) => v * s);
  }
  // stone: pixel grain, block seams and lit bevels, face shading, contact shadow
  if (f === 0 && blk.redTop) return redTile(i, j, k, 0, 7.5);
  let v = stoneValue(i, j, k, f, b) * SHADE[f];
  for (const [a, bb, c] of IN_PLANE[f]) {
    const ni = i + a, nj = j + bb, nk = k + c;
    if (solid(ni, nj, nk) && bid[idx(ni, nj, nk)] !== b && kind[idx(ni, nj, nk)] === m) {
      const low = (f === 0 && (a > 0 || bb > 0)) || (f !== 0 && (c < 0 || a > 0 || bb < 0));
      v *= low ? 0.72 : 1.16;
    }
  }
  if (f === 0 && (solid(i, j - 1, k + 1) || solid(i - 1, j, k + 1))) v *= 0.7;
  // red rim: on pillars and the post, pixels whose edge meets the background are lit red (one voxel, broken now and then)
  if (blk.rim && f > 0) {
    for (const [a, bb, c] of IN_PLANE[f]) {
      if (c > 0) continue;
      if (silhouette(i, j, k, a, bb, c) && vnoise(c === 0 ? k : (a !== 0 ? i : j), a + 2 * bb + 4 * c, f, 4, 35) > 0.3) return redTile(i, j, k, f, 7.5);
    }
  }
  // the post's front catches the box's red glow in a few pixels near its top
  if (m === M.POST && f === 1 && cz(k) > 45 && hash3(Math.floor(cx(i) / 2.5), 0, Math.floor(cz(k) / 5), 64) < (cz(k) - 45) / 70) return redTile(i, j, k, f, 7.5);
  return [v, v * 0.98, v * 0.96];
}

/* ---------- mesh ---------- */
const pos = [], cols = [], tmp = new THREE.Color();
function quad(c, q) {
  tmp.setRGB(Math.min(1, c[0]), Math.min(1, c[1]), Math.min(1, c[2]), THREE.SRGBColorSpace);
  for (const n of [0, 1, 2, 0, 2, 3]) { const [X, Y, Z] = q[n]; pos.push(X, Z, Y); cols.push(tmp.r, tmp.g, tmp.b); }
}
for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) for (let k = 0; k < NZ; k++) {
  if (!solid(i, j, k)) continue;
  const x = GX0 + i * V, y = GY0 + j * V, z = GZ0 + k * V;
  if (!solid(i, j, k + 1)) quad(faceColour(i, j, k, 0), [[x, y, z + V], [x + V, y, z + V], [x + V, y + V, z + V], [x, y + V, z + V]]);
  if (!solid(i, j + 1, k)) quad(faceColour(i, j, k, 1), [[x, y + V, z], [x + V, y + V, z], [x + V, y + V, z + V], [x, y + V, z + V]]);
  if (!solid(i + 1, j, k)) quad(faceColour(i, j, k, 2), [[x + V, y, z], [x + V, y + V, z], [x + V, y + V, z + V], [x + V, y, z + V]]);
}
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));

/* ---------- camera: the home sculpture's angle; framed on a fixed box so every frame lines up ---------- */
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000);
const centre = new THREE.Vector3(0, 40, 0);
camera.position.copy(centre).add(new THREE.Vector3(Math.sin(AZ) * Math.cos(EL), Math.sin(EL), Math.cos(AZ) * Math.cos(EL)).multiplyScalar(1500));
camera.lookAt(centre);
camera.updateMatrixWorld(true);
let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
const pv = new THREE.Vector3();
for (const X of [-110, 120]) for (const Y of [-95, 110]) for (const Z of [-10, 125]) {
  pv.set(X, Z, Y).applyMatrix4(camera.matrixWorldInverse);
  minX = Math.min(minX, pv.x); maxX = Math.max(maxX, pv.x); minY = Math.min(minY, pv.y); maxY = Math.max(maxY, pv.y);
}
Object.assign(camera, { left: minX, right: maxX, top: maxY, bottom: minY });
camera.updateProjectionMatrix();
const W = Math.ceil((maxX - minX) * UNIT_PX), H = Math.ceil((maxY - minY) * UNIT_PX);
window.__project = (X, Y, Z) => { const v = new THREE.Vector3(X, Z, Y).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
document.body.appendChild(renderer.domElement);
renderer.render(scene, camera);

window.__sceneCanvas = renderer.domElement;
window.__sceneSize = [W, H];
window.__sceneStats = { faces: pos.length / 18 };
window.__sceneReady = true;
