import * as THREE from '../island/assets/vendor/three.module.js';
import { fractureGeometry } from '../island/stone.js?v=embers-13';
import { sceneMaterial, prepareFaces } from './shading.js';

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
  // 4 x 4 tiles of pixel planks (64 px each, scaled 4x with nearest filtering): grain streaks, dark joints, a few knots.
  const S = 64, c = document.createElement('canvas');
  c.width = c.height = S * 4;
  const g = c.getContext('2d');
  let s = 917;
  const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let t = 0; t < 16; t++) {
    const ox = (t % 4) * S, oy = Math.floor(t / 4) * S;
    const plank = 10 + Math.floor(r() * 6);
    for (let y = 0; y < S; y++) {
      const row = Math.floor(y / plank), joint = y % plank === 0;
      const base = 128 + (row % 3) * 9 + Math.floor(r() * 6);
      for (let x = 0; x < S; x++) {
        const streak = Math.sin((x + row * 17) * .21 + Math.sin(y * .7 + row) * 1.6) > .55 ? -16 : 0;
        const fleck = r() < .05 ? 18 : r() < .05 ? -22 : 0;
        const v = joint ? 52 : base + streak + fleck;
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(ox + x, oy + y, 1, 1);
      }
      if (!joint && r() < .04) { const kx = Math.floor(r() * (S - 4)); g.fillStyle = 'rgb(70,70,70)'; g.fillRect(ox + kx, oy + y, 3, 2); }
    }
  }
  const big = document.createElement('canvas');
  big.width = big.height = S * 16;
  const bg = big.getContext('2d');
  bg.imageSmoothingEnabled = false;
  bg.drawImage(c, 0, 0, big.width, big.height);
  const tex = new THREE.CanvasTexture(big);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
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
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
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
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function whiteTexture() {
  const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

export function createKit({maps, lights, seed = 1, keyLight = 1}) {
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

  function push(material, p, n, uv, col) {
    if (!batches.has(material)) batches.set(material, {p: [], n: [], uv: [], c: []});
    const b = batches.get(material);
    b.p.push(...p); b.n.push(...n); b.uv.push(...uv); b.c.push(...col);
  }

  // Sort a block's faces into materials and atlas tiles (as world.js add()).
  function add(geometry, {mat = 'stone', color = null, tint = 1, size = 1}) {
    if (geometry.index) { const s = geometry; geometry = s.toNonIndexed(); s.dispose(); }
    const a = geometry.attributes;
    const stoneTile = Math.floor(rand() * 16), redTile = Math.floor(rand() * 8), woodTile = Math.floor(rand() * 16);
    const shade = color ? new THREE.Color(color) : mat === 'wood' ? woodSwatches[Math.floor(rand() * 4)] : swatches[Math.floor(rand() * swatches.length)];
    const density = THREE.MathUtils.clamp(size / .75, .2, 1);   // small stones take a smaller patch, so the grain keeps its scale
    for (let i = 0; i < a.position.count; i += 3) {
      const ny = (a.normal.getY(i) + a.normal.getY(i + 1) + a.normal.getY(i + 2)) / 3;
      const top = ny > .58;
      let kind = mat;
      if (mat === 'red') kind = top ? 'red' : 'stone';
      const tile = kind === 'red' || kind === 'glow' || kind === 'crimson' ? redTile : kind === 'wood' ? woodTile : stoneTile;
      const span = kind === 'glow' || kind === 'crimson' ? .9375 : (kind === 'red' ? .9375 : kind === 'wood' ? .9 : .62) * (kind === 'paint' ? 1 : density);
      let col;
      if (kind === 'red') col = new THREE.Color(.94, .94, .94).multiplyScalar(tint);
      else if (kind === 'crimson') {                             // tops lit, fronts mid, right faces in shade: each cube reads as a cube
        const nx = (a.normal.getX(i) + a.normal.getX(i + 1) + a.normal.getX(i + 2)) / 3;
        col = new THREE.Color(1, 1, 1).multiplyScalar(tint * (top ? 1.18 : ny < -.5 ? .35 : nx > .5 ? .62 : nx < -.5 ? .55 : .86));
      }
      else if (kind === 'glow') col = new THREE.Color(.94, .94, .94).multiplyScalar(tint * (top ? 1 : ny < -.5 ? .35 : .62));
      else if (kind === 'stone' && mat === 'red') col = swatches[Math.floor(rand() * swatches.length)];
      else col = shade.clone().multiplyScalar(kind === 'paint' ? 1 : tint);
      const uv = [];
      for (let j = 0; j < 3; j++) {
        const u = a.uv.getX(i + j), v = a.uv.getY(i + j);
        uv.push(((tile % 4) + (u - Math.floor(u)) * span + .03125) / 4, 1 - (Math.floor(tile / 4) + (v - Math.floor(v)) * span + .03125) / 4);
      }
      push(materials[kind], Array.from(a.position.array.slice(i * 3, i * 3 + 9)), Array.from(a.normal.array.slice(i * 3, i * 3 + 9)), uv,
        [col.r, col.g, col.b, col.r, col.g, col.b, col.r, col.g, col.b]);
    }
    geometry.dispose();
  }

  // A polygon in the XY plane extruded along Z from z to z + depth, its long edges notched into broken stone.
  function polygon(points, z, depth, opts = {}) {
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
    let g = new THREE.ExtrudeGeometry(shape, {depth: Math.max(.001, depth - 2 * bevel), bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 1, steps: 1});
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
    add(g, {...opts, size: Math.max(size.x, size.y, size.z)});
  }

  // A chipped block centred on (x, y, z): an octagon front outline (corners knocked off), extruded along Z.
  function slab(x, y, z, w, h, d, opts = {}) {
    const chip = opts.chip ?? .023;
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
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
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

  return {rand, slab, polygon, prism, wear, build, materials};
}
