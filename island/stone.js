import * as THREE from './assets/vendor/three.module.js';
import { referenceMaterial } from './reference-shading.js?v=embers-13';

// These maps are extracted from the user's close-ups by tools/extract-reference-materials.py.
// The finished artwork stays visible until these maps are ready.
export function stoneResources(){
 const bytes=new Uint8Array([151,151,151,255]),map=new THREE.DataTexture(bytes,1,1);
 map.colorSpace=THREE.SRGBColorSpace;map.needsUpdate=true;
 const edgePlaceholder=new THREE.DataTexture(new Uint8Array([0,0,0,0]),1,1);edgePlaceholder.needsUpdate=true;
 return {materials:{
  stone:referenceMaterial({map}),
  red:referenceMaterial({map,emissive:0xff0905,emissiveIntensity:.16}),
  edge:referenceMaterial({map:edgePlaceholder,alphaTest:.22,emissive:0xff1005,emissiveIntensity:.36,edgeAccent:.08,side:THREE.DoubleSide})
 }};
}
export async function loadStoneTexture(){
 const loader=new THREE.TextureLoader();
 const paths=['pixel-stone-v9.png','pixel-red-v9.png','pixel-edge-v9.png'];
 const [map,red,edge]=await Promise.all(paths.map(p=>loader.loadAsync(new URL('./assets/'+p,import.meta.url).href)));
 for(const texture of [map,red,edge]){texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true;}
 for(const texture of [map,red,edge])texture.colorSpace=THREE.SRGBColorSpace;
 map.userData={red,edge};return map;
}

// Tessellate exposed stone faces and displace them into shallow angular plates.
// Geometry supplies the shallow angular relief; the atlas supplies fine pixel detail.
export function fractureGeometry(source,outline,seed){
 const src=source.index?source.toNonIndexed():source,attrs=src.attributes;
 const p=[],n=[],uv=[];
 const hash=(x,y,z)=>{const q=Math.sin(x*73.13+y*171.7+z*47.37+seed)*43758.5453;return q-Math.floor(q);};
 function height(a,b){
  const ix=Math.floor(a*7),iy=Math.floor(b*7),u=a*7-ix,v=b*7-iy;
  const aa=hash(ix,iy,1),bb=hash(ix+1,iy,1),cc=hash(ix,iy+1,1),dd=hash(ix+1,iy+1,1);
  const f=(aa*(1-u)+bb*u)*(1-v)+(cc*(1-u)+dd*u)*v;
  return (Math.round(f*5)/5-.5)*.012;
 }
 function emit(a,b,c,normal){
  for(const v of [a,b,c]){
   const q=v.slice(0,3);const ax=Math.abs(normal[0]),ay=Math.abs(normal[1]);
   const aa=ax>.7?q[2]:q[0],bb=ay>.7?q[2]:q[1];
   const d=height(aa,bb);
   // Fade displacement around the projected front perimeter to preserve silhouette seams.
   let fade=1;
   if(Math.abs(normal[2])>.7){
    let edge=Infinity;
    for(let j=0;j<outline.length;j++){const l=outline[j],r=outline[(j+1)%outline.length],dx=r[0]-l[0],dy=r[1]-l[1],den=dx*dx+dy*dy,t=den?Math.max(0,Math.min(1,((q[0]-l[0])*dx+(q[1]-l[1])*dy)/den)):0;edge=Math.min(edge,Math.hypot(q[0]-l[0]-dx*t,q[1]-l[1]-dy*t));}
    fade=Math.min(1,edge/.055);
   }
   p.push(q[0]+normal[0]*d*fade,q[1]+normal[1]*d*fade,q[2]+normal[2]*d*fade);n.push(...normal);uv.push(v[3],v[4]);
  }
 }
 function split(a,b,c,normal,depth=0){
  const dist=(x,y)=>(x[0]-y[0])**2+(x[1]-y[1])**2+(x[2]-y[2])**2;
  const ab=dist(a,b),bc=dist(b,c),ca=dist(c,a);
  // Fine tessellation on principal faces, coarser on small edge bevels.
  const limit=Math.max(...normal.map(Math.abs))>.98?.145:.30;
  if(Math.max(ab,bc,ca)<limit*limit||depth>10){emit(a,b,c,normal);return;}
  if(bc>=ab&&bc>=ca)[a,b,c]=[b,c,a];else if(ca>=ab&&ca>=bc)[a,b,c]=[c,a,b];
  const m=a.map((q,i)=>(q+b[i])/2);split(a,m,c,normal,depth+1);split(m,b,c,normal,depth+1);
 }
 for(let i=0;i<attrs.position.count;i+=3){
  const vertices=[0,1,2].map(j=>[attrs.position.getX(i+j),attrs.position.getY(i+j),attrs.position.getZ(i+j),attrs.uv.getX(i+j),attrs.uv.getY(i+j)]);
  const normal=[attrs.normal.getX(i),attrs.normal.getY(i),attrs.normal.getZ(i)];split(...vertices,normal);
 }
 const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(p,3));result.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));result.computeVertexNormals();
 if(src!==source)src.dispose();source.dispose();return result;
}
