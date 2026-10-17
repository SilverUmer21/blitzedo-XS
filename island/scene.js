import * as THREE from './assets/vendor/three.module.js';
import { createWorld } from './world.js?v=embers-13';
import { loadStoneTexture } from './stone.js?v=embers-13';
import { sculptureCamera, frameSculpture } from './composition.js?v=embers-13';

const container = document.querySelector('.hero__stage');
const canvas = document.querySelector('#sculpture-canvas');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const compact = matchMedia('(max-width: 760px)');
let renderer;
let frame = 0;
let failed = false;
let materialReady = false;
const errorNotice = document.querySelector('.scene-error');

function fallback() {
  failed = true;
  materialReady = false;
  if(errorNotice)errorNotice.hidden=false;
  cancelAnimationFrame(frame);
  container.classList.remove('is-3d-ready');
  renderer?.dispose();
}

try {
  renderer = new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.debug.onShaderError = () => { throw new Error('Sculpture shader compilation failed'); };
  renderer.setClearColor(0x020200,0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = false;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = sculptureCamera(1);
  // Reference materials own the same fixed lighting and color transform as the poster.
  // Keep the matching finished artwork visible until all model materials are ready.
  // Start downloading the textures before building the island, so the two overlap instead of queueing.
  const textures = loadStoneTexture();
  const model = createWorld();scene.add(model.world);
  let pixelRatio = Math.min(devicePixelRatio||1,compact.matches?1.5:2);
  const pointer = new THREE.Vector2();
  let visible=true, paused=reducedMotion.matches, last=0, elapsed=0, previous=performance.now();
  // Chip (keeper.js) lights the fuse in the browser; until it arrives the fuse stays unlit, and if it cannot load the
  // fuse cycles on its own as before.
  let keeper=null, keeperState=globalThis.location?'loading':'off', keeperClock=0;

  function resize() {
    if(failed)return;
    const {width,height}=container.getBoundingClientRect();
    if(!width||!height)return;
    renderer.setPixelRatio(pixelRatio);renderer.setSize(width,height,false);
    frameSculpture(camera,width/height);
    if(materialReady)renderer.render(scene,camera);
  }
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(container);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;},{threshold:.02}).observe(container);
  document.querySelector('.hero').addEventListener('pointermove',event=>{
    if(event.pointerType==='touch'||paused)return;
    const bounds=container.getBoundingClientRect();
    pointer.set(THREE.MathUtils.clamp((event.clientX-bounds.left)/bounds.width-.5,-.5,.5),THREE.MathUtils.clamp((event.clientY-bounds.top)/bounds.height-.5,-.5,.5));
  },{passive:true});
  document.querySelector('.hero').addEventListener('pointerleave',()=>pointer.set(0,0));
  function updateMotion() {
    if(paused)pointer.set(0,0);
  }
  reducedMotion.addEventListener('change',event=>{paused=event.matches;updateMotion();});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fallback();});
  resize();model.animate(0,!paused);updateMotion();
  let slowFrames=0,measured=0;
  const SETTLE=1.8;
  function tick(now) {
    frame=requestAnimationFrame(tick);
    const delta=Math.min((now-previous)/1000,.1);previous=now;
    if(!materialReady||document.hidden||!visible)return;
    if(!paused)elapsed+=delta;
    if(now-last < 16)return;
    last=now;
    if(paused && Math.abs(model.world.rotation.y)<.0001 && Math.abs(model.world.rotation.x)<.0001 && elapsed===0)return;
    let fuse=keeperState==='loading'?-100:undefined;
    if(keeper){try{fuse=keeper.update(elapsed-keeperClock);}catch(error){console.warn('Chip stopped.',error);keeper.dispose();keeper=null;keeperState='off';}}
    keeperClock=elapsed;
    model.animate(elapsed,!paused,fuse);
    // The float eases in from the loading artwork's exact pose rather than leaving it at full speed.
    const settle=Math.min(1,elapsed/SETTLE),ease=settle*settle*(3-2*settle);
    model.world.position.multiplyScalar(ease);model.world.rotation.z*=ease;
    model.world.rotation.y=THREE.MathUtils.lerp(model.world.rotation.y,paused?0:pointer.x*.10,.045);
    model.world.rotation.x=THREE.MathUtils.lerp(model.world.rotation.x,paused?0:pointer.y*.035,.045);
    if(paused)elapsed=0;
    const start=performance.now();
    try {renderer.render(scene,camera);} catch {fallback();return;}
    // Frame speed is judged only once the island has settled and Chip has arrived, so start-up work never lowers the resolution.
    if(!paused && elapsed>SETTLE+1.5 && keeperState!=='loading' && measured<90){measured++;if(performance.now()-start>24)slowFrames++;if(measured===90&&slowFrames>28){pixelRatio=Math.max(.85,pixelRatio*.7);resize();}}
  }
  frame=requestAnimationFrame(tick);
  textures.then(stoneMap=>{
    if(failed){stoneMap.dispose();return;}
    try {
      model.applyStoneTexture(stoneMap);
      materialReady=true;model.animate(0,!paused);
      renderer.render(scene,camera);
      container.classList.add('is-3d-ready');if(errorNotice)errorNotice.hidden=true;updateMotion();
      // ?tune opens the red tuning panel (development only).
      if(/[?&]tune\b/.test(globalThis.location?.search||''))import('./tuner.js').then(t=>t.mountTuner(model.world,()=>{if(materialReady)renderer.render(scene,camera);}));
      // Chip arrives once the float has settled and the page is idle, so the swap from the artwork stays smooth.
      if(keeperState==='loading')setTimeout(()=>(globalThis.requestIdleCallback||(f=>f()))(()=>import('./keeper.js').then(({createKeeper})=>{
        if(failed)return;
        keeper=createKeeper({world:model.world,stoneMap,camera,stage:container,still:paused});
        keeperState='on';keeperClock=elapsed;renderer.render(scene,camera);
      }).catch(error=>{console.warn('Chip could not load.',error);keeperState='off';}),{timeout:1200}),SETTLE*1000);
    } catch(error) {
      console.warn('The detailed sculpture material could not render.',error);
      fallback();
    }
  }).catch(error=>{
    console.warn('Sculpture materials could not load; preserving the finished artwork.',error);
    fallback();
  });
} catch(error) {
  console.warn('The live sculpture could not initialize; displaying the artwork fallback.',error);
  fallback();
}
