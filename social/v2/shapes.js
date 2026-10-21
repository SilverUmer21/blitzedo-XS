// Voxel formations for the reel. Each formation is a list of {x, y, z, s, c, h}: centre, edge length, colour (hex) and heat
// (0 cold .. 1 white-hot, glows red). Everything is generated from a seeded RNG so every run is identical.
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export const PAL = {
  bg: 0x090A08, ivory: 0xFBF5EB, red: 0xE8332A, crimson: 0xAE1212, hot: 0xFF8A66,
  charcoal: 0x232422, charcoal2: 0x34353a,
  navy: 0x10163A, indigo: 0x4B4AA8, lavender: 0xD9D2EE, mint: 0x6FD6B8, yellow: 0xF0C85A,
  cream: 0xF6EBD2, tomato: 0xD2352B, leaf: 0x6FA85C, blue: 0x5B7FC4
};
const mixHex = (a, b, t) => { const r = ((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t, g = ((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t, bl = (a & 255) * (1 - t) + (b & 255) * t; return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl); };
export { mixHex };

// The pixel b of the favicon / wordmark: 7 x 9 cells.
export const B_CELLS = [];
for (let y = 0; y < 9; y++) for (const x of [0, 1]) B_CELLS.push([x, y]);
for (const [y, xs] of [[2, [3, 4, 5]], [3, [2, 3, 4, 5, 6]], [4, [5, 6]], [5, [5, 6]], [6, [5, 6]], [7, [2, 3, 4, 5, 6]], [8, [3, 4, 5]]]) for (const x of xs) B_CELLS.push([x, y]);

// The b as a solid monolith of small cubes: each pixel cell is S x S voxels in the plane and D deep.
export function voxelB({v = .1, S = 3, D = 6, seed = 5} = {}) {
  const r = rng(seed), out = [], has = new Set(B_CELLS.map(([x, y]) => x + ',' + y));
  const cols = 7 * S, rows = 9 * S;
  const filled = (gx, gy) => gx >= 0 && gy >= 0 && gx < cols && gy < rows && has.has(Math.floor(gx / S) + ',' + Math.floor(gy / S));
  for (const [cx, cy] of B_CELLS) for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
    const gx = cx * S + sx, gy = cy * S + sy;
    // exposed to the top (nothing above within 2 voxels) => red crown, like the sculpture's red treads
    const top = !filled(gx, gy - 1) && !filled(gx, gy - 2);
    for (let dz = 0; dz < D; dz++) {
      const front = dz === D - 1, back = dz === 0;
      const x = (gx - (cols - 1) / 2) * v, y = ((rows - 1) / 2 - gy) * v, z = (dz - (D - 1) / 2) * v;
      let c = mixHex(PAL.charcoal, PAL.charcoal2, r());
      let red = 0;
      if (top && r() < .92) { c = mixHex(PAL.crimson, PAL.red, r()); red = 1; }
      else if ((front || back) && r() < .035) { c = PAL.red; red = 1; }
      out.push({x, y, z, s: v, c, h: 0, red, gx, gy, dz});
    }
  }
  return out;
}

// The doorway: an arched frame of cubes with a recess for the glowing interior.
export function voxelDoor({v = .12, D = 4, seed = 9} = {}) {
  const r = rng(seed), out = [];
  const outerW = 28, inner = 18, wall = (outerW - inner) / 2, straight = 24, archR = outerW / 2;  // voxels
  const innerR = inner / 2;
  const total = straight + archR;
  for (let gy = 0; gy < total + 1; gy++) for (let gx = 0; gx < outerW; gx++) {
    const px = gx - (outerW - 1) / 2, py = gy;
    // outer silhouette: rectangle with a semicircular head
    const inOuter = py <= straight ? true : Math.hypot(px, py - straight) <= archR;
    const inInner = py <= straight - 0 ? Math.abs(px) < innerR && py >= 3 : Math.hypot(px, py - straight) < innerR - 0.0;
    if (!inOuter || inInner) continue;
    for (let dz = 0; dz < D; dz++) {
      const x = px * v, y = (py - total / 2) * v, z = (dz - (D - 1) / 2) * v;
      const edge = Math.abs(Math.hypot(px, py - straight) - innerR) < 1.6 && py > straight || (Math.abs(Math.abs(px) - innerR) < 1.6 && py <= straight);
      let c = mixHex(PAL.charcoal, PAL.charcoal2, r()), red = 0;
      if (edge && dz > 0 && r() < .7) { c = mixHex(PAL.crimson, PAL.red, r()); red = 1; }
      out.push({x, y, z, s: v, c, h: 0, red});
    }
  }
  return out;
}

// A floral planet in Orbit Shift's navy / indigo, with a mint and yellow flower, ringed by a yellow orbit.
export function voxelPlanet({v = .1, R = 1.15, seed = 21} = {}) {
  const r = rng(seed), out = [], n = Math.round(R / v);
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (let k = -n; k <= n; k++) {
    const d = Math.hypot(i, j, k);
    if (d > n + .2 || d < n - 1.2) continue;                      // a shell, one to two voxels thick
    const nx = i / d, ny = j / d, nz = k / d;
    // flower on the pole facing the viewer: petals by angle, yellow heart
    const ang = Math.atan2(ny, nx), rad = Math.acos(clamp1(nz)) * 1.9;
    const petal = Math.cos(ang * 5) * .5 + .5;
    let c = mixHex(PAL.navy, PAL.indigo, .5 + .5 * Math.sin(i * .5) * Math.cos(k * .45));
    if (nz > .25) {
      if (rad < .22) c = PAL.yellow;
      else if (rad < .55 + petal * .55) c = r() < .06 ? PAL.mint : PAL.lavender;
      else if (rad < 1.1 && r() < .1) c = PAL.mint;
    } else if (r() < .05) c = PAL.mint;
    out.push({x: i * v, y: j * v, z: k * v, s: v * .98, c, h: 0});
  }
  // the orbit: a tilted ring of yellow cubes
  const ringR = R * 1.65;
  for (let a = 0; a < 140; a++) {
    const t = a / 140 * Math.PI * 2, x = Math.cos(t) * ringR, z = Math.sin(t) * ringR * .42, y = Math.sin(t) * ringR * .2;
    out.push({x, y, z, s: v * 1.1, c: a % 7 === 0 ? PAL.mint : PAL.yellow, h: 0});
  }
  return out;
}

// Orbit Shift's angular ship: a swept arrowhead (chevron), lavender and white with a mint and indigo core and a yellow edge.
export function voxelShip({v = .1, seed = 33} = {}) {
  const out = [], poly = [[30, 0], [0, 8.5], [10, 0], [0, -8.5]];
  const inside = (px, py) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) c = !c; } return c; };
  const ca = Math.cos(.42), sa = Math.sin(.42);
  for (let x = -1; x <= 31; x++) for (let y = -10; y <= 10; y++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1);
    const core = x > 9 && x < 24 && Math.abs(y) < (1 - (x - 9) / 15) * 2.6 + .6;
    for (let z = 0; z < 2; z++) {
      let c = y < 0 ? PAL.lavender : mixHex(PAL.lavender, PAL.indigo, .5);
      if (core) c = z ? PAL.mint : PAL.indigo;
      if (edge) c = mixHex(PAL.yellow, PAL.cream, .25);
      const px = (x - 15) * v, py = y * v;
      out.push({x: px * ca - py * sa, y: px * sa + py * ca, z: (z - .5) * v, s: v * .98, c, h: 0});
    }
  }
  return out;
}

