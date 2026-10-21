// The 3D stage: glossy bevelled cubes under a studio environment, a tiled glass-black floor, and a cinematic post chain.
// Everything is a pure function of time (no incremental simulation) so any frame can be rendered or sought.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {EffectComposer, RenderPass, EffectPass, BloomEffect, VignetteEffect, NoiseEffect, ChromaticAberrationEffect,
  DepthOfFieldEffect, ToneMappingEffect, ToneMappingMode, BlendFunction, KernelSize} from 'postprocessing';
import {PAL, mixHex, rng} from './shapes.js';

export const W = 1080, H = 1920;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
export const ease = {
  inOut: x => x < .5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2,
  out: x => 1 - (1 - x) ** 3,
  in: x => x * x * x,
  outBack: x => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; },
  inOutQuint: x => x < .5 ? 16 * x ** 5 : 1 - (-2 * x + 2) ** 5 / 2,
  linear: x => x
};

// Cubes carry two extra per-instance numbers: heat (red glow) and a flat flag is a global uniform (see film.js).
function litMaterial(heatColor) {
  const m = new THREE.MeshPhysicalMaterial({color: 0xffffff, roughness: .26, metalness: .22, clearcoat: .6, clearcoatRoughness: .18, envMapIntensity: 1.15});
  m.userData.uniforms = {uFlat: {value: 0}, uHeatColor: {value: new THREE.Color(heatColor)}, uGlow: {value: 1}};
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, m.userData.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aHeat;\nvarying float vHeat;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHeat = aHeat;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vHeat;\nuniform float uFlat;\nuniform vec3 uHeatColor;\nuniform float uGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uHeatColor * vHeat * uGlow;')
      .replace('#include <opaque_fragment>', 'outgoingLight = mix(outgoingLight, diffuseColor.rgb, uFlat);\n#include <opaque_fragment>');
  };
  return m;
}

// A black studio with a few big softboxes: what the glossy cubes reflect (gives bevels and flat faces their sheen).
function studioEnv() {
  const room = new THREE.Scene();
  const box = new THREE.Mesh(new THREE.BoxGeometry(60, 40, 60), new THREE.MeshBasicMaterial({color: 0x040404, side: THREE.BackSide}));
  room.add(box);
  const panel = (w, h, pos, look, color, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide, toneMapped: false}));
    m.position.set(...pos); m.lookAt(...look); room.add(m);
  };
  panel(22, 10, [4, 17, 6], [0, 0, 0], 0xfff1e0, 9);             // big warm top softbox
  panel(4, 24, [-17, 6, 4], [0, 2, 0], 0xcfdcff, 5);              // cool strip, left
  panel(3, 22, [16, 5, -2], [0, 2, 0], 0xffffff, 6);              // white strip, right
  panel(26, 3, [0, 4, -20], [0, 2, 0], 0xffffff, 3);              // white strip behind (rim reflections)
  panel(18, 18, [-9, 7, 17], [0, 1.5, 0], 0xfff6ea, 2.6);          // front-left key softbox: lights the front faces
  panel(14, 6, [0, 2, 22], [0, 2, 0], 0xffe8d0, 1.6);             // soft front fill
  return room;
}

