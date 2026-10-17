import * as THREE from '../island/assets/vendor/three.module.js';
import { fractureGeometry } from '../island/stone.js?v=embers-13';
import { sceneMaterial, prepareFaces } from './shading.js';
import { VIEW_DIR } from './stage.js';

// A builder for the site's stone dioramas, the way island/world.js builds the island: every block is a chipped, bevelled
// polygon extruded front to back; big exposed faces get shallow angular relief (fractureGeometry); each face samples a
// tile of the photographed pixel atlases (stone, red light, edge wear) at a constant pixel density, so a small stone shows
// the same grain size as a big one. Faces are batched per material into one mesh each.
//
//   const kit = createKit({maps, lights, seed});
//   kit.slab(x, y, z, w, h, d, {mat: 'stone' | 'red' | 'glow' | 'wood' | 'paint', color, chip, tint});
//   kit.wear(x, y, z, w, h, {side, tile});    // a red worn edge plane (alpha-cut atlas)
//   const group = kit.build();
//
// Materials: stone = charcoal; red = red light on top faces only (sides stay charcoal), like the island's treads and
// crowns; glow = red on every face (a crimson object lit from inside); wood = a pixel plank atlas; paint = a flat colour
// (ivory paper, ink) that still takes the scene's lighting.

export function woodAtlas() {
  // One repeating tile of pixel wood grain (64 px, scaled 4x with nearest filtering), laid on in world units (kit.add):
  // the grain runs along each timber's length at the same scale everywhere, and mipmaps keep it from shimmering at a
  // distance or while the scene floats.
  const S = 64, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  let s = 917;
  const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const wave = Math.sin(x * .1 + Math.sin(y * .45) * 1.3) * .5 + Math.sin(y * .9 + x * .02) * .5;
    let v = 132 + wave * 14 + (r() - .5) * 8;
    if (Math.abs(Math.sin(y * .52 + Math.sin(x * .08) * .9)) > .93) v -= 22;    // darker grain lines, long and soft
    g.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`;
    g.fillRect(x, y, 1, 1);
  }
  for (let k = 0; k < 3; k++) {                                                   // a few knots
    const kx = Math.floor(r() * (S - 6)), ky = Math.floor(r() * (S - 4));
    g.fillStyle = 'rgb(92,92,92)'; g.fillRect(kx, ky, 5, 3);
    g.fillStyle = 'rgb(74,74,74)'; g.fillRect(kx + 1, ky + 1, 3, 1);
  }
  const big = document.createElement('canvas');
  big.width = big.height = S * 4;
  const bg = big.getContext('2d');
  bg.imageSmoothingEnabled = false;
  bg.drawImage(c, 0, 0, big.width, big.height);
  const tex = new THREE.CanvasTexture(big);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Pixel textures stay crisp up close (nearest) but get mipmaps for distance, so fine pixel detail never shimmers.
export function mipmapped(tex) {
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

// The pixel-red tile of the home page's voxel island, which read best for small crimson bricks: each tile a 6 x 6 pixel
// face with a lit top-left edge, a shaded bottom-right edge, a dark corner and a few specks. 4 x 4 variants.
export function brickAtlas() {
  const N = 6, S = 16 * N, c = document.createElement('canvas');
  c.width = c.height = S * 4;
  const g = c.getContext('2d');
  let s = 331;
  const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const C = {H: [255, 108, 84], h: [255, 79, 61], R: [229, 38, 33], r: [168, 20, 18], d: [107, 10, 10]};
  for (let t = 0; t < 16; t++) {
    const ox = (t % 4) * S, oy = Math.floor(t / 4) * S, cell = S / N;
    for (let u = 0; u < N; u++) for (let w = 0; w < N; w++) {
      let col;
      if (u === N - 1 && w === N - 1) col = C.d;
      else if (u === 0 || w === 0) col = (u + w) % 3 === 0 ? C.h : C.H;
      else if (u === N - 1 || w === N - 1) col = C.r;
      else { const q = r(); col = q < .12 ? C.h : q > .9 ? C.r : C.R; }
      g.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
      g.fillRect(ox + u * cell, oy + w * cell, cell, cell);
    }
  }
  const tex = mipmapped(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Deep crimson cube faces for small-brick objects (the contact mailbox): a one-pixel dark border that reads as the gap
// between cubes, a slightly lit top-left edge, and a fine pixel grain inside. 4 x 4 variants.
export function crimsonAtlas() {
  const N = 12, cell = 8, S = N * cell, c = document.createElement('canvas');
  c.width = c.height = S * 4;
  const g = c.getContext('2d');
  let s = 557;
  const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let t = 0; t < 16; t++) {
    const ox = (t % 4) * S, oy = Math.floor(t / 4) * S, base = .86 + r() * .2;
    for (let u = 0; u < N; u++) for (let w = 0; w < N; w++) {
      let k = base * (.92 + r() * .14);
      if (u === 0 || w === 0) k *= 1.14;                         // lit top-left edge
      if (u === N - 1 || w === N - 1) k *= .62;                  // shaded bottom-right edge
      if (r() < .05) k *= .72;                                   // pits
      const edge = u === 0 && w === 0 ? .9 : 1;
      const R = Math.min(255, 196 * k * edge), G = Math.min(255, 18 * k), B = Math.min(255, 14 * k);
      g.fillStyle = `rgb(${R | 0},${G | 0},${B | 0})`;
      g.fillRect(ox + u * cell, oy + w * cell, cell, cell);
    }
    g.fillStyle = 'rgb(46,6,5)';                                 // the gap
    g.fillRect(ox, oy + S - cell, S, cell); g.fillRect(ox + S - cell, oy, cell, S);
  }
  const tex = mipmapped(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function whiteTexture() {
  const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

export function createKit({maps, lights, seed = 1, keyLight = 1, cull: cullAll = true}) {
  let state = seed >>> 0;
  const rand = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const white = whiteTexture();
  const materials = {
    stone: sceneMaterial({map: maps.stone, lights, keyLight}),
    crimson: sceneMaterial({map: maps.crimson || crimsonAtlas(), lights, keyLight, color: new THREE.Color(.62, .62, .62), emissive: 0xff0905, emissiveIntensity: .015}),
    red: sceneMaterial({map: maps.red, lights, emissive: 0xff0905, emissiveIntensity: .16}),
    glow: sceneMaterial({map: maps.brick || brickAtlas(), lights, color: new THREE.Color(1.9, 1.9, 1.9), emissive: 0xff0905, emissiveIntensity: .3}),
    wood: sceneMaterial({map: maps.wood, lights}),
    paint: sceneMaterial({map: white, lights}),
    edge: sceneMaterial({map: maps.edge, lights, alphaTest: .22, emissive: 0xff1005, emissiveIntensity: .36, edgeAccent: .08, side: THREE.DoubleSide})
  };
  const batches = new Map();
  const swatches = Array.from({length: 7}, (_, i) => new THREE.Color(0x82817d).multiplyScalar(.85 + i * .035));
  const woodSwatches = [0x8a5a3a, 0x7d5034, 0x946443, 0x6f4730].map(c => new THREE.Color(c));

  // Faces go straight into growable typed buffers per material: no per-triangle objects, so hundreds of cubes build fast.
  function batch(material) {
    let b = batches.get(material);
    if (!b) { b = {p: new Float32Array(9 * 512), n: new Float32Array(9 * 512), uv: new Float32Array(6 * 512), c: new Float32Array(9 * 512), tris: 0}; batches.set(material, b); }
    if ((b.tris + 1) * 9 > b.p.length) for (const k of ['p', 'n', 'uv', 'c']) { const g = new Float32Array(b[k].length * 2); g.set(b[k]); b[k] = g; }
    return b;
  }

  // Sort a block's faces into materials and atlas tiles (as world.js add()). Faces turned away from the camera (which only
  // ever sees the scene from VIEW_DIR, give or take the small pointer lean) are dropped: about half of every block.
  const [VX, VY, VZ] = VIEW_DIR.toArray();
  function add(geometry, opts) {
    if (geometry.index) { const s = geometry; geometry = s.toNonIndexed(); s.dispose(); }
    const a = geometry.attributes;
    addRaw(a.position.array, a.normal.array, a.uv.array, opts);
    geometry.dispose();
  }
  function addRaw(P, N, UV, {mat = 'stone', color = null, tint = 1, size = 1, cull = cullAll}) {
    const stoneTile = Math.floor(rand() * 16), redTile = Math.floor(rand() * 8);
    const shade = color ? new THREE.Color(color) : mat === 'wood' ? woodSwatches[Math.floor(rand() * 4)] : swatches[Math.floor(rand() * swatches.length)];
    const density = THREE.MathUtils.clamp(size / .75, .2, 1);   // small stones take a smaller patch, so the grain keeps its scale
    // wood: the grain runs along the block's longest side, in world units
    let long = 0;
    if (mat === 'wood') {
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[i + k]); mx[k] = Math.max(mx[k], P[i + k]); }
      const ext = [0, 1, 2].map(k => mx[k] - mn[k]);
      long = ext.indexOf(Math.max(...ext));
    }
    const woodShift = rand() * 10;
    const base = [shade.r, shade.g, shade.b];
    for (let i = 0; i < P.length / 3; i += 3) {
      const o = i * 3;
      const nx = (N[o] + N[o + 3] + N[o + 6]) / 3, ny = (N[o + 1] + N[o + 4] + N[o + 7]) / 3, nz = (N[o + 2] + N[o + 5] + N[o + 8]) / 3;
      if (cull && nx * VX + ny * VY + nz * VZ < -.3) continue;
      const top = ny > .58;
      let kind = mat;
      if (mat === 'red') kind = top ? 'red' : 'stone';
      const tile = kind === 'red' || kind === 'glow' || kind === 'crimson' ? redTile : stoneTile;
      const span = kind === 'glow' || kind === 'crimson' ? .9375 : (kind === 'red' ? .9375 : .62) * (kind === 'paint' ? 1 : density);
      let cr, cg, cb;
      if (kind === 'red') { cr = cg = cb = .94 * tint; }
      else if (kind === 'crimson') { cr = cg = cb = tint * (top ? 1.18 : ny < -.5 ? .35 : nx > .5 ? .62 : nx < -.5 ? .55 : .86); }
      else if (kind === 'glow') { cr = cg = cb = .94 * tint * (top ? 1 : ny < -.5 ? .35 : .62); }
      else if (kind === 'stone' && mat === 'red') { const w = swatches[Math.floor(rand() * swatches.length)]; cr = w.r; cg = w.g; cb = w.b; }
      else { const k = kind === 'paint' ? 1 : tint; cr = base[0] * k; cg = base[1] * k; cb = base[2] * k; }
      const b = batch(materials[kind]), t9 = b.tris * 9, t6 = b.tris * 6;
      for (let j = 0; j < 9; j++) { b.p[t9 + j] = P[o + j]; b.n[t9 + j] = N[o + j]; }
      for (let j = 0; j < 3; j++) {
        b.c[t9 + j * 3] = cr; b.c[t9 + j * 3 + 1] = cg; b.c[t9 + j * 3 + 2] = cb;
        let u, v;
        if (kind === 'wood') {
          // the face's two in-plane axes; u follows the long axis when it lies in this face
          const ax = Math.abs(nx) > .7 ? [2, 1] : Math.abs(ny) > .7 ? [0, 2] : [0, 1];
          const [ua, va] = ax.includes(long) ? [long, ax.find(k => k !== long)] : ax;
          u = P[o + j * 3 + ua] * .9 + woodShift; v = P[o + j * 3 + va] * .9 + woodShift * .37;
        } else {
          const u0 = UV[(i + j) * 2], v0 = UV[(i + j) * 2 + 1];
          u = ((tile % 4) + (u0 - Math.floor(u0)) * span + .03125) / 4;
          v = 1 - (Math.floor(tile / 4) + (v0 - Math.floor(v0)) * span + .03125) / 4;
        }
        b.uv[t6 + j * 2] = u; b.uv[t6 + j * 2 + 1] = v;
      }
      b.tris++;
    }
  }

  // A polygon in the XY plane extruded along Z from z to z + depth, its long edges notched into broken stone.
  function polygon(points, z, depth, opts = {}) {
    const {g, size} = cut(points, z, depth, opts);
    add(g, {...opts, size: Math.max(size.x, size.y, size.z)});
  }
  function cut(points, z, depth, opts = {}) {
    const {bevel = .006, notch = .46, relief = true} = opts;
    const chipped = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      chipped.push(a);
      if (len > .35 && rand() < notch) {
        const t = .28 + rand() * .4, w = Math.min(.11, len * .16), inset = .015 + rand() * .025;
        for (const [at, dep] of [[t - w / len, 0], [t - w / len, inset], [t, inset * .7], [t, 0]]) chipped.push([a[0] + dx * at - dy / len * dep, a[1] + dy * at + dx / len * dep]);
      }
    }
    const shape = new THREE.Shape();
    shape.moveTo(...chipped[0]);
    for (const p of chipped.slice(1)) shape.lineTo(...p);
    shape.closePath();
    let g = new THREE.ExtrudeGeometry(shape, {depth: Math.max(.001, depth - 2 * bevel), bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 1, steps: 1});
    g.translate(0, 0, z + bevel);
    const uv = g.attributes.uv, pos = g.attributes.position, norm = g.attributes.normal;
    const box = new THREE.Box3().setFromBufferAttribute(pos), size = box.getSize(new THREE.Vector3());
    for (let i = 0; i < uv.count; i++) {
      const x = (pos.getX(i) - box.min.x) / Math.max(size.x, .001), y = (pos.getY(i) - box.min.y) / Math.max(size.y, .001), zz = (pos.getZ(i) - box.min.z) / Math.max(size.z, .001);
      const nx = Math.abs(norm.getX(i)), ny = Math.abs(norm.getY(i));
      uv.setXY(i, (nx > .7 ? zz : x) * .999, (ny > .7 ? zz : y) * .999);
    }
    if (relief && depth > .5 && size.y > .4 && opts.mat !== 'paint') g = fractureGeometry(g, chipped, Math.floor(rand() * 10000));
    if (opts.matrix) g.applyMatrix4(opts.matrix);               // a tilted part (an envelope), placed after it is cut
    if (g.index) { const s = g; g = s.toNonIndexed(); s.dispose(); }
    return {g, size};
  }

  // Small plain blocks (no relief, no notches: the cubes of the contact and studio scenes, hundreds of them) are copied from
  // a few pre-cut unit templates, scaled and moved, instead of being cut one by one: the same look, many times faster.
  const templates = Array.from({length: 8}, () => {
    const c = .09, a = c * (.5 + rand()), b = c * (.5 + rand());
    const pts = [[-.5 + a, -.5], [.5 - b, -.5], [.5, -.5 + b], [.5, .5 - a], [.5 - a, .5], [-.5 + b, .5], [-.5, .5 - b], [-.5, -.5 + a]];
    const {g} = cut(pts, -.5, 1, {bevel: 0, notch: 0, relief: false});
    return {p: g.attributes.position.array, n: g.attributes.normal.array, uv: g.attributes.uv.array};
  });
  function box(x, y, z, w, h, d, opts = {}) {
    const t = templates[Math.floor(rand() * templates.length)];
    const P = new Float32Array(t.p.length);
    for (let i = 0; i < P.length; i += 3) { P[i] = x + t.p[i] * w; P[i + 1] = y + t.p[i + 1] * h; P[i + 2] = z + t.p[i + 2] * d; }
    addRaw(P, t.n, t.uv, {...opts, size: Math.max(w, h, d)});
  }

  // A chipped block centred on (x, y, z): an octagon front outline (corners knocked off), extruded along Z.
  function slab(x, y, z, w, h, d, opts = {}) {
    const chip = opts.chip ?? .023;
    if (opts.relief === false && opts.notch === 0 && !opts.matrix && chip > 0 && opts.mat !== 'paint') return box(x, y, z, w, h, d, opts);
    const a = chip * (.5 + rand()), b = chip * (.5 + rand());
    const pts = [[x - w / 2 + a, y - h / 2], [x + w / 2 - b, y - h / 2], [x + w / 2, y - h / 2 + b], [x + w / 2, y + h / 2 - a], [x + w / 2 - a, y + h / 2], [x - w / 2 + b, y + h / 2], [x - w / 2, y + h / 2 - b], [x - w / 2, y - h / 2 + a]];
    polygon(pts, z - d / 2, d, {bevel: Math.min(.006, w * .015, h * .015), ...opts});
  }

  // A block whose outline is drawn in the XZ plane (seen from above) and extruded upward; for shapes such as an arch's side.
  function prism(points, y0, h, opts = {}) {
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], -points[0][1]);
    for (const p of points.slice(1)) shape.lineTo(p[0], -p[1]);
    shape.closePath();
    const bevel = opts.bevel ?? .005;
    let g = new THREE.ExtrudeGeometry(shape, {depth: h - 2 * bevel, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 1, steps: 1});
    g.rotateX(-Math.PI / 2);
    g.translate(0, y0 + bevel, 0);
    const uv = g.attributes.uv, pos = g.attributes.position, norm = g.attributes.normal;
    const box = new THREE.Box3().setFromBufferAttribute(pos), size = box.getSize(new THREE.Vector3());
    for (let i = 0; i < uv.count; i++) {
      const x = (pos.getX(i) - box.min.x) / Math.max(size.x, .001), y = (pos.getY(i) - box.min.y) / Math.max(size.y, .001), zz = (pos.getZ(i) - box.min.z) / Math.max(size.z, .001);
      const nx = Math.abs(norm.getX(i)), ny = Math.abs(norm.getY(i));
      uv.setXY(i, (nx > .7 ? zz : x) * .999, (ny > .7 ? zz : y) * .999);
    }
    add(g, {...opts, size: Math.max(size.x, size.y, size.z)});
  }

  const edges = [];
  function wear(x, y, z, w, h, {side = false, tile = 0} = {}) {
    const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, ((tile % 4) + .03125 + uv.getX(i) * .9375) / 4, 1 - (Math.floor(tile / 4) + .03125 + (1 - uv.getY(i)) * .9375) / 4);
    if (side) g.rotateY(Math.PI / 2);
    g.translate(x, y, z);
    edges.push(g.toNonIndexed());
    g.dispose();
  }

  function build() {
    const group = new THREE.Group();
    for (const [material, b] of batches) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(b.p.slice(0, b.tris * 9), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(b.n.slice(0, b.tris * 9), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(b.uv.slice(0, b.tris * 6), 2));
      g.setAttribute('color', new THREE.BufferAttribute(b.c.slice(0, b.tris * 9), 3));
      group.add(new THREE.Mesh(prepareFaces(g), material));
    }
    if (edges.length) {
      const g = new THREE.BufferGeometry();
      for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2]]) {
        const arr = new Float32Array(edges.reduce((n, e) => n + e.attributes[name].array.length, 0));
        let o = 0;
        for (const e of edges) { arr.set(e.attributes[name].array, o); o += e.attributes[name].array.length; }
        g.setAttribute(name, new THREE.BufferAttribute(arr, size));
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
      group.add(new THREE.Mesh(prepareFaces(g), materials.edge));
      edges.forEach(e => e.dispose());
    }
    return group;
  }

  return {rand, slab, box, polygon, prism, wear, build, materials};
}