// Harvest & Hearth's strawberry: tomato red with cream seeds and a leaf crown.
export function voxelStrawberry({v = .1, R = 1.05, seed = 41} = {}) {
  const r = rng(seed), out = [], n = Math.round(R / v);
  for (let i = -n; i <= n; i++) for (let j = -n * 1.25; j <= n; j++) for (let k = -n; k <= n; k++) {
    const jj = j / 1.25 * (j < 0 ? 1 : 1);
    // egg-like: wider at the shoulders, tapering to the tip (j < 0)
    const taper = j < 0 ? 1 - Math.pow(-j / (n * 1.25), 1.6) * .75 : 1;
    const d = Math.hypot(i / taper, jj, k / taper);
    if (d > n + .2 || d < n - 1.3) continue;
    let c = mixHex(PAL.tomato, PAL.red, r());
    // seeds: a regular dimple lattice
    if (((i + 40) * 7 + (j + 40) * 3 + (k + 40) * 5) % 9 === 0 && j > -n * .8) c = PAL.cream;
    out.push({x: i * v, y: -j * v + .2, z: k * v, s: v * .98, c, h: 0});
  }
  // leaf crown
  for (let a = 0; a < 6; a++) for (let q = 0; q < 8; q++) {
    const ang = a / 6 * Math.PI * 2, rr = .1 + q * .09;
    out.push({x: Math.cos(ang) * rr, y: R * 1.0 + .22 + Math.sin(q / 8 * Math.PI) * .16 - q * .012, z: Math.sin(ang) * rr, s: v * 1.05, c: mixHex(PAL.leaf, 0x3E7A3A, r() * .6), h: 0});
  }
  out.push({x: 0, y: R + .5, z: 0, s: v * 1.1, c: PAL.leaf, h: 0});
  return out;
}

// Thin lightning bolt as a path of points, from the sky down to a target (the strike).
export function boltPath(from, to, seed = 3, jag = .5, segs = 22) {
  const r = rng(seed), pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, fall = Math.sin(t * Math.PI);
    pts.push({x: from.x + (to.x - from.x) * t + (r() - .5) * jag * fall * 2, y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t + (r() - .5) * jag * fall});
  }
  return pts;
}
function clamp1(x) { return Math.max(-1, Math.min(1, x)); }
