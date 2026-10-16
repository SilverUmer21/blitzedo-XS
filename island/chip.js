import * as THREE from './assets/vendor/three.module.js';
import { referenceMaterial, prepareReferenceFaces } from './reference-shading.js?v=embers-13';

// Chip, the island keeper: one of the floating fragments that woke up. It is built the way world.js builds the island
// (chipped, bevelled stones, the same atlases and lighting shaders) so it belongs to that world: a red-capped top block
// tapering into stubby legs, like the fragments under the island. Units are the scene's; Chip stands about two stair
// rises tall. createChip() returns the rig; poseChip() sets a pose from a few readable parameters.

const IVORY = 0xf4f0e6, INK = 0x0b0b0a, BLUSH = 0xc4161b;
const LEG_H = .11;
// Body stack, bottom to top: [width, height, depth]
const LOWER = [.26, .08, .25], MID = [.36, .12, .34], MAIN = [.46, .30, .43], CAP = [.48, .05, .45];
const MAIN_Y = LOWER[1] + MID[1] + MAIN[1] / 2;            // centre of the main block, in body space
const TOP_Y = LOWER[1] + MID[1] + MAIN[1] + CAP[1];        // top of the red cap

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

// A chipped, bevelled block centred on the origin, as world.js's slab(): an octagon outline extruded front to back,
// with per-face UVs projected the same way so the atlas lands on it identically.
function stoneGeometry(w, h, d, chip, rand) {
  const a = chip * (.5 + rand()), b = chip * (.5 + rand());
  const pts = [[-w/2+a,-h/2],[w/2-b,-h/2],[w/2,-h/2+b],[w/2,h/2-a],[w/2-a,h/2],[-w/2+b,h/2],[-w/2,h/2-b],[-w/2,-h/2+a]];
  const shape = new THREE.Shape();
  shape.moveTo(...pts[0]);
  for (const p of pts.slice(1)) shape.lineTo(...p);
  shape.closePath();
  const bevel = Math.min(.006, w * .015, h * .015);
  let g = new THREE.ExtrudeGeometry(shape, {depth: d - 2 * bevel, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 1, steps: 1});
  g.translate(0, 0, -d / 2 + bevel);
  if (g.index) { const source = g; g = g.toNonIndexed(); source.dispose(); }
  const pos = g.attributes.position, norm = g.attributes.normal, uv = g.attributes.uv;
  g.computeBoundingBox();
  const min = g.boundingBox.min, size = g.boundingBox.getSize(new THREE.Vector3());
  for (let i = 0; i < pos.count; i++) {
    const x = (pos.getX(i) - min.x) / Math.max(size.x, .001), y = (pos.getY(i) - min.y) / Math.max(size.y, .001), z = (pos.getZ(i) - min.z) / Math.max(size.z, .001);
    const nx = Math.abs(norm.getX(i)), ny = Math.abs(norm.getY(i));
    uv.setXY(i, (nx > .7 ? z : x) * .999, (ny > .7 ? z : y) * .999);
  }
  return g;
}

