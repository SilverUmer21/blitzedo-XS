import * as THREE from '../island/assets/vendor/three.module.js';
import { createKit } from './kit.js';
import { createLights } from './shading.js';
import { createChip, poseChip } from '../island/chip.js';
import { VIEW_DIR } from './stage.js';

// Contact: a small-brick crimson mailbox on a dark stone post, an ivory envelope tilted out of its mouth, standing among
// broken columns and carefully placed rubble (DESIGN.md, Contact; design/concepts/desktop-pages-approved-direction.png).
//
// Like the concept, everything is made of small cubes: hundreds of them, each a chipped, bevelled block with its own
// slight size, offset and tone, so every surface has relief and dark gaps. The light is low and dark: a dimmed key, the
// box's own crimson glow spilling onto the post and the stones round its foot, and the whole diorama fading to black toward
// its edges, so it sits in the page's darkness rather than on a floor.
//
// Units match the island (a stair rise is .36). The box's long side runs along X, its mouth faces +X, its arched profile is in
// the Z-Y plane.

export const MAILBOX = {post: {h: 2.45}, box: {L: 1.86, W: 1.04, hRect: .5, y0: 2.45}};

export function buildMailbox({maps, stoneMap}) {
  const {box, post} = MAILBOX;
  const R = box.W / 2, yc = box.y0 + box.hRect;
  const mouth = new THREE.Vector3(box.L / 2 + .3, yc + .05, .05);
  const lights = createLights([
    {at: [mouth.x, mouth.y, mouth.z], color: [4.2, .015, .006], radius: 3.2},          // the box's glow, spilling forward
    {at: [.15, .45, .55], color: [1.6, .006, .003], radius: 1.7},                      // red cubes lit at the post's foot
    {at: [-2.9, 2.4, -1.2], color: [.8, .003, .002], radius: 2.8}                      // a far rim on the left columns
  ]);
  const kit = createKit({maps, lights, seed: 4417, keyLight: .85});
  const {rand} = kit;
  // Darker toward the diorama's edge, so it fades into the page (the concept's haze, in this site's black).
  const fade = (x, z, k = 1) => new THREE.Color(0x82817d).multiplyScalar(k * Math.max(.2, 1.05 - Math.hypot(x / 3.6, z / 2.9) * .8));
  const cube = (x, y, z, s, o = {}) => kit.slab(x, y, z, s, s, s, {chip: s * .09, relief: false, notch: 0, ...o});

  /* ---------- the post: courses of small stone cubes, three by three, a few red-lit near the top ---------- */
  const pc = .15;
  for (let j = 0; j * pc < post.h; j++) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    if (a === 0 && b === 0) continue;                                      // hidden inside
    const y = (j + .5) * pc, x = a * pc + (rand() - .5) * .012, z = b * pc + (rand() - .5) * .012;
    const lit = j > 10 && (b === 1 || a === 1) && rand() < (j - 10) / 16;  // the box's light catching the upper post
    cube(x, y, z, pc - .012 - rand() * .01, {mat: lit ? 'crimson' : 'stone', tint: .7, color: fade(x, z, .95)});
  }
  // a bracket under the box
  for (let a = -2; a <= 2; a++) for (const b of [-1, 0, 1]) cube(a * .14, post.h - .05, b * .14, .13, {color: fade(0, 0, .9)});

  /* ---------- the box: a shell of small crimson cubes round a stepped arch, open at the +X end ---------- */
  const c = box.L / 15;                                                    // 15 cubes along the length
  const nz = Math.round(box.W / c), ny = Math.round((box.hRect + R) / c);
  const inside = (zc, yr) => {                                             // profile test in cube units (zc centred, yr from the floor)
    const z = zc * c, y = box.y0 + yr * c;
    return Math.abs(z) <= R && (y <= yc || z * z + (y - yc) ** 2 <= R * R);
  };
  const cells = [];
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) {
    const zc = k - (nz - 1) / 2, yr = j + .5;
    if (!inside(zc, yr)) continue;
    let edge = j === 0;
    for (const [dz, dy] of [[1, 0], [-1, 0], [0, 1], [1, 1], [-1, 1]]) if (!inside(zc + dz, yr + dy)) edge = true;   // diagonals too: no holes at the arch's steps
    cells.push({zc, yr, edge});
  }
  for (let i = 0; i < 15; i++) for (const {zc, yr, edge} of cells) {
    const back = i === 0, front = i === 14;
    if (!edge && !back) continue;                                          // only the shell and the closed back
    const x = -box.L / 2 + (i + .5) * c, y = box.y0 + yr * c, z = zc * c;
    // each cube stands a little proud or sunk along the surface, and varies in size and tone, as in the concept
    const out = (rand() - .35) * .02;
    const nzv = Math.abs(zc) * c > R - c * 1.2 ? Math.sign(zc) : 0, nyv = yr * c > box.hRect ? 1 : 0;
    const tint = (.78 + rand() * .32) * (rand() < .06 ? .7 : 1) * (front ? 1.12 : 1);
    cube(x + (front ? .015 : 0), y + nyv * out, z + nzv * out, c - .01 - rand() * .008, {mat: 'crimson', tint});
  }
  // inside: a dark warm liner so the open mouth reads deep
  const liner = 0x150605;
  const flat = {chip: 0, relief: false, notch: 0, mat: 'paint'};
  kit.slab(0, box.y0 + c + .01, 0, box.L - c * 2, .02, box.W - c * 2.2, {...flat, color: liner});
  kit.slab(-box.L / 2 + c + .02, (box.y0 + yc) / 2 + .05, 0, .02, box.hRect, box.W - c * 2.2, {...flat, color: liner});
  kit.slab(0, (box.y0 + yc) / 2 + .05, -R + c + .02, box.L - c * 2, box.hRect, .02, {...flat, color: liner});

  /* ---------- the envelope: ivory paper with a little thickness, the flap's fold, a red seal ---------- */
  const envKit = createKit({maps, lights, seed: 77, keyLight: .9, cull: false});   // it turns when it is posted, so keep all its faces
  envKit.slab(0, 0, 0, .92, .035, .62, {...flat, color: 0xe7e0d2});
  envKit.slab(-.02, .02, 0, .86, .006, .56, {...flat, color: 0xe6dfd0});                 // the back sheet, a shade darker
  for (const s of [-1, 1]) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(.2, .026, s * .145), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s * .62, 0)), new THREE.Vector3(1, 1, 1));
    envKit.slab(0, 0, 0, .5, .006, .02, {...flat, color: 0x958f84, matrix: m});
  }
  envKit.slab(.41, .03, 0, .11, .03, .11, {chip: .01, relief: false, notch: 0, mat: 'crimson', tint: 1.2});
  const envelope = envKit.build();
  const envRest = {pos: new THREE.Vector3(box.L / 2 + .05, box.y0 + .3, .03), rot: new THREE.Euler(.1, -.26, .34)};
  envelope.position.copy(envRest.pos);
  envelope.rotation.copy(envRest.rot);

  /* ---------- ground: a field of small stone cubes at uneven heights, thinning out into the dark ---------- */
  const gc = .2;
  for (let ix = -18; ix <= 18; ix++) for (let iz = -15; iz <= 15; iz++) {
    const x = ix * gc, z = iz * gc;
    const r = Math.hypot(x / 3.6, z / 2.9);
    if (r > 1 || rand() > 1.35 - r * 1.25) continue;
    if (Math.abs(x) < .26 && Math.abs(z) < .26) continue;                 // the post
    const top = [0, 0, 0, .04, .04, .08][Math.floor(rand() * 6)] - r * .12;
    const h = gc * (.9 + rand() * .3);
    const s = gc - .016 - rand() * .02;
    kit.slab(x + (rand() - .5) * .02, top - h / 2, z + (rand() - .5) * .02, s, h, s, {chip: .02, relief: false, notch: 0, color: fade(x, z)});
  }

  /* ---------- broken columns: built of small cubes, ragged at the top, cubes missing and fallen ---------- */
  const columns = [
    // x, z, cubes across, height, red cap
    [-2.3, -.15, 4, 2.0, true], [-1.55, -1.35, 3, 1.25, false], [-2.6, .85, 3, .75, false], [-1.95, -.95, 2, .55, false],
    [2.1, -1.2, 4, 1.55, false], [2.7, -.2, 3, 1.05, true], [1.55, -1.9, 2, .7, false],
    [-1.1, 1.45, 3, .55, false], [1.3, 1.4, 3, .42, false], [2.35, .9, 2, .36, false]
  ];
  const sc = .17;
  for (const [cx, cz, n, h, cap] of columns) {
    const heights = [];
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) heights.push(h - (rand() < .55 ? rand() * .45 : 0));
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const hh = heights[a * n + b], x = cx + (a - (n - 1) / 2) * sc, z = cz + (b - (n - 1) / 2) * sc;
      const shell = a === 0 || b === 0 || a === n - 1 || b === n - 1;
      for (let j = 0; (j + 1) * sc <= hh + .01; j++) {
        const topOne = (j + 2) * sc > hh + .01;
        if (!shell && !topOne) continue;                                   // hidden inside
        if (j > 1 && rand() < .05) continue;                               // a cube fallen out
        const jx = (rand() - .5) * .018, jz = (rand() - .5) * .018;
        cube(x + jx, (j + .5) * sc, z + jz, sc - .014 - rand() * .012, {color: fade(x, z, .95 + rand() * .1)});
      }
    }
    if (cap) cube(cx + sc * .3, h + sc * .5, cz, sc - .01, {mat: 'crimson', tint: 1.1});
    // fallen cubes at the foot
    for (let i = 0; i < 4 + n; i++) {
      const s = sc * (.6 + rand() * .45), a = rand() * Math.PI * 2, d = n * sc * .5 + .1 + rand() * .35;
      cube(cx + Math.cos(a) * d, s / 2, cz + Math.sin(a) * d * .8, s, {color: fade(cx, cz, .9)});
    }
  }

  /* ---------- rubble: small chipped cubes in clusters, and a few red-lit ones near the post ---------- */
  const CHIP_AT = [.95, .62];
  const clusters = [[-.95, .8, 9], [1.75, .75, 7], [-1.6, -.4, 6], [1.7, .1, 6], [.3, 1.6, 6], [-.4, -1.2, 5], [2.9, .4, 4], [-2.9, -.2, 4]];
  for (const [cx, cz, count] of clusters) for (let i = 0; i < count * 2; i++) {
    const s = .06 + rand() * rand() * .16, x = cx + (rand() - .5) * .9, z = cz + (rand() - .5) * .8;
    if (Math.hypot(x - CHIP_AT[0], z - CHIP_AT[1]) < .55) continue;        // keep Chip's spot clear
    cube(x, .06 + s / 2 + (rand() < .25 ? s : 0), z, s, {color: fade(x, z, 1.05)});
  }
  for (const [x, z, s] of [[.45, .62, .14], [-.48, .55, .11], [.62, -.38, .09], [.2, .98, .1], [-.7, -.18, .12], [1.45, .1, .09], [-.2, .35, .07], [.3, -.42, .07]])
    cube(x, .08 + s / 2, z, s, {mat: 'crimson', tint: 1.15});

  const group = kit.build();
  group.add(envelope);

  /* ---------- Chip, waiting by the post for a letter ---------- */
  const facing = Math.atan2(VIEW_DIR.x, VIEW_DIR.z);
  const chip = stoneMap ? createChip(stoneMap) : null;
  if (chip) {
    chip.group.scale.setScalar(1.15);
    chip.group.position.set(CHIP_AT[0], .06, CHIP_AT[1]);
    chip.group.rotation.y = facing - .55;          // turned toward the post, still showing its face
    poseChip(chip, {look: [-.6, .85], tilt: -.06, brows: {raise: .012}, mouth: 'small'});
    group.add(chip.group);
  }
  let clock = 0, deliveredAt = -100;
  const target = new THREE.Vector3(.05, 1.55, 0);
  return {
    group, lights, target, viewHeight: 5.3, mouth,
    chip, envelope,
    // After a confirmed send: the envelope settles into the box, the box flares, Chip celebrates. Then a fresh one appears.
    deliver() { deliveredAt = clock; },
    animate(time, motion) {
      clock = time;
      lights.breath.value = motion ? Math.sin(time * .82) * .06 : 0;
      const since = time - deliveredAt;
      if (since >= 0 && since < 4.2) {
        const t = Math.min(1, since / .9), e = t * t * (3 - 2 * t);
        envelope.position.set(envRest.pos.x - e * 1.05, envRest.pos.y - e * .1, envRest.pos.z);
        envelope.rotation.set(envRest.rot.x * (1 - e), envRest.rot.y * (1 - e), envRest.rot.z * (1 - e));
        envelope.visible = since < 1.1 || since > 3.4;
        if (since > 3.4) { const k = Math.min(1, (since - 3.4) / .8); envelope.position.copy(envRest.pos); envelope.rotation.copy(envRest.rot); envelope.scale.setScalar(k); }
        lights.breath.value += since > .8 && since < 2 ? Math.sin((since - .8) / 1.2 * Math.PI) * .9 : 0;
        if (chip) {
          const hop = since > .9 && since < 1.6 ? Math.sin((since - .9) / .7 * Math.PI) : 0;
          poseChip(chip, {lift: hop * .3, squash: 1 + hop * .1, arms: .4 + hop * .8, eyes: 'happy', mouth: 'grin', brows: {raise: .024}});
        }
        return;
      }
      envelope.scale.setScalar(1);
      if (!chip || !motion) return;
      // a quiet idle: breathing, a blink every few seconds, and now and then a glance from the box to the visitor
      const cycle = time % 9, toViewer = cycle > 5.6 && cycle < 7.4;
      const blink = (time % 3.7) > 3.58 ? 1 : 0;
      poseChip(chip, {squash: 1 + Math.sin(time * 2.2) * .012, look: toViewer ? [.05, .05] : [-.6, .85], tilt: toViewer ? .04 : -.06,
        blink, brows: {raise: toViewer ? .018 : .012}, mouth: toViewer ? 'smile' : 'small'});
    }
  };
}
