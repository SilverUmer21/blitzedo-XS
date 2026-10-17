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
 // Lossless WebP, pixel-identical to the extracted PNG atlases (exact mode keeps the edge mask's hidden colours), 40% smaller.
 const paths=['pixel-stone-v9.webp','pixel-red-v9.webp','pixel-edge-v9.webp'];
 const [map,red,edge]=await Promise.all(paths.map(p=>loader.loadAsync(new URL('./assets/'+p,import.meta.url).href)));
 for(const texture of [map,red,edge]){texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true;}
 for(const texture of [map,red,edge])texture.colorSpace=THREE.SRGBColorSpace;
 map.userData={red,edge};return map;
}

// Tessellate exposed stone faces and displace them into shallow angular plates.
// Geometry supplies the shallow angular relief; the atlas supplies fine pixel detail.
// view: optional direction the stone is seen from; triangles turned well away from it are left out (never visible).
export function fractureGeometry(source,outline,seed,view=null){
 const src=source.index?source.toNonIndexed():source,attrs=src.attributes;
 // Output is written into growable typed arrays (the same float32 values Float32BufferAttribute would make from plain arrays).
 let p=new Float32Array(9*4096),uv=new Float32Array(6*4096),count=0;
 const hash=(x,y,z)=>{const q=Math.sin(x*73.13+y*171.7+z*47.37+seed)*43758.5453;return q-Math.floor(q);};
 function height(a,b){
  const ix=Math.floor(a*7),iy=Math.floor(b*7),u=a*7-ix,v=b*7-iy;
  const aa=hash(ix,iy,1),bb=hash(ix+1,iy,1),cc=hash(ix,iy+1,1),dd=hash(ix+1,iy+1,1);
  const f=(aa*(1-u)+bb*u)*(1-v)+(cc*(1-u)+dd*u)*v;
  return (Math.round(f*5)/5-.5)*.012;
 }
 // A vertex is shared by about six triangles, so its relief height and its distance to the outline are worked out once.
 const heights=new Map(),fades=new Map(),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let drawn=true;
 const remember=(table,a,b,work)=>{let row=table.get(a);if(!row){row=new Map();table.set(a,row);}let value=row.get(b);if(value===undefined){value=work(a,b);row.set(b,value);}return value;};
 // The outline's edges, prepared once (same arithmetic as before, without re-deriving them for every vertex).
 const edges=outline.map((l,j)=>{const r=outline[(j+1)%outline.length],dx=r[0]-l[0],dy=r[1]-l[1];return [l[0],l[1],dx,dy,dx*dx+dy*dy];});
 const fadeAt=(q0,q1)=>{
  let edge=Infinity;
  for(let j=0;j<edges.length;j++){const [l0,l1,dx,dy,den]=edges[j],t=den?Math.max(0,Math.min(1,((q0-l0)*dx+(q1-l1)*dy)/den)):0;edge=Math.min(edge,Math.hypot(q0-l0-dx*t,q1-l1-dy*t));}
  return Math.min(1,edge/.055);
 };
 function emit(a,b,c,normal){
  const ax=Math.abs(normal[0]),ay=Math.abs(normal[1]),front=Math.abs(normal[2])>.7;
  if((count+3)*3>p.length){const P=new Float32Array(p.length*2),U=new Float32Array(uv.length*2);P.set(p);U.set(uv);p=P;uv=U;}
  for(let k=0;k<3;k++){
   const v=k===0?a:k===1?b:c,q0=v[0],q1=v[1],q2=v[2];
   const d=remember(heights,ax>.7?q2:q0,ay>.7?q2:q1,height);
   // Fade displacement around the projected front perimeter to preserve silhouette seams.
   const fade=front?remember(fades,q0,q1,fadeAt):1;
   const x=Math.fround(q0+normal[0]*d*fade),y=Math.fround(q1+normal[1]*d*fade),z=Math.fround(q2+normal[2]*d*fade);
   if(x<min[0])min[0]=x;if(y<min[1])min[1]=y;if(z<min[2])min[2]=z;if(x>max[0])max[0]=x;if(y>max[1])max[1]=y;if(z>max[2])max[2]=z;
   if(!drawn)continue;
   p[count*3]=x;p[count*3+1]=y;p[count*3+2]=z;
   uv[count*2]=v[3];uv[count*2+1]=v[4];count++;
  }
 }
 const dist=(x,y)=>(x[0]-y[0])**2+(x[1]-y[1])**2+(x[2]-y[2])**2;
 function split(a,b,c,normal,limit,depth=0){
  const ab=dist(a,b),bc=dist(b,c),ca=dist(c,a);
  if(Math.max(ab,bc,ca)<limit*limit||depth>10){emit(a,b,c,normal);return;}
  if(bc>=ab&&bc>=ca){const t=a;a=b;b=c;c=t;}else if(ca>=ab&&ca>=bc){const t=c;c=b;b=a;a=t;}
  const m=[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,(a[3]+b[3])/2,(a[4]+b[4])/2];split(a,m,c,normal,limit,depth+1);split(m,b,c,normal,limit,depth+1);
 }
 const normalAt=i=>[attrs.normal.getX(i),attrs.normal.getY(i),attrs.normal.getZ(i)];
 const corner=(i,j)=>[attrs.position.getX(i+j),attrs.position.getY(i+j),attrs.position.getZ(i+j),attrs.uv.getX(i+j),attrs.uv.getY(i+j)];
 function tessellate(i,normal){
  // Fine tessellation on principal faces, coarser on small edge bevels.
  const limit=Math.max(Math.abs(normal[0]),Math.abs(normal[1]),Math.abs(normal[2]))>.98?.145:.30;
  split(corner(i,0),corner(i,1),corner(i,2),normal,limit);
 }
 const hidden=[];
 for(let i=0;i<attrs.position.count;i+=3){
  const normal=normalAt(i);
  if(view&&normal[0]*view.x+normal[1]*view.y+normal[2]*view.z< -.4){hidden.push(i);continue;}
  tessellate(i,normal);
 }
 // Triangles turned away from the view are never seen, so they are not kept. They can still widen the stone's bounds
 // (which seed its pattern), so each is worked through for that alone, unless its corners, pushed as far as the relief
 // can move them, stay inside the bounds already found.
 drawn=false;
 for(const i of hidden){
  const normal=normalAt(i);
  let inside=true;
  for(let k=0;k<3&&inside;k++){
   const reach=.0061*Math.abs(normal[k]);
   for(let j=0;j<3;j++){const c=attrs.position.array[(i+j)*3+k];if(c-reach<min[k]||c+reach>max[k]){inside=false;break;}}
  }
  if(!inside)tessellate(i,normal);
 }
 const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.BufferAttribute(p.slice(0,count*3),3));result.setAttribute('uv',new THREE.BufferAttribute(uv.slice(0,count*2),2));result.computeVertexNormals();
 result.userData.bounds=new THREE.Box3(new THREE.Vector3(...min),new THREE.Vector3(...max));
 if(src!==source)src.dispose();source.dispose();return result;
}