// Split a block into its red top face (when red) and charcoal sides, mapping each into an atlas tile like world.js.
function stone(w, h, d, {red = false, chip = .02, seed = 1, materials}) {
  const rand = rng(seed);
  const g = stoneGeometry(w, h, d, chip, rand);
  const tile = Math.floor(rand() * 16), redTile = Math.floor(rand() * 8);
  // A step lighter than the island's stone, so the figure separates from its ground.
  const shade = new THREE.Color(0x82817d).multiplyScalar(1.3 + rand() * .16);
  // Small parts take a smaller patch of the atlas, so the stone grain keeps the island's scale.
  const density = THREE.MathUtils.clamp(Math.max(w, h, d) / .75, .2, 1);
  const lists = {stone: {p: [], n: [], uv: [], c: []}, red: {p: [], n: [], uv: [], c: []}};
  const {position: pos, normal: norm, uv} = g.attributes;
  for (let i = 0; i < pos.count; i += 3) {
    const top = (norm.getY(i) + norm.getY(i + 1) + norm.getY(i + 2)) / 3 > .58;
    const kind = red && top ? 'red' : 'stone';
    const t = kind === 'red' ? redTile : tile, span = (kind === 'red' ? .9375 : .62) * density;
    const color = kind === 'red' ? new THREE.Color(.94, .94, .94) : shade;
    const list = lists[kind];
    for (let j = i; j < i + 3; j++) {
      list.p.push(pos.getX(j), pos.getY(j), pos.getZ(j));
      list.n.push(norm.getX(j), norm.getY(j), norm.getZ(j));
      list.uv.push((t % 4 + uv.getX(j) * span + .03125) / 4, 1 - (Math.floor(t / 4) + uv.getY(j) * span + .03125) / 4);
      list.c.push(color.r, color.g, color.b);
    }
  }
  g.dispose();
  const group = new THREE.Group();
  for (const [kind, list] of Object.entries(lists)) {
    if (!list.p.length) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(list.p, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(list.n, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(list.uv, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(list.c, 3));
    const mesh = new THREE.Mesh(geometry, materials[kind]);
    prepareReferenceFaces(mesh);
    group.add(mesh);
  }
  return group;
}

function flat(w, h, d, color, opacity = 1) {
  const material = new THREE.MeshBasicMaterial({color, toneMapped: false, transparent: opacity < 1, opacity});
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}

function softDisc(size, alpha) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d'), grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, `rgba(0,0,0,${alpha})`); grad.addColorStop(.6, `rgba(0,0,0,${alpha * .55})`); grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false, toneMapped: false}));
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

// The ember Chip carries to the gate: a hot pixel core, a glow and a few rising sparks.
function ember() {
  const group = new THREE.Group();
  const core = flat(.11, .11, .11, 0xff2a14);
  const hot = flat(.062, .062, .114, 0xffb08a);
  group.add(core, hot);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d'), grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,60,30,.55)'); grad.addColorStop(1, 'rgba(255,20,10,0)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({map: new THREE.CanvasTexture(canvas), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false}));
  glow.scale.setScalar(.42);
  group.add(glow);
  for (const [x, y, s, c] of [[-.03, .12, .03, 0xff5a3c], [.04, .19, .022, 0xff7a52], [-.01, .26, .016, 0xffb283]]) {
    const spark = flat(s, s, s, c);
    spark.position.set(x, y, 0);
    group.add(spark);
  }
  return group;
}

export function createChip(stoneMap) {
  const materials = {
    // Chip's faces are mostly vertical, which the island's top-down key light leaves dim; lift them so the figure reads.
    stone: referenceMaterial({map: stoneMap, color: new THREE.Color(1, 1, 1).multiplyScalar(2.1)}),
    red: referenceMaterial({map: stoneMap.userData.red || stoneMap, emissive: 0xff0905, emissiveIntensity: .16})
  };
  materials.stone.userData.kind = 'stone';
  materials.red.userData.kind = 'red';

  const group = new THREE.Group();           // stands on the ground; shadow and dust stay here
  const root = new THREE.Group();            // lifts off the ground when hopping
  const body = new THREE.Group();            // squashes and leans from the top of the legs
  group.add(root);
  root.add(body);

  const legs = [-1, 1].map((side, i) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * .085, LEG_H, 0);
    const leg = stone(.085, LEG_H, .095, {seed: 31 + i, chip: .012, materials});
    leg.position.y = -LEG_H / 2;
    const foot = stone(.1, .035, .13, {seed: 41 + i, chip: .01, materials});
    foot.position.set(0, -LEG_H + .0175, .02);
    pivot.add(leg, foot);
    root.add(pivot);
    return pivot;
  });

  let y = 0;
  for (const [[w, h, d], red, seed] of [[LOWER, false, 7], [MID, false, 11], [MAIN, false, 17], [CAP, true, 23]]) {
    const block = stone(w, h, d, {red, seed, chip: Math.min(.03, w * .07), materials});
    block.position.y = y + h / 2;
    body.add(block);
    y += h;
  }
  // A small red stone sticking up off-centre: Chip's tuft, and the bit that wobbles behind every hop.
  const tuft = new THREE.Group();
  tuft.position.set(.1, TOP_Y, -.04);
  const tuftStone = stone(.085, .085, .085, {red: true, seed: 53, chip: .012, materials});
  tuftStone.position.y = .036;
  tuft.add(tuftStone);
  body.add(tuft);

  // Face: big ivory pixel eyes (open with pupil and shine, or a happy "^"), dark stone brows that tilt and lift on
  // their own, a red blush and a pixel mouth with a few shapes.
  const front = MAIN[2] / 2 + .004;
  const eyes = [-1, 1].map(side => {
    const eye = new THREE.Group();
    eye.position.set(side * .1, MAIN_Y + .035, front);
    const open = new THREE.Group();
    const white = flat(.092, .112, .01, IVORY);
    const pupil = flat(.06, .074, .01, INK);
    pupil.position.z = .004;
    const shine = flat(.018, .018, .01, IVORY);
    shine.position.z = .008;
    open.add(white, pupil, shine);
    const happy = new THREE.Group();          // a pixel caret: the eye squeezed shut with joy
    for (const s of [-1, 1]) {
      const stroke = flat(.058, .024, .01, IVORY);
      stroke.position.set(s * .021, 0, 0);
      stroke.rotation.z = -s * .6;
      happy.add(stroke);
    }
    happy.position.y = -.004;
    const brow = flat(.078, .02, .012, INK);
    brow.userData.side = side;
    eye.add(open, happy, brow);
    eye.userData = {open, happy, pupil, shine, brow, side};
    body.add(eye);
    return eye;
  });
  for (const side of [-1, 1]) {
    const blush = flat(.04, .02, .01, BLUSH, .75);
    blush.position.set(side * .16, MAIN_Y - .045, front);
    body.add(blush);
  }
  const mouth = new THREE.Group();
  mouth.position.set(0, MAIN_Y - .07, front);
  const shapes = {
    small: [[0, 0, .03, .013]],
    flat: [[0, 0, .056, .013]],
    smile: [[0, 0, .034, .014], [-.024, .012, .014, .014], [.024, .012, .014, .014]],
    o: [[0, 0, .032, .038]],
    grin: [[0, 0, .066, .04], [0, -.012, .034, .014, BLUSH]]
  };
  const mouths = {};
  for (const [name, blocks] of Object.entries(shapes)) {
    const shape = new THREE.Group();
    blocks.forEach(([x, y, w, h, color = INK], i) => {
      const block = flat(w, h, .01, color);
      block.position.set(x, y, i * .002);
      shape.add(block);
    });
    mouth.add(shape);
    mouths[name] = shape;
  }
  mouth.userData.shapes = mouths;
  body.add(mouth);

  // Chunky arms ending in mitten hands with a thumb, so Chip can steady, grab and carry.
  const arms = [-1, 1].map((side, i) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * (MAIN[0] / 2 + .046), MAIN_Y + .055, 0);
    const upper = stone(.088, .12, .09, {seed: 61 + i, chip: .012, materials});
    upper.position.y = -.06;
    const hand = new THREE.Group();
    hand.position.y = -.152;
    const mitten = stone(.104, .082, .106, {seed: 71 + i, chip: .014, materials});
    const thumb = stone(.036, .042, .042, {seed: 81 + i, chip: .006, materials});
    thumb.position.set(-side * .05, .006, .03);
    hand.add(mitten, thumb);
    pivot.add(upper, hand);
    pivot.userData.side = side;
    body.add(pivot);
    return pivot;
  });

  const carried = ember();
  carried.position.set(-.06, TOP_Y + .058, .02);
  body.add(carried);

  const shadow = softDisc(.62, .55);
  shadow.position.y = .003;
  group.add(shadow);

  const dust = new THREE.Group();
  const dustRand = rng(5);
  for (let i = 0; i < 9; i++) {
    const s = .018 + dustRand() * .026, a = i / 9 * Math.PI * 2 + dustRand() * .3, r = .27 + dustRand() * .12;
    const puff = flat(s, s, s, dustRand() < .5 ? 0x3a3936 : 0x2a2a28);
    puff.position.set(Math.cos(a) * r, s / 2 + dustRand() * .06, Math.sin(a) * r * .8);
    dust.add(puff);
  }
  group.add(dust);

  const chip = {group, root, body, legs, arms, eyes, mouth, tuft, ember: carried, shadow, dust, height: LEG_H + TOP_Y};
  poseChip(chip);
  return chip;
}

