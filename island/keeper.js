import * as THREE from './assets/vendor/three.module.js';
import { createChip, createEmber, poseChip, CHIP_FACES } from './chip.js';

// Chip, the island keeper, alive on the hero island. Its routine is the island's story:
//   squeeze out of the niche at the top of the stairs, take the ember resting there, hop down the stairs carrying it,
//   walk into the gate and toss it in. That lights the fuse: the gate rings and the pulse climbs the stairs Chip came
//   down. Then a few chores on the island (look around, sweep, sit, doze if nobody is around), and back up for the
//   ember, which has rekindled in the niche.
// Visitors can hover Chip (it waves), click it (it jumps; click again for a twirl), click the open island (it walks
// there) and hover Explore games (it turns and waves). Reduced motion shows Chip standing still by the gate.
//
// Positions are island-local, before world.js's non-uniform scale; Chip lives in a container that undoes that scale so
// it is never stretched. Behaviour is written as generators: each yields once per frame and receives the frame's dt.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TREAD = .0625;                                    // tread top above its column top (world.js stairColumn)
const GROUND = .036;                                    // top of the island's capstones
const PORCH = .5275;                                    // top of the red floor tiles in front of the gate
// Where Chip stands at the top, in front of the niche; then the stair treads going down, then the porch.
const TOP = V(-1.62, 4.14 + TREAD, .8);
const NICHE = V(-1.62, 4.27, .52);
const STAIRS_DOWN = [
  TOP,
  ...[1, 2, 3].map(i => V(-1.93, 4.14 - i * .36 + TREAD, .63 + i * .28 + .02)),
  ...[1, 2, 3, 4, 5, 6, 7].map(i => V(-1.93 + i * .32, 3.06 - i * .36 + TREAD, 1.46)),
  V(.58, PORCH, .84)
];
const IN_GATE = V(.61, PORCH, .22);
const DOOR = V(.61, 1.15, -.42);
const PORCH_EDGE = V(.95, PORCH, .86);
const BELOW_PORCH = V(1.08, GROUND, 1.36);
const ZONES = [{x: [.9, 2.85], z: [1.28, 1.95]}, {x: [2.62, 3.15], z: [-1.05, 1.95]}];
const FUSE_LIT = 1.95;                                  // fuse time at the moment the ember reaches the gate
const SIZE = 1.4;                                       // Chip's scale on the hero; the concept sheet's 1 reads too small

const IDLE = {mouth: 'small'};
const CARRY = {squash: .97, arms: [3.72, .95], look: [-.4, .85], brows: {tilt: .3, raise: .01}, mouth: 'smile', ember: true};
const ease = t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
const easeOut = t => 1 - (1 - t) ** 3;
const lerp = THREE.MathUtils.lerp;
const pair = v => Array.isArray(v) ? v : [v, v];
const DEFAULTS = {squash: 1, lift: 0, lean: 0, tilt: 0, arms: .12, armsBack: 0, legs: 1, blink: 0, tuft: 0, look: [0, 0]};

function mixPose(a, b, t) {
  const out = {...(t < .5 ? a : b)};
  for (const k of ['squash', 'lift', 'lean', 'tilt', 'legs', 'blink', 'tuft']) out[k] = lerp(a[k] ?? DEFAULTS[k], b[k] ?? DEFAULTS[k], t);
  for (const k of ['arms', 'armsBack']) { const x = pair(a[k] ?? DEFAULTS[k]), y = pair(b[k] ?? DEFAULTS[k]); out[k] = [lerp(x[0], y[0], t), lerp(x[1], y[1], t)]; }
  const la = a.look ?? DEFAULTS.look, lb = b.look ?? DEFAULTS.look;
  out.look = [lerp(la[0], lb[0], t), lerp(la[1], lb[1], t)];
  const ba = a.brows ?? {}, bb = b.brows ?? {};
  const ta = pair(ba.tilt ?? 0), tb = pair(bb.tilt ?? 0), ra = pair(ba.raise ?? 0), rb = pair(bb.raise ?? 0);
  out.brows = {tilt: [lerp(ta[0], tb[0], t), lerp(ta[1], tb[1], t)], raise: [lerp(ra[0], rb[0], t), lerp(ra[1], rb[1], t)]};
  return out;
}

