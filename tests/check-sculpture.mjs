import assert from 'node:assert/strict';
import * as T from '../island/assets/vendor/three.module.js';
import {createWorld} from '../island/world.js';
const {world,animate}=createWorld();
const camera=new T.OrthographicCamera(-13.3*(710/842)/2-.4,13.3*(710/842)/2-.4,13.3/2-.15,-13.3/2-.15,.1,90);
camera.position.set(14.2,10.4,19);camera.lookAt(0,1.65,0);camera.updateMatrixWorld();
let triangles=0,meshes=0;
world.traverse(o=>{if(!o.isMesh)return;meshes++;const a=o.geometry.attributes;triangles+=(o.geometry.index?o.geometry.index.count:a.position.count)/3;for(const [name,attribute]of Object.entries(a)){for(const value of attribute.array)assert(Number.isFinite(value),`Non-finite ${name}`);}});
let worst=0;
for(const time of [0,1.65,4.95])for(const x of [-.0175,0,.0175])for(const y of [-.05,0,.05]){
 world.rotation.set(x,y,0);animate(time,true);world.updateMatrixWorld(true);
 world.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position;
  for(let i=0;i<a.count;i++){const p=new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld).project(camera);worst=Math.max(worst,Math.abs(p.x),Math.abs(p.y));}
 });
}
assert(worst<.99,`Sculpture clips at motion extreme: ${worst}`);
assert(meshes<15,`Too many render meshes: ${meshes}`);
console.log(`PASS: ${triangles} triangles, ${meshes} meshes; finite attributes; all pointer-motion extremes inside frame (${worst.toFixed(3)} NDC).`);