// Pose parameters, all optional: squash (1 = rest, <1 squashed, >1 stretched), lift (height off the ground), lean
// (forward, radians), tilt (head tilt, radians), arms (raise outward, radians; one number or [left, right]), armsBack
// (swing back; number or pair), legs (1 = straight, <1 tucked), look ([x, y] pupils, -1..1), blink (0 open, 1 shut),
// eyes ('open' or 'happy'), brows ({tilt: [l, r], raise: [l, r]}; tilt > 0 lifts the inner ends, worried; < 0 lowers
// them, determined), mouth (false or 'small', 'flat', 'smile', 'o', 'grin'), tuft (extra tilt), ember, dust.
export function poseChip(chip, pose = {}) {
  const p = {squash: 1, lift: 0, lean: 0, tilt: 0, arms: .12, armsBack: 0, legs: 1, look: [0, 0], blink: 0, eyes: 'open',
    brows: {}, mouth: false, tuft: 0, ember: false, dust: false, ...pose};
  const pair = v => Array.isArray(v) ? v : [v, v];
  const across = 1 / Math.sqrt(p.squash);
  chip.root.position.y = p.lift;
  chip.body.position.y = LEG_H * p.legs;
  chip.body.scale.set(across, p.squash, across);
  chip.body.rotation.set(p.lean, 0, p.tilt);
  for (const leg of chip.legs) { leg.position.y = LEG_H * p.legs; leg.scale.y = p.legs; }
  const arms = pair(p.arms), back = pair(p.armsBack);
  chip.arms.forEach((arm, i) => { arm.rotation.z = arm.userData.side * arms[i]; arm.rotation.x = back[i]; });
  const tilt = pair(p.brows.tilt ?? 0), raise = pair(p.brows.raise ?? 0);
  chip.eyes.forEach((eye, i) => {
    const {open, happy, pupil, shine, brow, side} = eye.userData;
    const isHappy = p.eyes === 'happy';
    open.visible = !isHappy;
    happy.visible = isHappy;
    open.scale.y = Math.max(.12, 1 - p.blink);
    pupil.position.x = p.look[0] * .012;
    pupil.position.y = p.look[1] * .014 - .004;
    shine.position.set(pupil.position.x - .015, pupil.position.y + .021, .008);
    brow.position.set(side * -.004, .078 + raise[i] - (isHappy ? .012 : p.blink * .03), .002);
    brow.rotation.z = -side * tilt[i];
  });
  for (const [name, shape] of Object.entries(chip.mouth.userData.shapes)) shape.visible = p.mouth === name;
  chip.tuft.rotation.z = -.22 + p.tuft;
  chip.ember.visible = p.ember;
  chip.dust.visible = p.dust;
  const s = THREE.MathUtils.clamp(1 - p.lift * 1.1, .45, 1);
  chip.shadow.scale.setScalar(s);
  chip.shadow.material.opacity = s;
}

