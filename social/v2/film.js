// "One pixel. One strike. One door." The 3D half of the reel, as a pure function of time.
//   0.0  a red cube falls through the dark toward a floor of glossy tiles (the 30 px grid, in 3D)
//   1.6  it lands: the floor ripples, and a rain of small cubes builds the pixel b
//   6.4  lightning hits the ember; the b detonates in slow motion
//   8.6  the debris reassembles as a doorway; the camera pushes through it
//  12.1  the same cubes become other worlds: Orbit Shift's planet and ship, Harvest & Hearth's strawberry
//  15.6  they collapse back into the b, and a dolly-zoom flattens it into the 2D pixel b that the end card starts from
import * as THREE from 'three';
import {createStage, ease as E, W, H} from './stage.js';
import {PAL, mixHex, rng, voxelB, voxelDoor, voxelPlanet, voxelShip, voxelStrawberry, boltPath} from './shapes.js';

export const FPS = 30;
export const BPM = 112, B = 60 / BPM;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const sat = (x, a, b) => clamp((x - a) / (b - a));

// ---- the story's clock (seconds) ----------------------------------------------------------------------------------
export const T = {
  impact: 3 * B, rain0: 3 * B + .1, hero: 8.2 * B, emberUp: 7 * B, strike: 12 * B, reform: 15 * B, doorDone: 19 * B,
  push: 20 * B, flash: 21.3 * B, w1: 21.2 * B, w2: 26.7 * B, collapse: 29.9 * B, flat0: 33.4 * B, flat1: 35.5 * B
};
T.hand = T.flat1 + .3;               // from here the 2D end card takes over from the flat b
T.end = T.hand + 5.4;

// ---- tracks: smooth camera / light curves through keyframes (Catmull-Rom) ------------------------------------------
function track(keys) {
  return t => {
    if (t <= keys[0].t) return keys[0].v.slice();
    if (t >= keys[keys.length - 1].t) return keys[keys.length - 1].v.slice();
    let i = 0; while (t > keys[i + 1].t) i++;
    const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(keys.length - 1, i + 2)];
    const u = (t - k1.t) / (k2.t - k1.t), u2 = u * u, u3 = u2 * u, dt = k2.t - k1.t;
    return k1.v.map((_, c) => {
      const m1 = (k2.v[c] - k0.v[c]) / (k2.t - k0.t) * dt, m2 = (k3.v[c] - k1.v[c]) / (k3.t - k1.t) * dt;
      return (2 * u3 - 3 * u2 + 1) * k1.v[c] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * k2.v[c] + (u3 - u2) * m2;
    });
  };
}
const polar = (az, r, y, cx = 0, cz = 0) => [cx + Math.sin(az * Math.PI / 180) * r, y, cz + Math.cos(az * Math.PI / 180) * r];

// ---- camera script: [px, py, pz, lx, ly, lz, fov, focus-range, bokeh] -----------------------------------------------
const BC = [0, 1.37, 0];                       // the b's centre
const DOOR_C = [0, 2.35, -.5];
const WORLD_C = [0, 2.5, -9.5];
const BZ = -7.0, BFLAT_Y = 2.0;            // where the b ends up for the dolly zoom (z of its mid-plane, height of its centre)
const camTrack = track([
  {t: 0, v: [1.6, 10.9, 6.2, 0, 8.2, 0, 30, 5, 0]},
  {t: .7, v: [1.4, 8.6, 6.8, 0, 6.2, 0, 30, 5, 0]},
  {t: 1.2, v: [1.1, 5.2, 8.0, 0, 3.0, 0, 30, 5, 0]},
  {t: T.impact - .12, v: [.9, 2.9, 9.0, 0, 1.2, 0, 30, 4, 0]},
  {t: T.impact + .5, v: [1.7, 2.8, 9.8, 0, 1.4, 0, 28, 5, 0]},
  {t: T.impact + 1.9, v: [...polar(30, 11.6, 2.6), 0, 1.7, 0, 27, 7, 0]},
  {t: T.hero, v: [...polar(8, 12.0, 2.7), 0, 1.9, 0, 27, 7, 0]},
  {t: T.hero + 1.15, v: [...polar(-20, 11.2, 1.8), 0, 2.0, 0, 27, 6, 0]},
  {t: T.strike - .04, v: [...polar(-27, 10.4, 1.6), .2, 2.1, 0, 27, 6, 0]},
  {t: T.strike + .5, v: [...polar(-34, 8.4, 2.2), .2, 2.3, 0, 30, 4, 1.6]},
  {t: T.strike + 2.0, v: [...polar(-10, 5.8, 2.7), 0, 2.4, 0, 34, 3.5, 2.2]},
  {t: T.reform + .4, v: [...polar(14, 9.6, 3.2), 0, 2.5, 0, 32, 5, 1.4]},
  {t: T.doorDone, v: [0, 2.6, 12.4, 0, 2.35, 0, 28, 7, 0]},
  {t: T.push, v: [0, 2.5, 10.6, 0, 2.35, -1, 28, 7, 0]},
  {t: T.flash, v: [0, 2.35, 0.9, 0, 2.35, -9, 56, 8, 0]},
  {t: T.w1 + 1.0, v: [0, 2.7, .9, 0, 2.95, -9.5, 42, 8, .8]},
  {t: T.w2 - .2, v: [.4, 2.9, .6, 0, 2.95, -9.5, 40, 8, .8]},
  {t: T.w2 + .9, v: [.7, 2.8, -.8, 0, 2.7, -9.5, 38, 7, 1]},
  {t: T.collapse, v: [-.5, 2.6, -.4, 0, 2.1, BZ, 40, 7, 1]},
  {t: T.flat0 - .2, v: [0, BFLAT_Y, -.6, 0, BFLAT_Y, BZ, 44, 9, .4]},
  {t: T.flat0 + 3, v: [0, BFLAT_Y, -.6, 0, BFLAT_Y, BZ, 44, 9, .4]}
]);
// the final dolly zoom is computed analytically below (it has to hold the b's size while the lens narrows)

