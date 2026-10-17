import * as THREE from '../island/assets/vendor/three.module.js';
import { createKit } from './kit.js';
import { createLights } from './shading.js';
import { createChip, poseChip } from '../island/chip.js';
import { VIEW_DIR } from './stage.js';

// Studio: a wooden workbench holding an unfinished stone b, loose blocks, tools and a red technical drawing of the b; Chip
// sits on the bench's edge (DESIGN.md, Studio). Built with the island's kit, lit by the drawing's red glow.
// Units match the island. The bench's long side runs along X; its front faces +Z.

const H = 1.45;                       // bench top
const TOP = {w: 4.1, d: 2.05};

export function buildWorkshop({maps, stoneMap}) {
  const drawing = new THREE.Vector3(.95, H + .02, .32);
  const lights = createLights([
    {at: [drawing.x, H + .55, drawing.z + .1], color: [3.6, .012, .006], radius: 2.8},     // the drawing's glow
    {at: [-.2, H + 1.9, .7], color: [.7, .003, .001], radius: 1.8},                    // red caught on the b's crown
    {at: [-3.4, 2.4, -1.4], color: [.9, .003, .002], radius: 3.2}                         // a far rim on the left
  ]);
  const kit = createKit({maps, lights, seed: 2213, keyLight: .85});
  // darker toward the diorama's edge, so it fades into the page, as on the contact scene
  const fade = (x, z, k = 1) => new THREE.Color(0x82817d).multiplyScalar(k * Math.max(.2, 1.05 - Math.hypot(x / 3.9, z / 2.6) * .8));
  const cubeAt = (x, y, z, s, o = {}) => kit.slab(x, y, z, s, s, s, {chip: s * .09, relief: false, notch: 0, ...o});
  const {rand} = kit;
  const wood = (x, y, z, w, h, d, o = {}) => kit.slab(x, y, z, w, h, d, {mat: 'wood', chip: .012, relief: false, ...o});

  /* ---------- the bench ---------- */
  // legs: stacked square timbers
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (TOP.w / 2 - .32), z = sz * (TOP.d / 2 - .26);
    const parts = 3, ph = (H - .2) / parts;
    for (let i = 0; i < parts; i++) wood(x + (rand() - .5) * .01, (i + .5) * ph, z, .28, ph - .012, .28);
  }
  // stretchers low between the legs, and an apron under the top
  for (const sz of [-1, 1]) wood(0, .36, sz * (TOP.d / 2 - .26), TOP.w - .9, .14, .12);
  for (const sx of [-1, 1]) wood(sx * (TOP.w / 2 - .32), .36, 0, .12, .14, TOP.d - .7);
  for (const sz of [-1, 1]) wood(0, H - .25, sz * (TOP.d / 2 - .22), TOP.w - .5, .16, .1);
  // the top: planks along the length, each a little different, a few in two pieces
  const planks = 7, pw = TOP.d / planks;
  for (let i = 0; i < planks; i++) {
    const z = -TOP.d / 2 + (i + .5) * pw, y = H - .08 + (rand() - .5) * .012;
    const off = (rand() - .5) * .14;
    if (rand() < .35) {
      const cut = (rand() - .5) * 1.4;
      wood((-TOP.w / 2 + off + cut) / 2 - .005, y, z, cut - (-TOP.w / 2 + off) - .02, .16, pw - .025);
      wood((TOP.w / 2 + off + cut) / 2 + .005, y, z, TOP.w / 2 + off - cut - .02, .16, pw - .025);
    } else wood(off, y, z, TOP.w, .16, pw - .025);
  }

  /* ---------- the unfinished b: charcoal cubes, some red-lit, a chunk not yet built ---------- */
  const c = .23, g = .012;                                         // cube size and gap
  const bx = -1.5, bz = -.62;                                      // the b's front-left corner on the bench
  const bTone = new THREE.Color(0x82817d).multiplyScalar(.72);
  const cube = (i, j, k, o = {}) => {
    const s = c - g - rand() * .012, jx = (rand() - .5) * .014, jz = (rand() - .5) * .014;
    if (o.mat === 'red') o = {...o, mat: 'crimson', tint: 1.05 + rand() * .15};
    cubeAt(bx + (i + .5) * c + jx, H + (j + .5) * c, bz + (k + .5) * c + jz, s, {color: bTone.clone().multiplyScalar(.85 + rand() * .3), ...o});
  };
  // stem: 2 x 2 cubes, 10 high; bowl: a D 5 wide and 6 high to its right with an arched opening, 2 deep
  for (let j = 0; j < 10; j++) for (let i = 0; i < 2; i++) for (let k = 0; k < 2; k++)
    cube(i, j, k, {mat: j === 9 && (i + k) % 2 === 0 ? 'red' : 'stone'});
  const bowl = (i, j) => {
    const x = i - 2.5, y = j + .5;                                 // columns 2..6 (centre 4.5 - 2 = 2.5 offset), rows 0..5
    const outer = x >= -.5 && x <= 4.5 && y <= 6 && (y < 3.4 || (x - 1.6) ** 2 + (y - 3.4) ** 2 <= 2.95 * 2.95 || x < .5);
    const hole = x >= .5 && x <= 2.5 && (y < 2.6 || (x - 1.5) ** 2 + (y - 2.6) ** 2 <= 1.05 * 1.05);
    return outer && !hole;
  };
  for (let j = 0; j < 6; j++) for (let i = 2; i < 7; i++) for (let k = 0; k < 2; k++) {
    if (!bowl(i, j)) continue;
    if (j >= 4 && i >= 6) continue;                                // unfinished: the bowl's top-right corner is not built yet
    cube(i, j, k, {mat: j === 5 && rand() < .7 ? 'red' : 'stone'});
  }
  // the missing cubes, set down nearby, and one waiting on top
  cube(7.3, 0, 1.6, {mat: 'red'}); cube(8.4, 0, .4); cube(7.8, 1, 1.0);
  cube(5.2, 6, .5, {mat: 'red'});

  /* ---------- the drawing: a red sheet with the b drawn on it in lighter lines ---------- */
  const sheet = new THREE.Matrix4().compose(drawing, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -.14, 0)), new THREE.Vector3(1, 1, 1));
  const flat = {chip: 0, relief: false, notch: 0, mat: 'paint'};
  const onSheet = (x, z, w, d, color, rot = 0, y = .012) => kit.slab(0, 0, 0, w, .006, d, {...flat, color,
    matrix: sheet.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3(1, 1, 1)))});
  kit.slab(0, 0, 0, 1.45, .012, .95, {...flat, color: 0xb3150f, matrix: sheet});
  const ink = 0xff8a72;
  // a border, a title block, and the b: stem and bowl in outline
  for (const [x, z, w, d] of [[0, -.42, 1.33, .014], [0, .42, 1.33, .014], [-.66, 0, .014, .84], [.66, 0, .014, .84], [.45, .33, .4, .012], [.25, .375, .012, .09]])
    onSheet(x, z, w, d, ink);
  onSheet(-.33, -.02, .012, .62, ink); onSheet(-.19, -.02, .012, .62, ink); onSheet(-.26, -.33, .14, .012, ink);
  for (let n = 0; n < 14; n++) {                                   // the bowl: a ring of short segments
    const a = n / 14 * Math.PI * 2, r = .2;
    onSheet(.02 + Math.cos(a) * r, .1 + Math.sin(a) * r, .1, .012, ink, -a + Math.PI / 2);
  }
  onSheet(.02, .1, .012, .14, ink);                                // a centre line
  // a pencil and a ruler on the sheet
  kit.slab(0, 0, 0, .5, .03, .03, {...flat, color: 0xb9ad97, matrix: sheet.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(-.2, .03, .5), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, .3, 0)), new THREE.Vector3(1, 1, 1)))});
  kit.slab(0, 0, 0, .9, .015, .07, {...flat, color: 0xa89c86, matrix: sheet.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(.15, .02, -.56), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)))});

  /* ---------- tools: a hammer and a chisel beside the drawing ---------- */
  const tool = new THREE.Matrix4().compose(new THREE.Vector3(1.55, H + .045, -.45), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, .5, 0)), new THREE.Vector3(1, 1, 1));
  kit.slab(0, 0, 0, .62, .055, .06, {mat: 'wood', chip: 0, relief: false, notch: 0, matrix: tool});
  kit.slab(0, 0, 0, .12, .1, .24, {chip: .008, relief: false, notch: 0, matrix: tool.clone().multiply(new THREE.Matrix4().makeTranslation(.31, .02, 0))});
  const chisel = new THREE.Matrix4().compose(new THREE.Vector3(1.45, H + .03, .95), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -.35, 0)), new THREE.Vector3(1, 1, 1));
  kit.slab(0, 0, 0, .22, .05, .05, {mat: 'wood', chip: 0, relief: false, notch: 0, matrix: chisel});
  kit.slab(0, 0, 0, .2, .025, .045, {mat: 'paint', color: 0x8c8a85, chip: 0, relief: false, notch: 0, matrix: chisel.clone().multiply(new THREE.Matrix4().makeTranslation(.2, 0, 0))});

  /* ---------- loose blocks on the bench and the floor ---------- */
  for (const [x, z, s, m] of [[.2, -.62, .18, 'stone'], [.42, -.7, .14, 'red'], [-.1, .62, .16, 'stone'], [1.75, .2, .15, 'stone'], [-1.65, .45, .13, 'red']])
    cubeAt(x, H + s / 2, z, s, {mat: m === 'red' ? 'crimson' : 'stone', tint: 1.1, color: fade(x, z, .85)});
  for (const [x, z, s, m] of [[-2.3, 1.3, .34, 'stone'], [-2.0, 1.55, .22, 'red'], [-2.55, .9, .2, 'stone'], [2.3, 1.25, .3, 'stone'], [2.05, 1.6, .2, 'glow'],
    [2.6, .7, .18, 'stone'], [.4, 1.55, .16, 'stone'], [-.6, 1.65, .12, 'stone'], [1.2, 1.7, .12, 'red']]) {
    cubeAt(x, .06 + s / 2, z, s, {mat: m === 'glow' || m === 'red' ? 'crimson' : 'stone', tint: 1.1, color: fade(x, z)});
  }
  // a split cube, half red, as in the concept
  kit.slab(2.75, .23, 1.05, .17, .34, .34, {chip: .012, color: fade(2.75, 1.05)}); kit.slab(2.93, .23, 1.05, .17, .34, .34, {chip: .012, mat: 'crimson', tint: 1.1});

  /* ---------- the floor: a field of small stone cubes at uneven heights, thinning out into the dark ---------- */
  const gc = .2;
  for (let ix = -20; ix <= 20; ix++) for (let iz = -13; iz <= 13; iz++) {
    const x = ix * gc, z = iz * gc;
    const r = Math.hypot(x / 3.9, z / 2.6);
    if (r > 1 || rand() > 1.35 - r * 1.25) continue;
    let legs = false;                                                    // leave room for the bench's legs
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) if (Math.abs(x - sx * (TOP.w / 2 - .32)) < .22 && Math.abs(z - sz * (TOP.d / 2 - .26)) < .22) legs = true;
    if (legs) continue;
    const top = [0, 0, 0, .03, .03, .06][Math.floor(rand() * 6)] - r * .1;
    const h = gc * (.9 + rand() * .3), sz2 = gc - .016 - rand() * .02;
    kit.slab(x + (rand() - .5) * .02, top - h / 2, z + (rand() - .5) * .02, sz2, h, sz2, {chip: .02, relief: false, notch: 0, color: fade(x, z)});
  }
  // a few small rubble cubes and chips of stone around the bench, as if knocked off the b
  for (let i = 0; i < 26; i++) {
    const s2 = .05 + rand() * rand() * .12, x = (rand() - .5) * 5.4, z = .6 + rand() * 1.6;
    if (Math.abs(x) < 1.7 && z < 1.05) continue;
    cubeAt(x, .06 + s2 / 2, z, s2, {color: fade(x, z, 1.05)});
  }

  const group = kit.build();

  /* ---------- Chip, sitting on the front edge, legs over the side ---------- */
  const facing = Math.atan2(VIEW_DIR.x, VIEW_DIR.z);
  const chip = stoneMap ? createChip(stoneMap) : null;
  const S = 1.2;
  if (chip) {
    chip.group.scale.setScalar(S);
    chip.group.position.set(-.55, H - .11 * S, TOP.d / 2 - .16);
    chip.group.rotation.y = facing - .15;
    group.add(chip.group);
  }
  function pose(time) {
    if (!chip) return;
    const look = (time % 11) > 7 ? [.1, .1] : [-.8, .35];          // mostly watching the b being built, now and then the visitor
    poseChip(chip, {look, tilt: .05, arms: .2, blink: (time % 4.3) > 4.18 ? 1 : 0, brows: {raise: .012}, mouth: (time % 11) > 7 ? 'smile' : 'small'});
    chip.legs.forEach((leg, i) => { leg.rotation.x = -1.25 + Math.sin(time * 2.4 + i * Math.PI) * .22; });   // swinging legs
    chip.shadow.visible = false;
  }
  pose(0);

  return {
    group, lights, chip, target: new THREE.Vector3(.1, 1.6, .2), viewHeight: 5.5,
    animate(time, motion) {
      lights.breath.value = motion ? Math.sin(time * 1.1) * .05 : 0;
      if (motion) pose(time);
    }
  };
}
