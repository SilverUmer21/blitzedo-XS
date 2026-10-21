// "Light the gate": a 9:16 motion piece for socials, built from the site's own island, Chip and wordmark.
//
// The idea: Blitzedo is "blit" (a pixel copy) plus "blitz" (a strike), so every cut here is a blit: a stepped, tile-by-tile
// copy of one picture over another. One red pixel is the through-line. It draws the pixel b (the favicon), hops into the
// real 3D island as the ember in the niche, rides Chip's cap down the stairs, is tossed into the gate, and lights it.
// The camera then dives through the gate and the last blit lands on "Play beyond".
//
// 2D and 3D are mixed on purpose: the 3D island (three.js, the site's modules, untouched) lives in a viewport; everything
// around it (grid, sparks, captions, fuse bar, wipes) is a 2D canvas on a 30 px grid, and the gate's strike travels out
// of the 3D scene into that grid as a ripple of cells.
//
// Everything is a pure function of the frame number (the keeper runs on a seeded RNG), so frames can be rendered one by
// one and a seek just replays the simulation. Driven by render.mjs for video, or live in reel.html.
import * as THREE from '../island/assets/vendor/three.module.js';
import {createWorld} from '../island/world.js?v=embers-13';
import {loadStoneTexture} from '../island/stone.js?v=embers-13';
import {sculptureCamera} from '../island/composition.js?v=embers-13';
import {createKeeper} from '../island/keeper.js?v=embers-13';

export const W = 1080, H = 1920, FPS = 30, DT = 1 / FPS;
const G = 30;                                              // the grid unit every 2D element snaps to
const C = {bg: '#090A08', ivory: '#FBF5EB', muted: 'rgba(244,240,230,.72)', faint: 'rgba(244,240,230,.14)',
  red: '#E8332A', hot: '#FF8A66', crim: '#AE1212', crimHover: '#C4161B', char: '#20211F'};
const SPARKS = ['#FF5A3C', '#FF7A52', '#FFB283', '#FBF5EB'];

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeOut = x => 1 - (1 - clamp(x)) ** 3;
const easeIn = x => clamp(x) ** 3;
const stepsEnd = (p, n) => p >= 1 ? 1 : Math.max(0, Math.floor(p * n) / n);
const snap = (v, s) => Math.round(v / s) * s;
const hash = (x, y, s = 0) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---- the keeper's clock ---------------------------------------------------------------------------------------------
// Chip's own routine is ~14 s before the gate lights. Here its clock (kappa) runs faster through the glances and the
// long staircase and at its own pace for the moments that matter.
const SPEED = [[0, 1], [.75, 1], [1, 2.1], [2.1, 2.1], [2.45, 1.1], [3.5, 1.1], [3.8, 2.5], [12.8, 2.5], [13.1, 1], [99, 1]];
function speedAt(k) {
  for (let i = 1; i < SPEED.length; i++) if (k < SPEED[i][0]) return lerp(SPEED[i - 1][1], SPEED[i][1], smooth((k - SPEED[i - 1][0]) / (SPEED[i][0] - SPEED[i - 1][0])));
  return 1;
}
const K = {grab: 2.3, carry: 3.0, toss: 13.0, lit: 13.83, zoom: 16.05};
// Reel time (seconds) of the first keeper frame; everything after it is derived by integrating the keeper's speed.
const T = {snake0: .5, k0: 4.5};   // k0 is replaced below, once the snake's length is known
function tOfK(k) { let t = T.k0, kk = 0; const h = .004; while (kk < k) { kk += speedAt(kk) * h; t += h; } return t; }

// ---- camera shots (keyed on the keeper's clock) --------------------------------------------------------------------
// z is pixels per world unit; (sx, sy) is where the focus sits relative to the viewport's centre, in pixels.
const SHOTS = [
  {k: -99, f: 'isl', z: 86, sx: 0, sy: 0},
  {k: .2, f: 'isl', z: 88, sx: 0, sy: 0},
  {k: 1.5, f: 'chip', z: 210, sx: 0, sy: -40},
  {k: 2.5, f: 'chip', z: 255, sx: 0, sy: -70},
  {k: 3.6, f: 'chip', z: 215, sx: -90, sy: -170},
  {k: 12.6, f: 'chip', z: 215, sx: -50, sy: -120},
  {k: 13.5, f: 'chip', z: 255, sx: 0, sy: -40},
  {k: K.lit + .25, f: 'chip', z: 250, sx: 0, sy: -30},
  {k: K.lit + 1.35, f: 'isl', z: 86, sx: 0, sy: 0},
  {k: K.zoom - .15, f: 'isl', z: 88, sx: 0, sy: 0},
  {k: K.zoom + 1.0, f: 'gate', z: 1100, sx: 0, sy: 0}
];