export async function createFilm({canvas, scale = 1}) {
  const st = createStage(canvas, {scale});
  const {scene, camera, composer, THREE: _} = st;
  const R = rng(1990);

  // ---- formations -------------------------------------------------------------------------------------------------
  const b = voxelB().map(c => ({...c, x: c.x + BC[0], y: c.y + BC[1], z: c.z + BC[2]}));
  const door = voxelDoor().map(c => ({...c, x: c.x + DOOR_C[0], y: c.y + DOOR_C[1], z: c.z + DOOR_C[2]}));
  const planet = voxelPlanet().map(c => ({...c, x: c.x + WORLD_C[0], y: c.y + WORLD_C[1], z: c.z + WORLD_C[2]}));
  const ship = voxelShip().map(c => ({...c, x: c.x * .68 + WORLD_C[0] + .2, y: c.y * .68 + WORLD_C[1] + 1.8, z: c.z * .68 + WORLD_C[2] + .5, s: c.s * .68, fixed: true}));
  const straw = voxelStrawberry().map(c => ({...c, x: c.x + WORLD_C[0], y: c.y + WORLD_C[1] - .45, z: c.z + WORLD_C[2]}));
  const world1 = [...planet, ...ship];
  const N = Math.max(b.length, door.length, world1.length, straw.length);
  const pool = st.makePool(N);

  const pad = (list, home) => {                                    // every formation has N slots; spare cubes sit, tiny, at home
    const out = list.slice(0, N).map(c => ({...c, q: null}));
    for (let i = out.length; i < N; i++) out.push({x: home[0] + (R() - .5) * 2, y: home[1] + (R() - .5) * 2, z: home[2] + (R() - .5) * 2, s: 0, c: PAL.charcoal, h: 0, q: null});
    return out;
  };
  // shuffle each formation (seeded) so the mapping between formations is a swirl, not a sheet
  const shuffled = (list, seed) => { const r = rng(seed), a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // the b's cubes keep their order so the rain can be row-by-row; every other formation is mapped onto them by sorted height
  // within each cube's own slot, so nothing needs a separate matching step.
  const bPad = pad(b, BC);
  const form = {
    sky: bPad.map(c => ({...c, y: c.y + 9 + R() * 7, x: c.x + (R() - .5) * .5, z: c.z + (R() - .5) * .5, s: c.s})),
    b: bPad,
    door: pad(shuffled(door, 7), DOOR_C),
    w1: pad(shuffled(world1, 11), WORLD_C),
    w2: pad(shuffled(straw, 13), WORLD_C),
    b2: pad(shuffled(b.map(c => ({...c, z: c.z + BZ, y: c.y - BC[1] + BFLAT_Y})), 17), BC)
  };
  // explosion: outward from the strike point with tumble
  const STRIKE = new THREE.Vector3(.3, 2.57, 0);
  form.scatter = bPad.map((c, i) => {
    const r = rng(500 + i), d = new THREE.Vector3(c.x - BC[0], c.y - BC[1], c.z - BC[2]);
    d.add(new THREE.Vector3((r() - .5) * 2.2, (r() - .35) * 2.2 + .6, (r() - .5) * 2.2)).normalize();
    const dist = 2.2 + r() * 4.8;
    const p = new THREE.Vector3(c.x, c.y, c.z).addScaledVector(d, dist);
    p.y = Math.max(.7 + r() * .6, p.y); p.z = THREE.MathUtils.clamp(p.z, -5, 5.2);
    return {x: p.x, y: p.y, z: p.z, s: c.s * (.9 + r() * .8), c: c.c, h: 0, q: new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6.28, r() * 6.28, r() * 6.28))};
  });
  const forms = Object.keys(form);
  const spinOf = {w1: .22, w2: .3, door: 0, b: 0, b2: 0, sky: 0, scatter: 0};
  const centreOf = {w1: WORLD_C, w2: WORLD_C};

  // per-cube randoms
  const rr = Array.from({length: N}, (_, i) => { const r = rng(9000 + i); return {a: r(), b: r(), c: r(), d: r(), ax: new THREE.Vector3(r() - .5, r() - .5, r() - .5).normalize(), arc: new THREE.Vector3(r() - .5, r() * .6 + .2, r() - .5)}; });
  const bRow = b.map(c => c.gy); const maxRow = 26;
  const bDist = b.map(c => Math.hypot(c.x - STRIKE.x, c.y - STRIKE.y, c.z - STRIKE.z));

  // ---- legs: how the cubes get from one formation to the next --------------------------------------------------------
  const legs = [
    {from: 'sky', to: 'b', t0: T.rain0, dur: .8, ease: 'fall', flash: 1, spin: 0, arc: 0,
      delay: i => (i < b.length ? (1 - bRow[i] / maxRow) * 1.55 * (.96 + rr[i].a * .08) + rr[i].b * .32 : 5), durMul: i => .85 + rr[i].c * .3},
    {from: 'b', to: 'scatter', t0: T.strike + .06, dur: 3.0, ease: 'blast', flash: 0, spin: 0, arc: 0, heatStart: 1.3,
      delay: i => (i < b.length ? bDist[i] * .035 : 0), durMul: i => .8 + rr[i].c * .5},
    {from: 'scatter', to: 'door', t0: T.reform, dur: 2.15, ease: 'inOut', flash: .7, spin: 1.2, arc: 3.0,
      delay: i => rr[i].a * .75, durMul: i => .8 + rr[i].c * .4},
    {from: 'door', to: 'w1', t0: T.flash - .35, dur: 1.5, ease: 'inOut', flash: .5, spin: .8, arc: 1.6,
      delay: i => (Math.abs(form.door[i].x) * .12 + rr[i].a * .35), durMul: i => .8 + rr[i].c * .45},
    {from: 'w1', to: 'w2', t0: T.w2 - .3, dur: 1.4, ease: 'inOut', flash: .35, spin: 1.0, arc: 2.2,
      delay: i => rr[i].a * .5, durMul: i => .85 + rr[i].c * .35},
    {from: 'w2', to: 'b2', t0: T.collapse, dur: 1.9, ease: 'inOutQuint', flash: .6, spin: 1.3, arc: 2.6,
      delay: i => rr[i].a * .5, durMul: i => .85 + rr[i].c * .3}
  ];
  legs.forEach(L => { L.d = new Float32Array(N).map((_, i) => L.delay(i)); L.m = new Float32Array(N).map((_, i) => L.durMul(i)); });
  const easeFn = {
    fall: u => u * u, inOut: E.inOut, out: E.out, linear: E.linear, inOutQuint: E.inOutQuint, blast: u => 1 - (1 - u) ** 4.5
  };

  // ---- scene extras ---------------------------------------------------------------------------------------------------
  const flatBasic = (color) => new THREE.MeshBasicMaterial({color, toneMapped: false});
  // hero ember: the red pixel
  const emberGeo = new THREE.BoxGeometry(1, 1, 1);
  const ember = new THREE.Mesh(emberGeo, st.cubeMat.clone());
  ember.material = new THREE.MeshPhysicalMaterial({color: PAL.red, emissive: PAL.red, emissiveIntensity: .7, roughness: .2, metalness: .1, clearcoat: 1, clearcoatRoughness: .08, envMapIntensity: 1.3});
  ember.castShadow = true; scene.add(ember);
  // sparks
  const SPARK_N = 900;
  const sparkMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), flatBasic(0xffffff), SPARK_N);
  sparkMesh.frustumCulled = false; sparkMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SPARK_N * 3), 3); scene.add(sparkMesh);
  const sparks = [];
  function burst(t0, origin, count, speed, life, seed, size = .05, spread = 1, up = 0) {
    const r = rng(seed);
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2, e = (r() - .35) * Math.PI * spread, sp = speed * (.35 + r() * .8);
      sparks.push({t0, o: origin, v: [Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + up, Math.sin(a) * Math.cos(e) * sp], life: life * (.5 + r() * .7), s: size * (.5 + r() * 1.2), c: [PAL.hot, PAL.red, 0xffb283, PAL.ivory][Math.floor(r() * 4)]});
    }
  }
  burst(T.impact, [0, .3, 0], 90, 5.5, 1.3, 31, .05, .9, 1.2);
  burst(T.strike, [.3, 2.57, 0], 220, 9, 1.8, 32, .06, 1.2, 0);
  burst(T.flash, [0, 2.4, -2], 160, 12, 1.2, 33, .07, 1.6, 0);
  burst(T.collapse + 1.9, [0, 2.2, -7.5], 70, 4, 1.0, 34, .05, 1.6, 0);
  // bolt: a stepped, voxel lightning
  const BOLT_N = 90;
  const boltMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), flatBasic(0xffffff), BOLT_N);
  boltMesh.frustumCulled = false; scene.add(boltMesh);
  const boltPts = boltPath({x: .3, y: 14, z: 0}, {x: .3, y: 2.7, z: 0}, 5, .9, BOLT_N - 1);
  // portal
  const portalMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: {uTime: {value: 0}, uAmt: {value: 0}},
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec2 vUv; uniform float uTime; uniform float uAmt;
      float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
      void main(){
        vec2 p=(vUv-.5)*vec2(1.,1.42);             // arch: rectangle below, half circle above
        float arch = p.y>.2 ? length(vec2(p.x,p.y-.2)) : abs(p.x);
        float edge = smoothstep(.5,.34,arch) * smoothstep(-.71,-.6,p.y);
        float f = n(vec2(p.x*5.,p.y*3.-uTime*1.6))*.6 + n(vec2(p.x*11.,p.y*6.-uTime*2.7))*.4;
        float core = smoothstep(.55,0.,length(p*vec2(1.2,.8)));
        vec3 col = mix(vec3(.42,.01,.01), vec3(.95,.2,.06), f);
        col = mix(col, vec3(1.,.78,.55), core*core*.75);
        col += vec3(1.,.25,.1) * pow(smoothstep(.34,.5,arch),2.) * .0;
        gl_FragColor = vec4(col*edge*uAmt*(.8+.4*f), 1.);
      }`
  });
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 3.26), portalMat);
  portal.position.set(DOOR_C[0], DOOR_C[1] - .1, DOOR_C[2] - .02); portal.frustumCulled = false; scene.add(portal);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, uniforms: {uAmt: {value: 0}},
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec2 vUv; uniform float uAmt; void main(){ vec2 p=(vUv-.5)*2.; float d=length(p*vec2(1.,.8)); float g=pow(max(0.,1.-d),3.0); gl_FragColor=vec4(vec3(1.,.16,.05)*g*uAmt*.5,1.); }'
  }));
  halo.position.set(DOOR_C[0], DOOR_C[1], DOOR_C[2] - .6); halo.frustumCulled = false; scene.add(halo);
  // dust motes
  const MOTE_N = 260, moteGeo = new THREE.BufferGeometry(), motePos = new Float32Array(MOTE_N * 3), moteSeed = [];
  { const r = rng(77); for (let i = 0; i < MOTE_N; i++) moteSeed.push([(r() - .5) * 16, r() * 9, (r() - .5) * 18 - 2, r(), r()]); }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({size: .05, color: 0xffb8a0, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, sizeAttenuation: true}));
  motes.frustumCulled = false; scene.add(motes);
  // backdrop: a screen-space glow behind everything (tinted per world)
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false, fog: false,
    uniforms: {uCol: {value: new THREE.Color(0x000000)}, uAmt: {value: 0}, uCtr: {value: new THREE.Vector2(.5, .56)}, uBase: {value: new THREE.Color(PAL.bg)}},
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,.9999,1.); }',
    fragmentShader: 'varying vec2 vUv; uniform vec3 uCol; uniform float uAmt; uniform vec2 uCtr; uniform vec3 uBase; void main(){ vec2 d=(vUv-uCtr)*vec2(1.,1.78); float g=exp(-dot(d,d)*2.6); gl_FragColor=vec4(uBase+uCol*g*uAmt,1.); }'
  }));
  bg.renderOrder = -100; bg.frustumCulled = false; scene.add(bg);
  scene.background = null;

  // ---- floor ripples ------------------------------------------------------------------------------------------------
  const ripples = [
    {t0: T.impact, x: 0, z: 0, speed: 9, amp: .55, width: 1.6, decay: 1.6, glow: 1.0},
    {t0: T.impact + .5, x: 0, z: 0, speed: 8, amp: .2, width: 1.4, decay: 2.2, glow: .5},
    {t0: T.strike, x: .3, z: 0, speed: 13, amp: .8, width: 2.0, decay: 1.5, glow: 1.2},
    {t0: T.doorDone - .25, x: 0, z: -.5, speed: 10, amp: .35, width: 1.8, decay: 1.8, glow: .8},
    {t0: T.flash, x: 0, z: -.5, speed: 15, amp: .6, width: 2.5, decay: 1.2, glow: 1.2}
  ];
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpP = new THREE.Vector3(), tmpS = new THREE.Vector3(), tmpC = new THREE.Color(), tmpE = new THREE.Euler();
  const unitQ = new THREE.Quaternion(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qs = new THREE.Quaternion(), qy = new THREE.Quaternion();
  const white = new THREE.Color(1, 1, 1);

  // ---- per-frame cube state -----------------------------------------------------------------------------------------
  const out = {x: 0, y: 0, z: 0, s: 0, h: 0, cr: 0, cg: 0, cb: 0};
  const colA = new THREE.Color(), colB = new THREE.Color();
  const formRot = (name, t) => (spinOf[name] ? spinOf[name] * Math.max(0, t - (name === 'w1' ? T.w1 : name === 'w2' ? T.w2 : 0)) : 0);
  function formAt(name, i, t, o) {
    const f = form[name][i], sp = formRot(name, t);
    if (sp && !f.fixed) {
      const c = centreOf[name], dx = f.x - c[0], dz = f.z - c[2], cs = Math.cos(sp), sn = Math.sin(sp);
      o.x = c[0] + dx * cs + dz * sn; o.z = c[2] - dx * sn + dz * cs; o.y = f.y;
    } else { o.x = f.x; o.y = f.y; o.z = f.z; }
    o.s = f.s; o.h = f.h; o.c = f.c; o.q = f.q; o.rot = sp;
  }
  const A = {}, Bt = {};
  function evalCube(i, t) {
    let k = -1;
    for (let j = legs.length - 1; j >= 0; j--) if (t >= legs[j].t0 + legs[j].d[i]) { k = j; break; }
    if (k < 0) { formAt('sky', i, t, A); tmpQ.identity(); return {...A, s: 0, q: null, ang: 0, h: 0, land: -1, e: 0}; }
    const L = legs[k];
    formAt(L.from, i, t, A); formAt(L.to, i, t, Bt);
    const dur = L.dur * L.m[i], u = clamp((t - L.t0 - L.d[i]) / dur), e = easeFn[L.ease](u);
    const o = {x: lerp(A.x, Bt.x, e), y: lerp(A.y, Bt.y, e), z: lerp(A.z, Bt.z, e), s: lerp(A.s, Bt.s, smooth(Math.min(1, u * 1.6))), h: 0, land: -1, e, rot: Bt.rot, u};
    if (L.arc) { const k2 = Math.sin(Math.PI * e) * L.arc; o.x += rr[i].arc.x * k2; o.y += rr[i].arc.y * k2; o.z += rr[i].arc.z * k2; }
    o.ang = L.spin ? rr[i].d * 6.283 * L.spin * 2 * Math.sin(Math.PI * e) : 0;
    o.qa = A.q; o.qb = Bt.q; o.axis = rr[i].ax;
    o.cA = A.c; o.cB = Bt.c; o.hA = A.h; o.hB = Bt.h;
    // heat: landing flash, start flash, and the formation's own heat
    let h = lerp(A.h, Bt.h, e);
    if (u >= 1) { const since = t - (L.t0 + L.d[i] + dur); if (L.flash) h = Math.max(h, L.flash * Math.max(0, Math.exp(-since / .17) - .04)); }
    else if (L.heatStart) h = Math.max(h, L.heatStart * Math.max(0, Math.exp(-(t - L.t0 - L.d[i]) / .55) - .04));
    if (u >= 1 && L.ease === 'fall') { const since = t - (L.t0 + L.d[i] + dur); o.y += .06 * Math.exp(-since * 16) * Math.abs(Math.sin(since * 34)); }
    // debris drifts while it hangs in the air
    if (L.to === 'scatter' && u >= .6) { const tt = t - (L.t0 + L.d[i] + dur * .6); o.x += Math.sin(tt * .6 + rr[i].a * 9) * .05 * Math.min(1, tt); o.y += Math.sin(tt * .5 + rr[i].b * 9) * .07 * Math.min(1, tt); o.ang += tt * (rr[i].c - .5) * .8; }
    o.h = h;
    return o;
  }

  // ---- lights, post and everything else as functions of time ----------------------------------------------------------
  const lerpHex = (a, b, t) => mixHex(a, b, clamp(t));
  function seek(t) {
    // camera
    const c = camTrack(t);
    let shake = 0;
    for (const [ts, a] of [[T.impact, .09], [T.strike, .22], [T.flash, .14]]) { const age = t - ts; if (age >= 0 && age < .45) shake += a * Math.exp(-age * 9) * (age < .1 ? 1 : 1); }
    const sx = shake ? (Math.sin(t * 91) + Math.sin(t * 53 + 1)) * .5 * shake : 0, sy = shake ? (Math.sin(t * 77 + 2) + Math.sin(t * 61)) * .5 * shake : 0;
    // final dolly zoom: hold the b's apparent size while the lens narrows and the camera retreats (perspective collapses to flat)
    const dz = sat(t, T.flat0 - .2, T.flat1 + .3), dzE = E.inOut(dz);
    let pos = [c[0], c[1], c[2]], look = [c[3], c[4], c[5]], fov = c[6], dist = 0;
    if (t > T.flat0 - .2) {
      const base = camTrack(T.flat0 - .2), tgt = [0, BFLAT_Y, BZ];
      const dist0 = Math.hypot(base[0] - tgt[0], base[1] - tgt[1], base[2] - tgt[2]);
      dist = lerp(dist0, 170, dzE);
      fov = Math.atan(Math.tan(base[6] * Math.PI / 360) * dist0 / dist) * 360 / Math.PI;
      pos = [tgt[0] + (base[0] - tgt[0]) / dist0 * dist, tgt[1] + (base[1] - tgt[1]) / dist0 * dist, tgt[2] + (base[2] - tgt[2]) / dist0 * dist];
      look = tgt;
    }
    if (typeof window !== 'undefined' && window.debugCam) { [pos, look, fov] = [window.debugCam.slice(0, 3), window.debugCam.slice(3, 6), window.debugCam[6]]; }
    camera.position.set(pos[0] + sx, pos[1] + sy, pos[2]);
    camera.fov = fov; camera.near = dist > 30 ? 20 : .1; camera.far = dist > 30 ? 500 : 120;
    scene.fog.density = dist ? Math.min(.05, .3 / dist) : .05;
    camera.lookAt(look[0] + sx * .5, look[1] + sy * .5, look[2]);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    const camDist = Math.hypot(pos[0] - look[0], pos[1] - look[1], pos[2] - look[2]);
    st.dof.cocMaterial.worldFocusDistance = camDist; st.dof.cocMaterial.worldFocusRange = c[7] * (1 + dz * 12);
    st.dof.bokehScale = c[8] * 1.6;

    // the red cube: falls, lands, rests, lifts to hover as the ember, then is struck
    const fall = clamp(t / T.impact);
    let ey = 9.0 - 8.75 * fall * fall, esx = 1, esy = 1, esz = 1;
    if (t < T.impact) { const v = fall * 2; esy = 1 + .55 * v * fall; esx = esz = 1 / Math.sqrt(esy); }
    else {
      const age = t - T.impact;
      if (age < .35) { const sq = Math.exp(-age * 12) * Math.cos(age * 40); esy = 1 - .45 * sq; esx = esz = 1 + .22 * sq; }
      ey = .25 * (esy >= 1 ? 1 : esy + .0);
    }
    const eSize = .3 * (t < T.impact ? 1.35 : 1.0) * (t < T.impact ? 1 : 1);
    let ex = 0, ez = 0, eyy = ey;
    const lift = E.inOut(sat(t, T.emberUp, T.hero));
    if (t >= T.emberUp) { ex = lerp(0, .3, lift); eyy = lerp(.25, 2.57, lift) + Math.sin(t * 2.6) * .05 * lift; ez = 0; }
    let emberVis = t < T.strike ? 1 : 0;
    ember.visible = !!emberVis;
    ember.position.set(ex, eyy, ez); ember.scale.set(eSize * esx, eSize * esy, eSize * esz);
    ember.rotation.set(t < T.impact ? t * 1.2 : 0, t < T.impact ? t * 1.9 : (t > T.emberUp ? 0 : 0), 0);
    ember.material.emissiveIntensity = .55 + .25 * Math.sin(t * 7) * lift + (t >= T.impact && t < T.impact + .4 ? 1.6 * Math.exp(-(t - T.impact) * 9) : 0) + (t > T.strike - .7 && t < T.strike ? (t - T.strike + .7) * 2.5 : 0);

    // cubes
    const m = pool.mesh, heatA = pool.heat;
    const flatK = sat(t, T.flat0, T.flat1), flatE = E.inOut(flatK);
    for (let i = 0; i < N; i++) {
      const o = evalCube(i, t);
      let s = o.s;
      tmpP.set(o.x, o.y, o.z);
      // orientation: slerp between the formations' orientations, plus the tumble
      qs.identity();
      if (o.qa || o.qb) { qa.copy(o.qa || unitQ); qb.copy(o.qb || unitQ); qs.copy(qa).slerp(qb, o.e ?? 0); }
      if (o.ang) { qy.setFromAxisAngle(o.axis, o.ang); qs.premultiply(qy); }
      if (o.rot) { qy.setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.rot); qs.premultiply(qy); }
      let sz = s;
      if (flatK > 0 && i < b.length) { tmpP.z = BZ + (tmpP.z - BZ) * (1 - flatE); sz = s * (1 - .96 * flatE); s = s * (1 + .03 * flatE); }
      tmpM.compose(tmpP, qs, tmpS.set(s * (1 - .055 * (1 - flatE)), s * (1 - .055 * (1 - flatE)), sz * (1 - .055 * (1 - flatE))));
      m.setMatrixAt(i, tmpM);
      // colour
      if (o.cA !== undefined) { colA.set(o.cA); colB.set(o.cB); tmpC.copy(colA).lerp(colB, smooth(o.e)); } else tmpC.set(o.c ?? 0x222222);
      if (flatK > 0 && i < b.length) tmpC.lerp(colB.set(PAL.ivory), flatE);
      m.setColorAt(i, tmpC);
      let h = o.h;
      // the red crown cubes breathe once the b is built
      if (t > T.hero - .5 && t < T.strike && i < b.length && b[i].red) h = Math.max(h, .14 + .1 * Math.sin(t * 3 + i));
      heatA.setX(i, h * (1 - flatE));
    }
    m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; heatA.needsUpdate = true;
    st.cubeMat.userData.uniforms.uFlat.value = flatE;

    // floor
    let tileMix = 1;
    tileMix = 1 - sat(t, T.flat0 - .3, T.flat0 + .7);
    const tAcc = lerpHex(PAL.red, PAL.mint, sat(t, T.w1, T.w1 + .6) - sat(t, T.w2 - .2, T.w2 + .5) * .0);
    const accent = t < T.w1 ? PAL.red : t < T.w2 ? PAL.mint : t < T.collapse ? 0xff5a3c : PAL.red;
    st.tileMat.userData.uniforms.uHeatColor.value.set(accent);
    st.cubeMat.userData.uniforms.uHeatColor.value.set(PAL.red);
    const tm = st.tiles, th = st.tileHeat, TILE = st.TILE;
    const floorFade = 1 - E.inOut(sat(t, T.collapse + .2, T.flat0 + .2)) * 0;
    for (let i = 0; i < st.tileBase.length; i++) {
      const [x, z] = st.tileBase[i];
      let y = -.07, glow = 0;
      for (const rp of ripples) {
        const age = t - rp.t0; if (age < 0 || age > 3.2) continue;
        const d = Math.hypot(x - rp.x, z - rp.z), w = (d - rp.speed * age) / rp.width, k = Math.exp(-w * w) * Math.exp(-age * rp.decay);
        y += k * rp.amp; glow += k * rp.glow * .75;
      }
      // a slow shimmer so the floor is never dead
      glow += .018 * (.5 + .5 * Math.sin(t * 1.4 + x * .6 + z * .45));
      // the build lights the tiles under the b
      if (t > T.rain0 && t < T.strike + .2) { const dd = Math.hypot(x, z); glow += Math.exp(-dd * dd * .8) * .12 * sat(t, T.rain0, T.rain0 + 1.5); }
      const sc = (t > T.collapse ? 1 : 1) * tileMix;
      tmpM.compose(tmpP.set(x, y, z), unitQ, tmpS.set(sc, 1, sc));
      tm.setMatrixAt(i, tmpM);
      th[i] = clamp(glow, 0, 1.6);
    }
    tm.instanceMatrix.needsUpdate = true; st.tileGeo.attributes.aHeat.needsUpdate = true;

    // sparks
    let sn = 0;
    for (const sp of sparks) {
      const age = t - sp.t0; if (age < 0 || age > sp.life || sn >= SPARK_N) continue;
      const k = age / sp.life, g = -5.5;
      tmpP.set(sp.o[0] + sp.v[0] * age, Math.max(.05, sp.o[1] + sp.v[1] * age + .5 * g * age * age), sp.o[2] + sp.v[2] * age);
      const s2 = sp.s * (1 - k * k) * (k < .05 ? k / .05 : 1);
      tmpM.compose(tmpP, tmpQ.setFromEuler(tmpE.set(age * 5, age * 7, 0)), tmpS.setScalar(Math.max(.0001, s2)));
      sparkMesh.setMatrixAt(sn, tmpM); sparkMesh.setColorAt(sn, tmpC.set(sp.c).multiplyScalar(2.2)); sn++;
    }
    for (let i = sn; i < SPARK_N; i++) { tmpM.makeScale(0, 0, 0); sparkMesh.setMatrixAt(i, tmpM); }
    sparkMesh.instanceMatrix.needsUpdate = true; sparkMesh.instanceColor.needsUpdate = true;

    // bolt: reveals top-down in 4 stepped frames, flickers, then is gone
    const bAge = t - T.strike, bolt = bAge >= 0 && bAge < .42;
    for (let i = 0; i < BOLT_N; i++) {
      const p = boltPts[i], shown = bolt && i <= Math.min(BOLT_N - 1, Math.floor(clamp(bAge / (1 / 15)) * (BOLT_N / 1))) && (bAge < .2 || (Math.floor(bAge * 30) % 2 === 0 || bAge < .3));
      const w = .1 + .05 * Math.sin(i * 1.7);
      tmpM.compose(tmpP.set(p.x, p.y, p.z), unitQ, tmpS.setScalar(shown ? w * (1 - clamp((bAge - .2) / .22) * .9) : 0.0001));
      boltMesh.setMatrixAt(i, tmpM);
    }
    boltMesh.instanceMatrix.needsUpdate = true; boltMesh.material.color.set(bAge < .12 ? 0xffffff : PAL.hot).multiplyScalar(3);

    // portal + halo
    const portalAmt = sat(t, T.doorDone - .5, T.doorDone + .5) * (1 - sat(t, T.flash + .15, T.flash + .45));
    portalMat.uniforms.uTime.value = t; portalMat.uniforms.uAmt.value = portalAmt * (1 + .12 * Math.sin(t * 30));
    portal.visible = portalAmt > .001;
    halo.material.uniforms.uAmt.value = portalAmt * .7 + .2 * Math.exp(-Math.abs(t - T.flash) * 3);
    halo.visible = halo.material.uniforms.uAmt.value > .001;

    // motes
    for (let i = 0; i < MOTE_N; i++) { const s = moteSeed[i]; motePos[i * 3] = s[0] + Math.sin(t * .25 + s[3] * 6) * .5; motePos[i * 3 + 1] = (s[1] + t * (.12 + s[4] * .2)) % 9; motePos[i * 3 + 2] = s[2]; }
    moteGeo.attributes.position.needsUpdate = true;
    motes.material.opacity = .55 * (1 - sat(t, T.flat0 - .2, T.flat0 + .4));

    // backdrop tint per world
    const w1 = sat(t, T.w1 + .2, T.w1 + 1.2) * (1 - sat(t, T.w2 - .3, T.w2 + .5)), w2 = sat(t, T.w2 + .1, T.w2 + 1.0) * (1 - sat(t, T.collapse - .2, T.collapse + .8));
    const door = sat(t, T.doorDone - .4, T.doorDone + .5) * (1 - sat(t, T.flash, T.flash + .3));
    const tint = bg.material.uniforms.uCol.value.setRGB(0, 0, 0);
    for (const [hex, k] of [[0x2a2f9a, w1 * .55], [0xc8321c, w2 * .5], [0x7a0e0a, door * .35], [0x3a3532, .16 * sat(t, T.rain0, T.rain0 + 1.2) * (1 - sat(t, T.reform - .2, T.reform + .6))]]) { tmpC.set(hex); tint.r += tmpC.r * k; tint.g += tmpC.g * k; tint.b += tmpC.b * k; }
    bg.material.uniforms.uAmt.value = 1;

    // lights
    const rimK = sat(t, T.rain0, T.rain0 + 1.4) * (1 - sat(t, T.reform - .2, T.reform + .8)) + portalAmt * .9;
    const flashK = Math.exp(-Math.max(0, t - T.strike) * 7) * (t >= T.strike ? 1 : 0), impactK = Math.exp(-Math.max(0, t - T.impact) * 8) * (t >= T.impact ? 1 : 0);
    const flash2 = Math.exp(-Math.abs(t - T.flash) * 5);
    st.rimA.intensity = 7 * rimK + 160 * flashK + 30 * impactK; st.rimB.intensity = 5 * rimK + 130 * flashK;
    st.glowLight.intensity = 16 * impactK + 220 * flashK + 40 * portalAmt + 90 * flash2;
    st.glowLight.position.set(t < T.doorDone ? .4 : 0, t < T.reform ? 2.0 : 2.4, t < T.reform ? 1.3 : (t < T.flash ? .6 : -2));
    st.key.intensity = 2.6 * (1 - w1 * .2);
    st.key.color.set(w2 > .3 ? 0xffe4c4 : 0xfff0dc);
    // post
    st.bloom.intensity = (1.0 + 1.6 * flashK + .9 * flash2 + .5 * impactK) * (1 - .8 * flatE);
    st.bloom.luminanceMaterial.threshold = lerp(.62, .97, flatE);
    st.vignette.darkness = .6;
    st.grain.blendMode.opacity.value = .14;
    st.aberration.offset.set(.0006 + .003 * flashK + .003 * flash2, .0009 + .004 * flashK + .003 * flash2);
    // a white flash on the strike and the passage
    whiteFlash = Math.max(.9 * Math.exp(-Math.max(0, t - T.strike) * 18) * (t >= T.strike && t < T.strike + .5 ? 1 : 0), 1.0 * Math.exp(-Math.abs(t - T.flash) * 10));
    composer.render();
    return {whiteFlash};
  }
  let whiteFlash = 0;
  // where the flat b sits on the canvas once the dolly zoom has finished (the end card's wordmark starts exactly there)
  function flatRect() {
    seek(T.hand);
    const p = (x, y) => { const v = new THREE.Vector3(x, y, BZ).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
    const a = p(-1.05, BFLAT_Y + 1.35), b = p(1.05, BFLAT_Y - 1.35);
    return {x0: a[0], y0: a[1], x1: b[0], y1: b[1]};
  }
  return {seek, flatRect, T, st, N, forms, get whiteFlash() { return whiteFlash; }, camera, formB: form.b2, BC, WORLD_C};
}