export function createKeeper({world, stoneMap, camera, stage, still = false}) {
  const scale = world.scale.clone();
  const space = new THREE.Group();                     // undoes the island's scale
  space.scale.set(1 / scale.x, 1 / scale.y, 1 / scale.z);
  world.add(space);
  const chip = createChip(stoneMap);
  space.add(chip.group);
  const toSpace = (p, out = new THREE.Vector3()) => out.set(p.x * scale.x, p.y * scale.y, p.z * scale.z);

  // The ember resting in the niche, and the one Chip tosses into the gate.
  const nicheEmber = createEmber();
  nicheEmber.scale.setScalar(.8);
  toSpace(NICHE, nicheEmber.position);
  space.add(nicheEmber);
  const flying = createEmber();
  flying.visible = false;
  space.add(flying);

  // An invisible box around Chip for hover and click hits.
  const hitBox = new THREE.Mesh(new THREE.BoxGeometry(.62, .86, .6), new THREE.MeshBasicMaterial({visible: false}));
  hitBox.position.y = .43;
  chip.root.add(hitBox);

  const k = {
    pos: TOP.clone(), facing: 0, targetFacing: 0, pose: {...IDLE}, fuse: -100, time: 0,
    pending: null, pendingAt: 0, react: null, lastActivity: 0, interruptible: false, hovered: false,
    squeeze: 1, nicheGlow: 1
  };
  const rand = Math.random;
  const viewAngle = () => {                            // the rotation that faces the camera, in Chip's space
    const dir = camera.getWorldDirection(new THREE.Vector3()).negate();
    const inv = new THREE.Quaternion().copy(space.getWorldQuaternion(new THREE.Quaternion())).invert();
    dir.applyQuaternion(inv);
    return Math.atan2(dir.x, dir.z);
  };
  const faceTo = to => {
    const a = toSpace(k.pos), b = toSpace(to);
    if (Math.hypot(b.x - a.x, b.z - a.z) > .01) k.targetFacing = Math.atan2(b.x - a.x, b.z - a.z);
  };

  // ---- actions ------------------------------------------------------------------------------------------------
  function* wait(seconds, pose = IDLE, {breathe = true, interruptible = false} = {}) {
    let t = 0;
    while (t < seconds) {
      if (interruptible && k.pending) return;
      t += yield;
      k.pose = breathe ? {...pose, squash: (pose.squash ?? 1) * (1 + .016 * Math.sin(k.time * 2.6))} : pose;
    }
  }
  function* turn(angle, pose = IDLE, seconds = .22) {
    k.targetFacing = angle;
    yield* wait(seconds, pose);
  }
  function* hop(to, {height = .12, dur = .38, ready = .1, land = .12, base = IDLE, air = null, dust = false} = {}) {
    faceTo(to);
    const from = k.pos.clone(), rise = Math.max(0, to.y - from.y);
    const big = from.y - to.y > .3;
    const readyPose = mixPose(base, {...base, squash: .84, legs: .75, lean: .12, armsBack: base.ember ? 0 : .7, tuft: .08}, 1);
    let t = 0;
    while (t < ready) { t += yield; k.pose = mixPose(base, readyPose, ease(Math.min(1, t / ready))); }
    const airPose = air || (base.ember ? {...base, legs: .7} : {...base, arms: .95, armsBack: .6, legs: .62, look: [0, .5], brows: {raise: .02}, mouth: big ? 'grin' : 'small'});
    t = 0;
    while (t < dur) {
      t += yield;
      const u = Math.min(1, t / dur);
      k.pos.lerpVectors(from, to, u);
      const arc = (height + rise * .55) * 4 * u * (1 - u);
      k.pose = {...airPose, lift: arc, squash: lerp(1.1, .98, u), tuft: lerp(-.35, .3, u)};
    }
    k.pos.copy(to);
    const landPose = {...base, squash: big ? .74 : .82, legs: .82, tuft: .4, blink: big ? .6 : 0, mouth: big ? 'o' : base.mouth, dust: dust || big};
    t = 0;
    while (t < land) { t += yield; k.pose = mixPose(landPose, base, easeOut(Math.min(1, t / land))); }
    k.pose = base;
  }
  // Walking is a run of small hops: stone does not stroll.
  function* walkTo(target, {base = IDLE, interruptible = false} = {}) {
    for (let guard = 0; guard < 60; guard++) {
      if (interruptible && k.pending) return;
      yield* playful();
      const a = toSpace(k.pos), b = toSpace(target), d = Math.hypot(b.x - a.x, b.z - a.z);
      if (d < .03) return;
      const step = Math.min(.2, d) / d;
      const next = V(lerp(k.pos.x, target.x, step), lerp(k.pos.y, target.y, step), lerp(k.pos.z, target.z, step));
      yield* hop(next, {height: .045, dur: .2, ready: .05, land: .07, base});
    }
  }

  function* emerge() {
    // Squeezed narrow, Chip pops out of the niche onto the top step and springs back to shape.
    k.pos.copy(NICHE).setY(TOP.y);
    k.facing = k.targetFacing = 0;
    k.squeeze = .45;
    yield* wait(.25, {blink: 1, mouth: false});
    let t = 0;
    const from = k.pos.clone();
    while (t < .42) {
      t += yield;
      const u = Math.min(1, t / .42);
      k.pos.lerpVectors(from, TOP, u);
      k.squeeze = lerp(.45, 1, easeOut(u)) + Math.sin(u * Math.PI * 3) * .12 * (1 - u);
      k.pose = {lift: .22 * 4 * u * (1 - u), arms: 1.1, legs: .7, mouth: 'o', brows: {raise: .02}};
    }
    k.squeeze = 1;
    yield* hop(TOP, {height: 0, dur: .01, ready: .01, land: .2});
    yield* wait(.5, {...CHIP_FACES.curious, look: [-.8, .2]});
    yield* wait(.5, {...CHIP_FACES.curious, look: [.8, .2]});
  }
  function* takeEmber() {
    yield* turn(Math.PI, IDLE, .3);
    yield* wait(.35, {lean: .14, arms: [.3, .3], armsBack: [-1.3, -1.3], look: [0, -.2], brows: {tilt: -.3}, mouth: 'flat'}, {breathe: false});
    k.nicheGlow = 0;
    k.carrying = true;
    yield* wait(.25, {...CARRY, look: [0, .9], brows: {raise: .02}, mouth: 'o'});
    yield* turn(0, CARRY, .3);
    yield* wait(.5, {...CARRY, eyes: 'happy', mouth: 'smile', brows: {tilt: -.1}});
  }
  function* descend() {
    for (const tread of STAIRS_DOWN.slice(1)) {
      yield* hop(tread, {base: CARRY, height: .1, dur: .34});
      yield* wait(.06, CARRY);
      yield* playful();
    }
    yield* walkTo(IN_GATE, {base: CARRY});
  }
  function* lightGate() {
    yield* turn(Math.PI, CARRY, .25);
    yield* wait(.3, {...CARRY, arms: [3.2, 3.2], armsBack: [.5, .5], squash: .9, look: [0, .6], brows: {tilt: -.4}, mouth: 'flat'}, {breathe: false});
    // Toss: the ember leaves the cap and arcs into the gate.
    const start = toSpace(k.pos).add(new THREE.Vector3(0, chip.height * SIZE * .95, 0)), end = toSpace(DOOR);
    k.carrying = false;
    chip.ember.visible = false;
    flying.visible = true;
    let t = 0;
    k.pose = {arms: [2.4, 2.4], armsBack: [-1.2, -1.2], squash: 1.06, lean: .1, look: [0, .7], mouth: 'o', brows: {raise: .02}};
    while (t < .45) {
      t += yield;
      const u = Math.min(1, t / .45);
      flying.position.lerpVectors(start, end, u);
      flying.position.y += .28 * 4 * u * (1 - u);
      flying.scale.setScalar(lerp(1, .55, u));
    }
    flying.visible = false;
    k.fuse = FUSE_LIT;                                 // the gate rings; the pulse climbs the stairs
    yield* wait(.35, {...CHIP_FACES.joy, arms: [1.6, 1.6]});
    yield* turn(0.6, CHIP_FACES.joy, .25);
    yield* walkTo(PORCH_EDGE);
    // Watch the pulse run up the stairs.
    k.targetFacing = -2.2;
    yield* wait(.7, {look: [-.5, .9], brows: {raise: .02}, mouth: 'o'});
    yield* hop(PORCH_EDGE, {height: .14, dur: .32, base: CHIP_FACES.joy});
    yield* wait(.8, {...CHIP_FACES.proud, look: [-.5, .8]});
  }
  function* toIsland() {
    yield* hop(BELOW_PORCH, {height: .08, dur: .42, dust: true});
  }
  function* toTop() {
    yield* walkTo(BELOW_PORCH);
    yield* hop(PORCH_EDGE, {height: .1, dur: .4});
    const up = [...STAIRS_DOWN].reverse();
    yield* walkTo(up[0]);
    for (const tread of up.slice(1)) {
      yield* hop(tread, {height: .08, dur: .34, base: {...IDLE, brows: {tilt: -.25}, mouth: 'flat'}});
      yield* wait(.05, IDLE);
      yield* playful();
    }
    // The ember has rekindled in the niche while Chip was away.
  }

  function randomSpot() {
    const zone = ZONES[rand() < .7 ? 0 : 1];
    return V(lerp(zone.x[0], zone.x[1], rand()), GROUND, lerp(zone.z[0], zone.z[1], rand()));
  }
  function* chore() {
    const pick = rand();
    if (pick < .3) {
      for (let i = 0; i < 3 && !k.pending; i++) yield* wait(.7, {...CHIP_FACES.curious, look: [rand() * 2 - 1, rand() * .6]}, {interruptible: true});
    } else if (pick < .6) {
      let t = 0;                                       // sweep: arms low and forward, swinging
      while (t < 1.8 && !k.pending) {
        t += yield;
        const s = Math.sin(t * 9);
        k.pose = {lean: .14, arms: [.35 + .3 * s, .35 - .3 * s], armsBack: [-.7, -.7], look: [s * .5, -.6], brows: {tilt: -.3}, mouth: 'flat', dust: Math.sin(t * 4.5) > .4};
      }
    } else if (pick < .8) {
      yield* wait(2.2, {legs: .5, squash: .92, arms: .25, look: [.3, .1], ...CHIP_FACES.proud, eyes: 'open'}, {interruptible: true});
    } else {
      k.targetFacing = viewAngle();
      yield* wait(1.2, {...CHIP_FACES.joy, arms: [.15, 2.7]}, {interruptible: true});
    }
  }
  function* chores(seconds) {
    const end = k.time + seconds;
    k.interruptible = true;
    while (k.time < end) {
      if (k.pending) { yield* respond(k.pending.kind, k.pending); continue; }
      if (k.time - k.lastActivity > 20) { yield* doze(); continue; }
      yield* walkTo(randomSpot(), {interruptible: true});
      if (!k.pending) yield* chore();
    }
    k.interruptible = false;
  }
  // A short nap when nobody has moved for a while; any activity wakes Chip, and it wakes on its own after a few seconds
  // so the gate keeps being lit for a visitor who is just reading.
  function* doze() {
    const until = k.time + 6 + rand() * 3;
    while (k.time - k.lastActivity > 20 && !k.pending && k.time < until) yield* wait(.5, {...CHIP_FACES.sleepy, legs: .5, squash: .9, blink: .92});
    k.lastActivity = k.time;
    yield* wait(.45, {...CHIP_FACES.oof, squash: 1.08});
    yield* wait(.5, CHIP_FACES.curious);
  }
  // Jumps and waves can happen anywhere between hops, even mid-stairs with the ember on its cap.
  function* playful() {
    if (k.pending && k.pending.kind !== 'walk') yield* respond(k.pending.kind, k.pending);
  }
  function* respond(kind, data) {
    k.pending = null;
    const keep = k.carrying ? {ember: true, arms: CARRY.arms} : {};
    if (kind === 'walk') {
      yield* walkTo(data.to);
      yield* wait(.8, {...CHIP_FACES.curious, look: [0, -.4]});
    } else if (kind === 'jump' || kind === 'twirl') {
      k.targetFacing = viewAngle();
      yield* wait(.15, {...IDLE, ...keep});
      const spin = kind === 'twirl';
      const from = k.facing;
      let t = 0;
      yield* wait(.1, {squash: .8, legs: .72, armsBack: .7, ...CHIP_FACES.determined, ...keep}, {breathe: false});
      while (t < .55) {
        t += yield;
        const u = Math.min(1, t / .55);
        k.pose = {...CHIP_FACES.joy, lift: .42 * 4 * u * (1 - u), squash: lerp(1.14, 1, u), arms: 2.4, legs: .6, tuft: lerp(-.4, .3, u), ...keep};
        if (spin) k.facing = k.targetFacing = from + u * Math.PI * 2;
      }
      yield* hop(k.pos.clone(), {height: 0, dur: .01, ready: .01, land: .16, base: {...CHIP_FACES.joy, ...keep}});
      yield* wait(.5, {...CHIP_FACES.joy, ...keep});
    } else if (kind === 'wave') {
      k.targetFacing = viewAngle();
      let t = 0;
      while (t < 1.3) { t += yield; k.pose = {...CHIP_FACES.joy, ...keep, arms: [k.carrying ? CARRY.arms[0] : .15, 2.7 + .35 * Math.sin(t * 13)]}; }
    }
  }

  function* life() {
    yield* emerge();
    for (;;) {
      yield* takeEmber();
      yield* descend();
      yield* lightGate();
      yield* toIsland();
      yield* chores(4 + rand() * 4);
      yield* toTop();
      // Wait for the niche to glow again if the pulse is still running.
      while (k.nicheGlow < 1) yield* wait(.2, {...CHIP_FACES.curious, look: [0, -.3]});
    }
  }

  // ---- input ----------------------------------------------------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const islandMeshes = [];
  world.traverse(o => { if (o.isMesh && !space.getObjectById(o.id)) islandMeshes.push(o); });
  function pointAt(event) {
    const r = stage.getBoundingClientRect();
    ndc.set((event.clientX - r.left) / r.width * 2 - 1, -((event.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
  }
  const request = (kind, data = {}) => {
    if (k.pending && k.pending.kind !== 'wave' && kind === 'wave') return;
    k.pending = {kind, ...data};
    k.pendingAt = k.time;
  };
  const listeners = [];
  const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); listeners.push([target, type, fn]); };
  let lastJump = -10, lastWave = -10;
  if (!still) {
    on(window, 'pointermove', () => { k.lastActivity = k.time; }, {passive: true});
    on(window, 'keydown', () => { k.lastActivity = k.time; });
    on(window, 'scroll', () => { k.lastActivity = k.time; }, {passive: true});
    on(stage, 'pointermove', event => {
      if (event.pointerType === 'touch') return;
      pointAt(event);
      const over = raycaster.intersectObject(hitBox).length > 0;
      if (over !== k.hovered) {
        k.hovered = over;
        stage.style.cursor = over ? 'pointer' : '';
        if (over) { k.react = {face: {look: [0, .2], brows: {raise: .02}}, until: k.time + .9}; if (k.time - lastWave > 3) { lastWave = k.time; request('wave'); } }
      }
    });
    on(stage, 'pointerleave', () => { k.hovered = false; stage.style.cursor = ''; });
    on(stage, 'click', event => {
      k.lastActivity = k.time;
      pointAt(event);
      if (raycaster.intersectObject(hitBox).length) {
        k.react = {face: CHIP_FACES.joy, until: k.time + .8};
        request(k.time - lastJump < 1.6 ? 'twirl' : 'jump');
        lastJump = k.time;
        return;
      }
      const hit = raycaster.intersectObjects(islandMeshes, false)[0];
      if (!hit) return;
      const p = world.worldToLocal(hit.point.clone());
      const zone = ZONES.find(z => p.x >= z.x[0] - .1 && p.x <= z.x[1] + .1 && p.z >= z.z[0] - .1 && p.z <= z.z[1] + .1);
      if (zone && p.y < .25) request('walk', {to: V(THREE.MathUtils.clamp(p.x, zone.x[0], zone.x[1]), GROUND, THREE.MathUtils.clamp(p.z, zone.z[0], zone.z[1]))});
      else k.react = {face: {...CHIP_FACES.curious, look: [0, .6]}, until: k.time + .9};
    });
    const button = document.querySelector('.hero .btn');
    if (button) on(button, 'pointerenter', () => { k.react = {face: {...CHIP_FACES.joy}, until: k.time + 1}; request('wave'); });
  }

  // ---- frame ----------------------------------------------------------------------------------------------------
  let task = null;
  if (still) {
    k.pos.copy(PORCH_EDGE);
    k.facing = k.targetFacing = .5;
    chip.ember.visible = false;
  } else {
    task = life();
    task.next();
  }
  let blinkAt = 2, blinkUntil = 0;

  function apply() {
    let pose = {...k.pose};
    if (k.react && k.time < k.react.until) pose = {...pose, ...k.react.face, eyes: k.react.face.eyes ?? pose.eyes};
    if (k.time > blinkAt) { blinkUntil = k.time + .12; blinkAt = k.time + 2.2 + rand() * 3.2; }
    if (k.time < blinkUntil && !pose.blink && pose.eyes !== 'happy') pose.blink = .95;
    poseChip(chip, pose);
    toSpace(k.pos, chip.group.position);
    let d = k.targetFacing - k.facing;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    k.facing += d * Math.min(1, .2);
    chip.group.rotation.y = k.facing;
    chip.group.scale.set(SIZE * k.squeeze, SIZE / Math.max(.5, k.squeeze) ** .3, SIZE * k.squeeze);
    // The niche ember rekindles once the pulse has finished.
    if (k.nicheGlow < 1 && k.fuse > 5.5) k.nicheGlow = Math.min(1, k.nicheGlow + .02);
    nicheEmber.visible = k.nicheGlow > .05;
    nicheEmber.scale.setScalar(.8 * Math.round(k.nicheGlow * 4) / 4 || .01);
  }
  apply();

  const api = {
    chip,
    // Advance by dt seconds; returns the fuse time for the island's shaders.
    update(dt) {
      if (!task) return -100;
      dt = Math.min(dt, .1);
      k.time += dt;
      if (k.fuse > -50) k.fuse += dt;
      if (k.pending && k.time - k.pendingAt > 2.5) k.pending = null;
      task.next(dt);
      apply();
      return k.fuse;
    },
    dispose() {
      for (const [target, type, fn] of listeners) target.removeEventListener(type, fn);
      world.remove(space);
      stage.style.cursor = '';
    }
  };
  return api;
}