export function createStage(canvas, {scale = 1} = {}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true});
  renderer.setPixelRatio(scale);
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAL.bg);
  scene.fog = new THREE.FogExp2(PAL.bg, .05);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studioEnv(), .02).texture;
  scene.environmentIntensity = 1.0;

  const camera = new THREE.PerspectiveCamera(28, W / H, .1, 200);
  camera.position.set(0, 2, 12);

  // lights: a warm key with shadow, a cool-ish fill, and red rim lights that the film drives
  const key = new THREE.DirectionalLight(0xfff0dc, 2.2);
  key.position.set(5, 9, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, {left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30});
  key.shadow.bias = -.0004; key.shadow.normalBias = .02; key.shadow.radius = 3;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0x8aa0ff, .35); fill.position.set(-6, 3, 4); scene.add(fill);
  const rimA = new THREE.PointLight(0xff2a18, 0, 14, 1.6); rimA.position.set(-3.2, 2.2, -2.5); scene.add(rimA);
  const rimB = new THREE.PointLight(0xff3a22, 0, 14, 1.6); rimB.position.set(3.4, 1.6, -2.2); scene.add(rimB);
  const glowLight = new THREE.PointLight(0xff3a22, 0, 12, 1.5); glowLight.position.set(0, 1.2, 1.4); scene.add(glowLight);

  // floor: a lattice of glossy dark tiles (the 3D version of the 30 px grid) that can heave and glow
  const TILE = .5, GAP = .045, FX = 33, FZ = 55;
  const tileGeo = new RoundedBoxGeometry(TILE - GAP, .08, TILE - GAP, 1, .02);
  const tileMat = litMaterial(PAL.red); tileMat.roughness = .2; tileMat.metalness = .45; tileMat.color.set(0x0c0d10); tileMat.transparent = true; tileMat.opacity = .78; tileMat.clearcoat = .6; tileMat.envMap = scene.environment; tileMat.envMapIntensity = .1;
  const tiles = new THREE.InstancedMesh(tileGeo, tileMat, FX * FZ);
  tiles.castShadow = false; tiles.receiveShadow = true; tiles.frustumCulled = false;
  const tileHeat = new Float32Array(FX * FZ);
  tileGeo.setAttribute('aHeat', new THREE.InstancedBufferAttribute(tileHeat, 1).setUsage(THREE.DynamicDrawUsage));
  const tileBase = [];
  for (let iz = 0; iz < FZ; iz++) for (let ix = 0; ix < FX; ix++) tileBase.push([(ix - (FX - 1) / 2) * TILE, (iz - (FZ - 1) / 2) * TILE - 6]);
  scene.add(tiles);

  // cubes
  const cubeGeo = new RoundedBoxGeometry(1, 1, 1, 1, .09);
  const cubeMat = litMaterial(PAL.red);
  let pool = null;

  function makePool(N) {
    cubeGeo.setAttribute('aHeat', new THREE.InstancedBufferAttribute(new Float32Array(N), 1).setUsage(THREE.DynamicDrawUsage));
    const mesh = new THREE.InstancedMesh(cubeGeo, cubeMat, N);
    const mirrorMat = cubeMat.clone(); mirrorMat.transparent = true; mirrorMat.opacity = .34; mirrorMat.depthWrite = false; mirrorMat.onBeforeCompile = cubeMat.onBeforeCompile; mirrorMat.userData = cubeMat.userData;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    const mirror = new THREE.InstancedMesh(cubeGeo, mirrorMat, N);
    mirror.instanceMatrix = mesh.instanceMatrix; mirror.instanceColor = mesh.instanceColor;
    mirror.scale.y = -1; mirror.frustumCulled = false; mirror.castShadow = false; mirror.receiveShadow = false; mirror.renderOrder = -1;
    scene.add(mirror);
    pool = {mesh, mirror, N, heat: cubeGeo.attributes.aHeat};
    return pool;
  }

  // extra emissive things (portal, bolt, sparks) are added by film.js through `scene`
  // post chain
  const composer = new EffectComposer(renderer, {multisampling: 0, frameBufferType: THREE.HalfFloatType});
  composer.addPass(new RenderPass(scene, camera));
  const dof = new DepthOfFieldEffect(camera, {worldFocusDistance: 12, worldFocusRange: 6, bokehScale: 0, resolutionScale: .5});
  const bloom = new BloomEffect({intensity: 1.25, luminanceThreshold: .62, luminanceSmoothing: .25, mipmapBlur: true, radius: .72, levels: 7});
  const aberration = new ChromaticAberrationEffect({offset: new THREE.Vector2(.0006, .0009), radialModulation: true, modulationOffset: .25});
  const vignette = new VignetteEffect({offset: .28, darkness: .62});
  const grain = new NoiseEffect({blendFunction: BlendFunction.OVERLAY, premultiply: true}); grain.blendMode.opacity.value = .16;
  const tone = new ToneMappingEffect({mode: ToneMappingMode.NEUTRAL});
  composer.addPass(new EffectPass(camera, dof, bloom, aberration, tone, vignette, grain));
  composer.setSize(W, H, false);

  return {renderer, scene, camera, composer, key, fill, rimA, rimB, glowLight, tiles, tileBase, tileHeat, tileGeo, FX, FZ, TILE,
    cubeMat, tileMat, dof, bloom, aberration, vignette, grain, makePool, get pool() { return pool; }, THREE};
}