// Body poses: each carries a face, so a pose reads as a moment, not just a shape.
export const CHIP_POSES = {
  idle: {look: [.35, .15], tilt: .05, brows: {raise: [0, .016]}, mouth: 'small'},
  ready: {squash: .82, legs: .72, lean: .16, arms: .35, armsBack: .75, look: [0, -.45], brows: {tilt: -.4, raise: -.008}, mouth: 'flat', tuft: .08},
  hop: {squash: 1.14, lift: .34, legs: .6, lean: -.06, arms: .95, armsBack: .65, look: [0, .7], brows: {raise: .026}, mouth: 'grin', tuft: -.4},
  land: {squash: .76, legs: .82, arms: 1.15, blink: .7, brows: {tilt: .35}, mouth: 'o', tuft: .42, dust: true},
  carry: {squash: .97, tilt: -.05, arms: [3.72, .95], look: [-.5, .9], brows: {tilt: .3, raise: .01}, mouth: 'smile', ember: true}
};

// Face-only expressions, layered on the idle body.
export const CHIP_FACES = {
  curious: {look: [.7, .25], tilt: .1, brows: {raise: [0, .026]}, mouth: 'small'},
  determined: {look: [0, -.2], brows: {tilt: -.5, raise: -.01}, mouth: 'flat'},
  joy: {eyes: 'happy', brows: {raise: .024}, mouth: 'grin'},
  oof: {blink: .72, brows: {tilt: .45}, mouth: 'o'},
  proud: {eyes: 'happy', tilt: -.08, brows: {tilt: -.12, raise: .006}, mouth: 'smile'},
  sleepy: {blink: .82, tilt: .12, brows: {raise: -.012}, mouth: 'small'}
};