// ---- the pixel b (the favicon's 7 x 9 cells) and the snake that draws it -------------------------------------------
const B_CELLS = new Set();
for (let y = 0; y < 9; y++) for (const x of [0, 1]) B_CELLS.add(x + ',' + y);
for (const [y, xs] of [[2, [3, 4, 5]], [3, [2, 3, 4, 5, 6]], [4, [5, 6]], [5, [5, 6]], [6, [5, 6]], [7, [2, 3, 4, 5, 6]], [8, [3, 4, 5]]]) for (const x of xs) B_CELLS.add(x + ',' + y);
const BC = 90, BX = 225, BY = 555;                          // cell size and origin of the pixel b on the canvas
function snakePath() {
  const has = (x, y) => B_CELLS.has(x + ',' + y);
  const path = [[4, 0], [4, 1], [4, 2]];
  const seen = new Set(['4,2']);
  const bfs = (from, goal) => {
    const prev = new Map([[from.join(), null]]), queue = [from];
    while (queue.length) {
      const [x, y] = queue.shift();
      if (goal(x, y)) { const out = []; for (let c = [x, y]; c; c = prev.get(c.join())) out.unshift(c); return out.slice(1); }
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) { const n = [x + dx, y + dy]; if (has(...n) && !prev.has(n.join())) { prev.set(n.join(), [x, y]); queue.push(n); } }
    }
    return [];
  };
  const bowl = [...B_CELLS].map(s => s.split(',').map(Number)).filter(([x]) => x >= 2);
  let cur = [4, 2];
  while (bowl.some(([x, y]) => !seen.has(x + ',' + y))) {
    const step = bfs(cur, (x, y) => x >= 2 && !seen.has(x + ',' + y));
    for (const c of step) { path.push(c); seen.add(c.join()); }
    cur = path[path.length - 1];
  }
  const stem = [...B_CELLS].map(s => s.split(',').map(Number)).filter(([x]) => x < 2).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  for (const [tx, ty] of stem) {
    if (seen.has(tx + ',' + ty)) continue;
    for (const c of bfs(cur, (x, y) => x === tx && y === ty)) { path.push(c); seen.add(c.join()); }
    cur = path[path.length - 1];
  }
  return path;
}
const PATH = snakePath();
const STEP_T = [];                                          // when the head arrives at each path step (reel seconds)
{ let t = T.snake0 + .15; for (let i = 0; i < PATH.length; i++) { STEP_T.push(t); t += Math.max(.022, .22 * .84 ** i); } }
T.snake1 = STEP_T[STEP_T.length - 1];
T.dash = [T.snake1 + .07, T.snake1 + .13, T.snake1 + .19];  // the ember runs back along the top row to its home
T.park = T.snake1 + .26;
T.open0 = T.park + .55;
T.k0 = T.open0 + 1.0;
T.open1 = T.k0 - .2;
T.emberLeave = T.open0 + .1;
T.lit = tOfK(K.lit); T.toss = tOfK(K.toss); T.zoom = tOfK(K.zoom);
T.expand0 = T.zoom + .9; T.expand1 = T.zoom + 1.55; T.end0 = T.zoom + 1.75;
export const DURATION = Math.round((T.end0 + 5.8) * FPS) / FPS;
export const TIMELINE = T;

// ---- wordmark data (assets/wordmark.svg: pixel "blit" + smooth "zedo") ---------------------------------------------
async function loadWordmark() {
  const text = await (await fetch(new URL('../assets/wordmark.svg', import.meta.url))).text();
  const svg = new DOMParser().parseFromString(text, 'image/svg+xml');
  const num = (el, name) => parseFloat(el.style.getPropertyValue(name));
  const px = [...svg.querySelectorAll('.wm-px')].map(r => ({x: +r.getAttribute('x'), y: +r.getAttribute('y'), w: +r.getAttribute('width'), h: +r.getAttribute('height'), d: num(r, '--d'), ox: num(r, '--x'), oy: num(r, '--y'), p: num(r, '--p')}));
  const sparks = [...svg.querySelectorAll('.wm-spark')].map(r => ({x: +r.getAttribute('x'), y: +r.getAttribute('y'), w: +r.getAttribute('width'), fill: r.getAttribute('fill'), sd: num(r, '--sd'), st: num(r, '--st'), sx: num(r, '--sx'), sy: num(r, '--sy')}));
  const solid = new Path2D(svg.querySelector('.wm-solid').getAttribute('d'));
  const glyphs = [...svg.querySelectorAll('g[transform] > path')].map(p => ({d: new Path2D(p.getAttribute('d')), tx: +/translate\(([-\d.]+)/.exec(p.getAttribute('transform'))[1]}));
  return {px, sparks, solid, glyphs, vb: [87, -15, 7683, 1627]};
}

// ---- 2D helpers -----------------------------------------------------------------------------------------------------
const occupancy = new WeakMap();
function occupied(src, cell) {                                // which cells of a picture hold anything (for the red leading edge)
  let o = occupancy.get(src);
  if (o) return o;
  const cols = Math.ceil(src.width / cell), rows = Math.ceil(src.height / cell), data = src.getContext('2d').getImageData(0, 0, src.width, src.height).data;
  o = {cols, rows, cells: new Uint8Array(cols * rows)};
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) if (data[(y * src.width + x) * 4 + 3] > 40) o.cells[Math.floor(y / cell) * cols + Math.floor(x / cell)] = 1;
  occupancy.set(src, o);
  return o;
}
// The blit: copy a picture onto the canvas tile by tile, in an order that sweeps across it, with a red edge of fresh tiles.
function blitReveal(ctx, src, dx, dy, p, {cell = 15, seed = 1, edge = C.red, band = .09, sweep = .75} = {}) {
  if (p <= 0) return;
  if (p >= 1) { ctx.drawImage(src, dx, dy); return; }
  const {cols, rows, cells} = occupied(src, cell);
  const q = p * (1 + band);
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    if (!cells[cy * cols + cx]) continue;
    const th = (cx / cols) * sweep + hash(cx, cy, seed) * (1 - sweep);
    if (th < q - band) ctx.drawImage(src, cx * cell, cy * cell, cell, cell, dx + cx * cell, dy + cy * cell, cell, cell);
    else if (th < q && hash(cx, cy, seed + 7) > .35) { ctx.fillStyle = edge; ctx.fillRect(dx + cx * cell, dy + cy * cell, cell, cell); }
  }
}
function textCanvas(w, h, draw) {
  const c = Object.assign(document.createElement('canvas'), {width: w, height: h});
  const x = c.getContext('2d', {willReadFrequently: true});
  x.textBaseline = 'alphabetic';
  draw(x);
  return c;
}
function setFont(x, size, weight = 700, ls = -.035) { x.font = `${weight} ${size}px "Inter Tight"`; x.letterSpacing = (ls * size).toFixed(2) + 'px'; }
function fitSize(x, text, size, weight, ls, maxW) { setFont(x, size, weight, ls); const w = x.measureText(text).width; return w > maxW ? size * maxW / w : size; }

