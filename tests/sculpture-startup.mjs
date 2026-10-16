import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from '../island/assets/vendor/three.module.js';
import {createWorld} from '../island/world.js';
import {sculptureCamera,frameSculpture} from '../island/composition.js';
const code=fs.readFileSync(new URL('../island/scene.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
function start({renderFails=false}={}){
  const classes=new Set(),notice={hidden:true},motion={hidden:true,firstElementChild:{},setAttribute(){},addEventListener(){}},canvas={addEventListener(){}};
  const art={classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)},getBoundingClientRect:()=>({width:710,height:842,left:0,top:0})};
  const hero={addEventListener(){}};
  const document={hidden:false,querySelector:q=>({'.hero__stage':art,'#sculpture-canvas':canvas,'.motion-toggle':motion,'.scene-error':notice,'.hero':hero}[q])};
  let resolve,reject,renders=0,applied=0;
  const pending=new Promise((a,b)=>{resolve=a;reject=b;});
  const model={world:new T.Group(),animate(){},applyStoneTexture(){applied++;}};
  class Renderer{constructor(){this.debug={};this.shadowMap={};}setClearColor(){}setPixelRatio(){}setSize(){}dispose(){}render(){if(renderFails)throw new Error('GPU failure');renders++;}}
  class Observer{observe(){}}
  const run=new Function('THREE','createWorld','loadStoneTexture','sculptureCamera','frameSculpture','document','matchMedia','ResizeObserver','IntersectionObserver','devicePixelRatio','requestAnimationFrame','cancelAnimationFrame','console',code);
  run({...T,WebGLRenderer:Renderer},()=>model,()=>pending,sculptureCamera,frameSculpture,document,()=>({matches:false,addEventListener(){}}),Observer,Observer,1,()=>1,()=>{}, {warn(){}});
  return {classes,notice,motion,resolve,reject,get renders(){return renders;},get applied(){return applied;}};
}
const stalled=start();assert(!stalled.classes.has('is-3d-ready'));assert.equal(stalled.renders,0);assert.equal(stalled.motion.hidden,true);
stalled.reject(new Error('texture fetch failed'));await Promise.resolve();await Promise.resolve();assert(!stalled.classes.has('is-3d-ready'));assert.equal(stalled.notice.hidden,false);
const loaded=start();loaded.resolve(new T.Texture());await Promise.resolve();await Promise.resolve();assert.equal(loaded.applied,1);assert(loaded.classes.has('is-3d-ready'));assert.equal(loaded.motion.hidden,false);assert(loaded.renders>0);
const broken=start({renderFails:true});broken.resolve(new T.Texture());await Promise.resolve();await Promise.resolve();assert(!broken.classes.has('is-3d-ready'));assert.equal(broken.notice.hidden,false);assert.equal(broken.motion.hidden,true);
const actual=createWorld();const texture=new T.Texture();assert(actual.applyStoneTexture(texture)>1);actual.world.traverse(o=>{if(o.isMesh&&o.material.map)assert.equal(o.material.map,texture);});
console.log('PASS: pending textures keep the finished artwork; failed textures expose retry; only the fully textured render is revealed; GPU failure keeps the artwork.');

// Distinct reference maps must reach their corresponding surfaces after async loading.
const atlas=new T.Texture();atlas.userData={red:new T.Texture(),edge:new T.Texture()};
assert(actual.applyStoneTexture(atlas)>1);
actual.world.traverse(o=>{
  if(!o.isMesh||!o.material.map)return;const m=o.material;
  assert.equal(m.map,['red','lining','contour'].includes(m.userData.kind)?atlas.userData.red:m.userData.kind==='edge'?atlas.userData.edge:atlas);
  assert.equal(m.uniforms.map.value,m.map);
  assert.equal(m.toneMapped,false,'Reference shader owns its fixed display transform');
});
console.log('PASS: stone, red and alpha edge atlases reach the live reference shaders.');

// Prevent reintroducing a poster made with different materials, geometry or lighting.
const manifest=JSON.parse(fs.readFileSync(new URL('../island/assets/sculpture-fallback-v13.render.json',import.meta.url)));
// The manifest was written in the source export (paths under dist/); its logo module and render tools were not ported here,
// as they do not change the sculpture's pixels. Every sculpture input must still match byte for byte.
for(const [path,expected]of Object.entries(manifest.inputs)){
  if(!path.startsWith('dist/')||path==='dist/brand-motion.js')continue;
  const data=fs.readFileSync(new URL('../island/'+path.slice(5),import.meta.url));
  assert.equal(createHash('sha256').update(data).digest('hex'),expected,`${path} changed: regenerate the poster with the runtime shaders`);
}
assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../island/assets/sculpture-fallback-v13.webp',import.meta.url))).digest('hex'),manifest.artworkSha256);
actual.animate(4.05,true);actual.world.traverse(o=>{if(o.isMesh&&o.material.uniforms?.motionTime){assert.equal(o.material.uniforms.motionTime.value,4.05);assert.equal(o.material.uniforms.motionEnabled.value,1);if(o.material.userData.kind==='stone')assert.equal(o.material.uniforms.pulseEnabled.value,0);}});
actual.animate(100,false);actual.world.traverse(o=>{if(o.isMesh&&o.material.uniforms?.motionTime){assert.equal(o.material.uniforms.motionTime.value,0);assert.equal(o.material.uniforms.motionEnabled.value,0);}});assert.equal(actual.world.position.y,0);
console.log('PASS: poster provenance matches; animation shares one clock; charcoal never enables the fuse; reduced motion restores the exact quiet frame.');