// ---- the reel ---------------------------------------------------------------------------------------------------------
export async function createReel({canvas, onProgress = () => {}} = {}) {
  await document.fonts.load('700 100px "Inter Tight"');
  await document.fonts.load('500 100px "Inter Tight"');
  await document.fonts.load('400 100px "Inter Tight"');
  Object.defineProperty(window, 'localStorage', {value: {getItem: () => null, setItem() {}}, configurable: true});
  const wm = await loadWordmark();
  const chipSheet = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = new URL('../assets/chip-sprites.png', import.meta.url).href; });

  const out = canvas || Object.assign(document.createElement('canvas'), {width: W, height: H});
  out.width = W; out.height = H;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // 3D
  const gl = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({canvas: gl, alpha: true, antialias: true, preserveDrawingBuffer: true});
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setPixelRatio(1);
  const scene = new THREE.Scene();
  const camera = sculptureCamera(1);
  const model = createWorld();
  scene.add(model.world);
  const stone = await loadStoneTexture();
  model.applyStoneTexture(stone);
  const stage = document.createElement('div');
  onProgress('island ready');

  const V3 = THREE.Vector3;
  const world = model.world;
  const tmp = new V3();
  const toCam = v => { const c = v.clone().applyMatrix4(camera.matrixWorldInverse); return [c.x, c.y]; };
  const NICHE_L = new V3(-1.62, 4.27, .52);
  const ISL_W = new V3(.15, 1.9, .1);

  // captions (the top zone) -------------------------------------------------------------------------------------------
  const probe = document.createElement('canvas').getContext('2d');
  const caption = (kicker, head) => textCanvas(W, 420, x => {
    const size = fitSize(probe, head, 150, 700, -.035, W - 150);
    setFont(x, 50, 500, -.01); x.fillStyle = C.muted; x.fillText(kicker, 80, 236);
    setFont(x, size, 700, -.035); x.fillStyle = C.ivory; x.fillText(head, 74, 236 + 20 + size * .78);
  });
  const CAPS = [
    {t0: .45, t1: T.open0 + .35, img: caption('It starts with', 'one pixel.')},
    {t0: T.k0 + .35, t1: tOfK(3.1), img: caption('Then a small world', 'wakes up.')},
    {t0: tOfK(3.9), t1: T.toss - .1, img: caption('Someone has to', 'light the way.')}
  ];

  // end card -----------------------------------------------------------------------------------------------------------
  const headSize = fitSize(probe, 'beyond', 268, 700, -.035, W - 120);
  const END = {
    play: textCanvas(W, 300, x => { setFont(x, headSize, 700, -.035); x.fillStyle = C.ivory; x.fillText('Play', 68, headSize * .78); }),
    beyond: textCanvas(W, 300, x => { setFont(x, headSize, 700, -.035); x.fillStyle = C.ivory; x.fillText('beyond', 68, headSize * .78); }),
    line: textCanvas(W, 170, x => { setFont(x, 54, 400, -.005); x.fillStyle = C.muted; x.fillText('We build worlds we want', 84, 58); x.fillText('to get lost in.', 84, 126); }),
    url: textCanvas(W, 80, x => { setFont(x, 38, 500, 0); x.fillStyle = C.muted; x.fillText('blitzedo-xs.vercel.app', 84, 54); })
  };
  const wmH = 640 * 1627 / 7683, BW = 620, BH = 116, SHIFT = 80;
  const END_L = {wordmark: [84, 330 + SHIFT, 640], play: 330 + SHIFT + wmH + 70 + headSize * .73};
  END_L.beyond = END_L.play + headSize * .84;
  END_L.line = END_L.beyond + headSize * .2 + 30;
  END_L.btn = [84, END_L.line + 200, BW, BH];
  const btnImg = (hover) => textCanvas(BW, BH, x => {
    x.fillStyle = hover ? C.crimHover : C.crim; x.beginPath(); x.roundRect(0, 0, BW, BH, 6); x.fill();
    setFont(x, 46, 400, 0); x.fillStyle = C.ivory; x.fillText('Explore games', 42, 74);
    x.strokeStyle = C.ivory; x.lineWidth = 4; x.lineCap = 'butt';
    const ax = BW - 42 - 44 + (hover ? 9 : 0), ay = BH / 2; x.beginPath(); x.moveTo(ax, ay); x.lineTo(ax + 44, ay); x.moveTo(ax + 27, ay - 18); x.lineTo(ax + 44, ay); x.lineTo(ax + 27, ay + 18); x.stroke();
  });
  const BTN = [btnImg(false), btnImg(true)];
  const hudImg = {};
  const hud = label => hudImg[label] || (hudImg[label] = textCanvas(520, 60, x => { setFont(x, 25, 600, .2); x.fillStyle = C.muted; x.fillText(label.toUpperCase(), 36, 36); x.fillStyle = C.red; x.fillRect(0, 17, 18, 18); }));

  // simulation (stateful, deterministic: reset() and replay to seek) ---------------------------------------------------
  const sim = {};
  let keeper = null;
  function reset() {
    if (keeper) keeper.dispose();
    Math.random = mulberry32(20261021);
    keeper = createKeeper({world, stoneMap: stone, camera, stage});
    const space = keeper.chip.group.parent;
    sim.nicheEmber = space.children[1]; sim.flying = space.children[2];
    keeper.chip.group.visible = false;
    Object.assign(sim, {t: 0, frame: 0, kappa: 0, fuse: -100, cam: null, parts: [], events: [], prevLift: 0, prevFlying: false, emberHop: null, gateScreen: [W / 2, H / 2], litFrame: undefined, zoomLock: false, glH: 0});
    world.updateMatrixWorld(true);
  }
  const ev = (type, extra = {}) => sim.events.push({t: +sim.t.toFixed(3), type, ...extra});

  function setFrustum(cam, winH) {
    const hw = W / cam.z / 2, hh = winH / cam.z / 2;
    camera.left = cam.cx - hw; camera.right = cam.cx + hw; camera.top = cam.cy + hh; camera.bottom = cam.cy - hh;
    camera.updateProjectionMatrix();
  }
  const shotAt = k => {
    let i = 1; while (i < SHOTS.length - 1 && k > SHOTS[i].k) i++;
    const a = SHOTS[i - 1], b = SHOTS[i], u = smooth((k - a.k) / (b.k - a.k));
    return {a, b, u};
  };
  function focusOf(f) {
    if (f === 'chip') return toCam(keeper.chip.group.getWorldPosition(tmp));
    if (f === 'gate') return toCam(world.userData.door.localToWorld(new V3(-.3, 1.0, 0)));
    return toCam(ISL_W.clone().add(world.position));
  }
  const winRect = t => { const e = smooth((t - T.expand0) / (T.expand1 - T.expand0)); return {y0: Math.round(lerp(420, 0, e)), y1: Math.round(lerp(1500, H, e)), e}; };
  function toScreen(v, win) {                                   // world position -> canvas pixels (under the current frustum)
    const [x, y] = toCam(v);
    return [(x - camera.left) / (camera.right - camera.left) * W, win.y0 + (camera.top - y) / (camera.top - camera.bottom) * (win.y1 - win.y0)];
  }
  const emit = (x, y, o = {}) => sim.parts.push({x, y, vx: o.vx ?? (hash(sim.frame, sim.parts.length, 3) - .5) * 70, vy: o.vy ?? -(70 + hash(sim.frame, sim.parts.length, 4) * 110), born: sim.t,
    life: o.life ?? .45 + hash(sim.frame, sim.parts.length, 5) * .5, size: o.size ?? [6, 9, 12][Math.floor(hash(sim.frame, sim.parts.length, 6) * 3)], color: o.color ?? SPARKS[Math.floor(hash(sim.frame, sim.parts.length, 7) * 4)], g: o.g ?? 0});

  function step() {
    sim.frame++; sim.t = sim.frame * DT;
    const t = sim.t, win = winRect(t);
    // keeper
    if (t >= T.k0) {
      keeper.chip.group.visible = true;
      for (let i = 0; i < 2; i++) { const d = speedAt(sim.kappa) / 60; sim.kappa += d; sim.fuse = keeper.update(d); }
    }
    const k = t >= T.k0 ? sim.kappa : -99;
    // the world: the float eases in from the moment the viewport opens
    const ease = smooth((t - T.open0) / 2.2);
    model.animate(Math.max(0, t - T.open0) + 3, true, sim.fuse);
    world.position.multiplyScalar(ease); world.rotation.z *= ease;
    world.rotation.y = Math.sin(t * .55) * .03 * ease;
    world.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    // camera: interpolate shots, then settle toward them
    const {a, b, u} = shotAt(k);
    const fa = focusOf(a.f), fb = focusOf(b.f);
    const z = Math.exp(lerp(Math.log(a.z), Math.log(b.z), u)), sx = lerp(a.sx, b.sx, u), sy = lerp(a.sy, b.sy, u);
    const fx = lerp(fa[0], fb[0], u), fy = lerp(fa[1], fb[1], u);
    const target = {cx: fx - sx / z, cy: fy + sy / z, z};
    if (!sim.cam) sim.cam = {...target};
    else {
      const a1 = 1 - Math.exp(-DT / .1), a2 = 1 - Math.exp(-DT / .06);
      sim.cam.cx = lerp(sim.cam.cx, target.cx, a1); sim.cam.cy = lerp(sim.cam.cy, target.cy, a1);
      sim.cam.z = Math.exp(lerp(Math.log(sim.cam.z), Math.log(target.z), a2));
    }
    setFrustum(sim.cam, win.y1 - win.y0);
    camera.updateMatrixWorld(true);

    // events and emitters
    const emberWorld = tmp.clone();
    if (t >= T.k0) {
      const chip = keeper.chip, lift = chip.root.position.y;
      if (sim.prevLift > .012 && lift <= .012) ev('land', {big: sim.prevLift > .15});
      sim.prevLift = lift;
      if (chip.ember.visible && sim.frame % 2 === 0) { chip.ember.getWorldPosition(emberWorld); const [x, y] = toScreen(emberWorld, win); emit(x + (hash(sim.frame, 1) - .5) * 12, y - 10, {vy: -(110 + hash(sim.frame, 2) * 120)}); }
      if (sim.flying.visible) {
        sim.flying.getWorldPosition(emberWorld); const [x, y] = toScreen(emberWorld, win);
        emit(x, y, {vy: -40, vx: (hash(sim.frame, 8) - .5) * 100, life: .35, size: 9});
        if (!sim.prevFlying) ev('toss');
      }
      sim.prevFlying = sim.flying.visible;
      if (sim.fuse > -50 && sim.litFrame === undefined) {
        sim.litFrame = sim.frame; ev('lit');
        const gate = world.userData.door.localToWorld(new V3(0, 1.0, 0)); sim.gateScreen = toScreen(gate, win);
        for (let i = 0; i < 70; i++) { const ang = hash(i, 11) * Math.PI * 2, sp = 140 + hash(i, 12) * 520; emit(sim.gateScreen[0], sim.gateScreen[1], {vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 120, life: .5 + hash(i, 13) * .7, size: [9, 12, 15][i % 3]}); }
      }
      // the pulse climbing the stairs throws sparks off each tread as it passes
      if (sim.fuse > -50) for (const [ft, p] of PULSE_STEPS) if (sim.fuse - 1 / 60 * 2 < ft && sim.fuse >= ft) { const [x, y] = toScreen(p.clone().applyMatrix4(world.matrixWorld), win); for (let i = 0; i < 6; i++) emit(x + (hash(i, sim.frame) - .5) * 40, y, {vy: -(120 + hash(i, 9) * 200), life: .5 + hash(i, 10) * .4}); }
    }
    // the gate's centre, tracked so the ripple and glow stay attached to it while the camera moves
    if (sim.litFrame !== undefined && !sim.zoomLock) sim.gateScreen = toScreen(world.userData.door.localToWorld(new V3(0, 1.0, 0)), win);
    if (t >= T.zoom - .3) sim.zoomLock = true;
    // particles
    sim.parts = sim.parts.filter(p => t - p.born < p.life);
    for (const p of sim.parts) { p.x += p.vx * DT; p.y += p.vy * DT; p.vy += p.g * DT; p.vx *= .985; }
    // the niche ember's screen position at the moment the 2D ember needs it
    if (t >= T.open0 && !sim.emberHop) {
      const [nx, ny] = toScreen(NICHE_L.clone().applyMatrix4(world.matrixWorld), winRect(t));
      sim.emberHop = {from: [BX + 4.5 * BC, BY + .5 * BC], to: [nx, ny], t0: T.open0 + .1, t1: T.k0};
    }
  }
  // Where the pulse passes the stairs, in island-local space (island/fuse.js's route for the treads).
  const PULSE_STEPS = [];
  for (let i = 0; i <= 7; i++) PULSE_STEPS.push([2.65 + (7 - i) * .085, new V3(-1.93 + i * .32, 3.085 - i * .36, 1.46)]);
  for (let j = 0; j <= 3; j++) PULSE_STEPS.push([3.245 + (3 - j) * .09, new V3(-1.93, 4.165 - j * .36, .63 + j * .28)]);

  function advanceTo(frame) {
    if (frame < sim.frame || !keeper) reset();
    while (sim.frame < frame) step();
  }

  // drawing -------------------------------------------------------------------------------------------------------------
  function dotGrid(c, x0, y0, x1, y1, t) {
    c.fillStyle = 'rgba(244,240,230,.07)';
    for (let y = Math.ceil(y0 / G) * G; y < y1; y += G) for (let x = Math.ceil(x0 / G) * G; x < x1; x += G) c.fillRect(x - 1, y - 1, 3, 3);
  }
  // The strike travelling out of the gate into the grid: a ring of cells that light and cool.
  function ripple(c, x0, y0, x1, y1, t) {
    if (sim.litFrame === undefined && t < T.park) return;
    const origins = [];
    if (sim.litFrame !== undefined) origins.push({o: sim.gateScreen, t0: sim.litFrame * DT, speed: 760, a: .30, width: 140});
    if (t >= T.park && t < T.park + 1.2) origins.push({o: [BX + 4.5 * BC, BY + .5 * BC], t0: T.park, speed: 900, a: .2, width: 120});
    for (const {o, t0, speed, a, width} of origins) {
      const age = t - t0; if (age < 0) continue;
      const r = age * speed, fade = clamp(1 - age / 2.6);
      const cx0 = Math.floor((o[0] - r - width) / G), cx1 = Math.ceil((o[0] + r + width) / G), cy0 = Math.floor((o[1] - r - width) / G), cy1 = Math.ceil((o[1] + r + width) / G);
      for (let cy = Math.max(cy0, Math.floor(y0 / G)); cy <= Math.min(cy1, Math.floor(y1 / G)); cy++) for (let cx = Math.max(cx0, 0); cx <= Math.min(cx1, W / G - 1); cx++) {
        const d = Math.hypot(cx * G + G / 2 - o[0], cy * G + G / 2 - o[1]);
        const w = 1 - Math.abs(d - r) / width; if (w <= 0) continue;
        const level = Math.floor(w * w * 4 * (.6 + hash(cx, cy, 2) * .4)) / 4;     // stepped, never smooth
        if (level <= 0) continue;
        c.fillStyle = `rgba(232,51,42,${(level * a * fade).toFixed(3)})`;
        c.fillRect(cx * G + 2, cy * G + 2, G - 4, G - 4);
      }
    }
  }
  const cellCol = age => age < .07 ? C.hot : age < .14 ? C.red : C.ivory;
  function drawPixelB(c, t) {
    // the b's cells, as the snake reaches them
    const born = new Map();
    for (let i = 0; i < PATH.length; i++) if (STEP_T[i] <= t) { const key = PATH[i].join(); if (!born.has(key)) born.set(key, STEP_T[i]); }
    const pulseR = (t - T.park) * 14;                                // cells per second
    for (const [key, t0] of born) {
      const [x, y] = key.split(',').map(Number);
      if (!B_CELLS.has(key)) continue;
      let col = cellCol(t - t0);
      if (t > T.park && t < T.park + .6 && Math.abs(Math.hypot(x - 4, y) - pulseR) < 1.3) col = C.hot;
      c.fillStyle = col; c.fillRect(BX + x * BC, BY + y * BC, BC, BC);
      c.fillStyle = 'rgba(9,10,8,.16)'; c.fillRect(BX + x * BC, BY + y * BC + BC - 3, BC, 3); c.fillRect(BX + x * BC + BC - 3, BY + y * BC, 3, BC);
    }
    // the head
    let head = null;
    for (let i = PATH.length - 1; i >= 0; i--) if (STEP_T[i] <= t) { head = PATH[i]; break; }
    const dash = T.dash.filter(d => d <= t).length;
    if (dash) {
      for (let i = 0; i < dash; i++) { const age = t - T.dash[i], x = 2 + i; if (age < .4) { c.fillStyle = age < .1 ? C.hot : age < .2 ? C.red : 'rgba(232,51,42,.35)'; c.fillRect(BX + x * BC, BY, BC, BC); } }
      head = [2 + dash, 0];
    }
    if (!head && t >= .12) head = [4, 0];
    if (t >= T.park) head = [4, 0];
    if (head && t < T.emberLeave) {
      const x = BX + head[0] * BC, y = BY + head[1] * BC;
      const beat = t >= T.park ? (Math.floor((t - T.park) * 6) % 2) : 0;
      c.fillStyle = C.red; c.fillRect(x, y, BC, BC);
      c.fillStyle = beat ? C.ivory : C.hot; c.fillRect(x + BC * .3, y + BC * .3, BC * .4, BC * .4);
      if (t >= T.park) { c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(x + BC / 2, y + BC / 2, 0, x + BC / 2, y + BC / 2, 240); g.addColorStop(0, 'rgba(232,51,42,.28)'); g.addColorStop(1, 'rgba(232,51,42,0)'); c.fillStyle = g; c.fillRect(x - 240, y - 240, 480 + BC, 480 + BC); c.globalCompositeOperation = 'source-over'; }
    }
  }
  function drawEmberHop(c, t) {
    const h = sim.emberHop; if (!h || t < h.t0 || t > h.t1 + .02) return;
    const u = clamp((t - h.t0) / (h.t1 - h.t0)), hops = 4, i = Math.min(hops - 1, Math.floor(u * hops)), f = (u * hops) % 1;
    const p0 = i / hops, p1 = (i + 1) / hops;
    const pos = q => [lerp(h.from[0], h.to[0], q), lerp(h.from[1], h.to[1], q)];
    const a = pos(p0), b = pos(p1), x = lerp(a[0], b[0], f), y = lerp(a[1], b[1], f) - Math.sin(f * Math.PI) * 120 * (1 - u * .6);
    const size = Math.round(lerp(BC, 18, easeOut(u)) / 6) * 6;
    c.fillStyle = C.red; c.fillRect(snap(x - size / 2, 6), snap(y - size / 2, 6), size, size);
    c.fillStyle = C.hot; c.fillRect(snap(x - size / 6, 6), snap(y - size / 6, 6), Math.max(6, size / 3), Math.max(6, size / 3));
  }
  function drawOpening(c, t, win) {
    // the 3D viewport blits open outward from the ember's home cell, 60 px tiles, nine stepped sweeps
    const p = stepsEnd(clamp((t - T.open0) / (T.open1 - T.open0)), 9), cell = 2 * G;
    if (p <= 0) return false;
    const o = [BX + 4.5 * BC, BY + .5 * BC], maxD = Math.hypot(Math.max(o[0], W - o[0]), Math.max(o[1] - win.y0, win.y1 - o[1]));
    const q = p * 1.18;
    for (let cy = Math.floor(win.y0 / cell); cy < Math.ceil(win.y1 / cell); cy++) for (let cx = 0; cx < W / cell; cx++) {
      const x = cx * cell, y = cy * cell, d = Math.hypot(x + cell / 2 - o[0], y + cell / 2 - o[1]) / maxD, th = d * .85 + hash(cx, cy, 5) * .15;
      if (th < q - .12) { c.clearRect(x, y, cell, cell); c.fillStyle = C.bg; c.fillRect(x, y, cell, cell); dotGrid(c, x, y, x + cell, y + cell); ripple(c, x, y, x + cell, y + cell, t); c.drawImage(gl, x, y - win.y0, cell, cell, x, y, cell, cell); }
      else if (th < q) { c.fillStyle = hash(cx, cy, 6) > .5 ? C.red : C.hot; c.fillRect(x, y, cell, cell); }
    }
    return p >= 1;
  }
  function drawSparks(c, t) {
    for (const p of sim.parts) {
      const age = (t - p.born) / p.life, size = p.size, a = age > .75 ? (Math.floor((1 - age) / .25 * 3) / 3) : 1;
      if (a <= 0) continue;
      c.globalAlpha = a; c.fillStyle = p.color;
      c.fillRect(snap(p.x, 6) - size / 2, snap(p.y, 6) - size / 2, size, size);
    }
    c.globalAlpha = 1;
  }
  function drawFrameFurniture(c, t, win) {
    const e = win.e, a = (1 - e) * stepsEnd((t - T.open0 - .3) / .5, 4);
    if (a <= 0) return;
    c.globalAlpha = a;
    // viewfinder corners and hairlines
    c.fillStyle = 'rgba(244,240,230,.38)';
    for (const [x, y, dx, dy] of [[0, win.y0, 1, 1], [W, win.y0, -1, 1], [0, win.y1, 1, -1], [W, win.y1, -1, -1]]) {
      c.fillRect(dx > 0 ? x : x - 60, dy > 0 ? y : y - 6, 60, 6); c.fillRect(dx > 0 ? x : x - 6, dy > 0 ? y : y - 60, 6, 60);
    }
    c.fillStyle = C.faint; c.fillRect(66, win.y0, W - 132, 2); c.fillRect(66, win.y1 - 2, W - 132, 2);
    // HUD label
    const k = t >= T.k0 ? sim.kappa : -1;
    const label = t >= T.zoom - .2 ? 'The gate' : sim.fuse > -50 ? 'The gate' : k < 1 ? 'The island' : 'Chip · island keeper';
    c.drawImage(hud(label), 84, win.y0 + 36);
    // the fuse: a bar of cells that burns left to right over the whole piece, one cell per step
    const y = 1620, n = 38, cs = 24, p = clamp((t - T.snake0) / (T.zoom - T.snake0));
    const head = Math.floor(p * (n - 1));
    for (let i = 0; i < n; i++) {
      const x = 84 + i * cs;                                      // 38 cells x 24 px = 912 px
      c.fillStyle = i < head ? C.char : 'rgba(244,240,230,.26)';
      c.fillRect(x, y, cs - 4, cs - 4);
    }
    const hx = 84 + head * cs;
    c.fillStyle = C.red; c.fillRect(hx, y, cs - 4, cs - 4);
    c.fillStyle = C.hot; c.fillRect(hx + 6, y + 6, 8, 8);
    if (sim.frame % 2) { c.fillStyle = SPARKS[head % 4]; c.fillRect(hx + 6 + (head % 3) * 4, y - 14 - (head % 2) * 6, 6, 6); }
    c.globalAlpha = 1;
  }
  function drawCaptions(c, t) {
    for (const cap of CAPS) {
      if (t < cap.t0 || t > cap.t1 + .3) continue;
      const inP = (t - cap.t0) / .42, outP = (t - cap.t1) / .28;
      const p = stepsEnd(clamp(inP), 7);
      if (outP > 0) { // leaves the way it came: the tiles are copied away
        const q = 1 - stepsEnd(clamp(outP), 5);
        blitReveal(c, cap.img, 0, 0, q, {cell: 15, seed: 3, band: .05, sweep: .45});
      } else blitReveal(c, cap.img, 0, 0, p, {cell: 15, seed: 3});
    }
  }
  function drawGateGlow(c, t) {
    if (sim.litFrame === undefined) return;
    const age = t - sim.litFrame * DT; if (age > 1.2 || age < 0) return;
    const [x, y] = sim.gateScreen, a = Math.floor((1 - age / 1.2) * 5) / 5 * .55, r = 260 + age * 520;
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,90,60,${a})`); g.addColorStop(1, 'rgba(255,60,40,0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
    c.globalCompositeOperation = 'source-over';
  }
  function drawEmberGlow(c, t, win) {
    if (t < T.k0 || !keeper.chip.ember.visible) return;
    const [x, y] = toScreen(keeper.chip.ember.getWorldPosition(tmp), win), r = 110;
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,70,40,.30)'); g.addColorStop(1, 'rgba(255,40,20,0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
    c.globalCompositeOperation = 'source-over';
  }
  // The dive through the gate ends in red tiles that blit away into the end card.
  function drawPortalWipe(c, t) {
    const u = (t - T.end0 + .45) / .6;
    if (u <= 0 || u >= 1) return false;
    const cell = 2 * G, p = stepsEnd(u, 8) * 1.2;
    for (let cy = 0; cy < H / cell; cy++) for (let cx = 0; cx < W / cell; cx++) {
      const d = Math.hypot(cx * cell + cell / 2 - W / 2, cy * cell + cell / 2 - H / 2) / Math.hypot(W / 2, H / 2), th = d * .85 + hash(cx, cy, 9) * .15;
      if (th < p - .14) continue;                                    // already end card (drawn under, see frame())
      c.fillStyle = th < p ? (hash(cx, cy, 4) > .5 ? C.hot : C.ivory) : C.red; c.fillRect(cx * cell, cy * cell, cell, cell);
    }
    return true;
  }
  function drawWordmark(c, x, y, width, u) {
    const s = width / wm.vb[2];
    c.save(); c.translate(x, y); c.scale(s, s); c.translate(-wm.vb[0], -wm.vb[1]);
    c.fillStyle = C.ivory;
    if (u >= 1.2) c.fill(wm.solid);
    for (const r of wm.px) {
      const local = (u - r.d - .15) / .55; if (local < 0) continue;
      const q = stepsEnd(local, 4); if (q <= 0) continue;
      c.globalAlpha = q;
      const g = ((u - (2.4 + r.p * .7)) % 8 + 8) % 8, col = u < 2.4 ? C.ivory : g < .16 ? C.hot : g < .36 ? C.red : g < .56 ? C.hot : C.ivory;
      c.fillStyle = col; c.fillRect(r.x + (1 - q) * r.ox, r.y + (1 - q) * r.oy, r.w, r.h);
    }
    c.globalAlpha = 1;
    // "zedo": copied in column by column behind the pixels
    const gx0 = 3195, col = 160, cols = Math.ceil((wm.vb[0] + wm.vb[2] - gx0) / col), reveal = (u - .85) / .028;
    if (reveal > 0) {
      c.save(); c.beginPath();
      for (let i = 0; i < Math.min(cols, Math.floor(reveal)); i++) c.rect(gx0 + i * col - 40, wm.vb[1], col, wm.vb[3]);
      c.clip();
      c.transform(1, 0, 0, -1, 0, 1582); c.fillStyle = C.ivory;
      for (const gp of wm.glyphs) { c.save(); c.translate(gp.tx, 0); c.fill(gp.d); c.restore(); }
      c.restore();
      const lead = Math.floor(reveal);
      if (lead < cols) { c.fillStyle = C.red; c.fillRect(gx0 + lead * col - 40, 440, col, 1150); }
    }
    // warm sparks drift up off the letters
    for (const sp of wm.sparks) {
      const ph = u - sp.sd; if (ph < 0 || u < 1.4) continue;
      const q = (ph % sp.st) / sp.st; if (q > .38) continue;
      const k = q / .38, o = stepsEnd(k, 9);
      c.globalAlpha = k < .1 ? 1 : 1 - k; c.fillStyle = sp.fill; c.fillRect(sp.x + sp.sx * o, sp.y + sp.sy * o, sp.w, sp.w);
    }
    c.globalAlpha = 1; c.restore();
  }
  function drawChipSprite(c, frame, x, y, size = 240, flip = false) {
    c.save(); c.imageSmoothingEnabled = false;
    if (flip) { c.translate(x + size, y); c.scale(-1, 1); c.drawImage(chipSheet, frame * 48, 0, 48, 48, 0, 0, size, size); }
    else c.drawImage(chipSheet, frame * 48, 0, 48, 48, x, y, size, size);
    c.restore();
  }
  function drawEndCard(c, t) {
    const u = t - T.end0;
    c.fillStyle = C.bg; c.fillRect(0, 0, W, H);
    dotGrid(c, 0, 0, W, H);
    // the strike's last ripple fades out from the centre of the card
    const rr = Math.max(0, u + .5) * 900, fade = clamp(1 - (u + .5) / 2);
    for (let cy = 0; cy < H / G; cy++) for (let cx = 0; cx < W / G; cx++) {
      const d = Math.hypot(cx * G + G / 2 - W / 2, cy * G + G / 2 - H / 2), w = 1 - Math.abs(d - rr) / 160; if (w <= 0) continue;
      const lv = Math.floor(w * w * 4) / 4; if (lv <= 0) continue;
      c.fillStyle = `rgba(232,51,42,${(lv * .22 * fade).toFixed(3)})`; c.fillRect(cx * G + 2, cy * G + 2, G - 4, G - 4);
    }
    if (u > .1) { c.save(); drawWordmark(c, END_L.wordmark[0], END_L.wordmark[1], END_L.wordmark[2], u - .1); c.restore(); }
    if (u > .75) blitReveal(c, END.play, 0, END_L.play - headSize * .78 + 0, stepsEnd((u - .75) / .5, 7), {cell: 30, seed: 11, sweep: .7});
    if (u > .9) blitReveal(c, END.beyond, 0, END_L.beyond - headSize * .78, stepsEnd((u - .9) / .5, 7), {cell: 30, seed: 12, sweep: .7});
    if (u > 1.5) blitReveal(c, END.line, 0, END_L.line, stepsEnd((u - 1.5) / .35, 5), {cell: 15, seed: 13, sweep: .5});
    const [bx, by] = END_L.btn;
    const press = u > 4.1 && u < 4.3;
    if (u > 1.9) blitReveal(c, BTN[u > 4.1 ? 1 : 0], bx, by + (press ? 5 : 0), stepsEnd((u - 1.9) / .35, 6), {cell: 15, seed: 14, sweep: .85});
    if (u > 2.7) blitReveal(c, END.url, 0, by + BH + 36, stepsEnd((u - 2.7) / .3, 5), {cell: 15, seed: 15, sweep: .5});
    // Chip hops in from the left, waves, then hops over and presses the button
    const ground = by + BH - 4, SZ = 270;
    if (u > 2.2) {
      const a = u - 2.2, hopsEnd = .9;
      let x, y = 0, fr, flip = false;
      const stand = bx + BW + 24;
      if (a < hopsEnd) {                                               // three hops in from off-screen
        const n = 3, f = a / hopsEnd, i = Math.min(n - 1, Math.floor(f * n)), q = (f * n) % 1;
        x = lerp(-300, stand, (i + q) / n); y = -Math.sin(q * Math.PI) * 120;
        fr = q < .15 ? 0 : q < .45 ? 1 : q < .8 ? 2 : 3;
      } else if (a < hopsEnd + .8) { x = stand; fr = Math.floor((a - hopsEnd) / .22) % 2 ? 6 : 5; }
      else if (a < hopsEnd + 1.25) { const q = (a - hopsEnd - .8) / .45; x = stand; y = -Math.sin(q * Math.PI) * 150; fr = q < .2 ? 0 : q < .8 ? 2 : 3; }
      else { x = stand; fr = Math.floor((a - hopsEnd - 1.25) / .25) % 2 ? 6 : 5; }
      drawChipSprite(c, fr, snap(x, 6), snap(ground - SZ + y + 22, 6), SZ, flip);
    }
  }

  function frame(n) {
    advanceTo(n);
    const t = sim.t, win = winRect(t);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    if (t >= T.end0 - .45) {                                           // the end card (with the red tiles copying away over the dive)
      drawEndCard(ctx, t);
      if (t < T.end0 + .2) { /* portal tiles drawn below */ }
    }
    if (t < T.end0 + .2) {
      const portalOver = t >= T.end0 - .45;
      if (!portalOver) {
        // background, the 2D opening scene, the 3D viewport
        ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
        dotGrid(ctx, 0, 0, W, H, t); ripple(ctx, 0, 0, W, H, t);
        if (t < T.open1 + .1) { drawPixelB(ctx, t); }
        if (t >= T.open0) {
          setFrustum(sim.cam, win.y1 - win.y0);
          if (sim.glH !== win.y1 - win.y0) { sim.glH = win.y1 - win.y0; renderer.setSize(W, sim.glH, false); }
          camera.updateMatrixWorld(true);
          renderer.render(scene, camera);
          const opened = drawOpening(ctx, t, win);
          if (opened) {
            ctx.fillStyle = C.bg; ctx.fillRect(0, win.y0, W, win.y1 - win.y0);
            dotGrid(ctx, 0, win.y0, W, win.y1, t); ripple(ctx, 0, win.y0, W, win.y1, t);
            const since = sim.litFrame === undefined ? 99 : t - sim.litFrame * DT, shake = since < .3 ? Math.floor((1 - since / .3) * 4) * 6 : 0;
            const ox = shake ? (hash(sim.frame, 21) > .5 ? shake : -shake) : 0, oy = shake ? (hash(sim.frame, 22) > .5 ? shake : -shake) : 0;
            ctx.save(); ctx.beginPath(); ctx.rect(0, win.y0, W, win.y1 - win.y0); ctx.clip(); ctx.drawImage(gl, ox, win.y0 + oy); ctx.restore();
          }
        }
        drawEmberHop(ctx, t);
        if (t >= T.open0) { drawGateGlow(ctx, t); drawEmberGlow(ctx, t, win); }
        drawSparks(ctx, t);
        drawFrameFurniture(ctx, t, win);
        drawCaptions(ctx, t);
        if (win.e > 0 && win.e < 1) { /* the viewport has grown to the full frame */ }
      }
      if (t >= T.end0 - .45) drawPortalWipe(ctx, t);
    }
    return out;
  }

  reset();
  return {canvas: out, frame, duration: DURATION, fps: FPS, timeline: T, get events() { return sim.events; }, get sim() { return sim; }, size: [W, H]};
}
