import * as THREE from './assets/vendor/three.module.js';
import { fuseRoute, floatingPose, fusePhase } from './fuse.js?v=embers-13';
import { stoneResources, fractureGeometry } from './stone.js?v=embers-13';
import { VIEW_DIRECTION } from './composition.js?v=embers-13';
import { referenceMaterial, prepareReferenceFaces, portalVertex, portalFragment } from './reference-shading.js?v=embers-13';

// Stone is laid in varying courses, with a carved outline rather than a voxel mask.
export function createWorld({shadows = true, stoneMap = null} = {}) {
  let seed=82719;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const world=new THREE.Group(), batches=new Map(), debris=[];
  // The island is stretched by this scale (set on the world at the end), so the camera's direction is taken into its space
  // to tell which faces are turned away from it.
  const scale=[1.3,.94,1.35];
  const view=new THREE.Vector3(VIEW_DIRECTION.x/scale[0],VIEW_DIRECTION.y/scale[1],VIEW_DIRECTION.z/scale[2]).normalize();
  const {materials}=stoneResources({albedo:stoneMap});
  const dark=materials.stone, red=materials.red;
  dark.userData.kind='stone';red.userData.kind='red';materials.edge.userData.kind='edge';
  let stoneCount=0;
  const edgeGeometries=[];
  const edgeRed=materials.edge;
  const rimFaces=[];
  // Duplicate only the actual outward capstone faces. The shader cuts a sparse,
  // square-edged lip and corner into these surfaces, so it follows every chip.
  // This does not consume the masonry RNG or alter any approved stone geometry.
  function rimContour(geometry,x,y,z,w,h,d,key){
    const g=geometry.index?geometry.toNonIndexed():geometry,a=g.attributes;
    const route=fuseRoute({x,y,z},'contour');
    for(let i=0;i<a.position.count;i+=3){
      const nx=(a.normal.getX(i)+a.normal.getX(i+1)+a.normal.getX(i+2))/3;
      const nz=(a.normal.getZ(i)+a.normal.getZ(i+1)+a.normal.getZ(i+2))/3;
      const ny=(a.normal.getY(i)+a.normal.getY(i+1)+a.normal.getY(i+2))/3;
      if((nx<.5&&nz<.5)||ny>.75||ny<-.75)continue;
      for(let j=0;j<3;j++){
        const k=i+j,px=a.position.getX(k),py=a.position.getY(k),pz=a.position.getZ(k);
        const normal=[a.normal.getX(k),a.normal.getY(k),a.normal.getZ(k)];
        const u=THREE.MathUtils.clamp(nx>.5?(pz-z+d/2)/d:(px-x+w/2)/w,0,1);
        const v=THREE.MathUtils.clamp((y+h/2-py)/h,0,1),tile=key%8;
        rimFaces.push({p:[px+normal[0]*.0015,py+normal[1]*.0015,pz+normal[2]*.0015],n:normal,
          uv:[((tile%4)+.03125+u*.9375)/4,1-(Math.floor(tile/4)+.03125+v*.9375)/4],rimUV:[u,v],key,route});
      }
    }
    if(g!==geometry)g.dispose();
  }
  const swatches=Array.from({length:7},(_,i)=>new THREE.Color(0x82817d).multiplyScalar(.85+i*.035));
  // Faces are written straight into typed buffers per material (no per-face objects or arrays): the same bytes, built
  // several times faster, which is most of the island's start-up time. Buffers are filled in chunks and joined once.
  function batchFor(material,faces){
    let chunks=batches.get(material);
    if(!chunks){chunks=[];batches.set(material,chunks);}
    let b=chunks[chunks.length-1];
    if(!b||(b.faces+faces)*9>b.position.length){
      const size=Math.max(16384,faces);
      b={position:new Float32Array(9*size),normal:new Float32Array(9*size),color:new Float32Array(9*size),uv:new Float32Array(6*size),pulseRoute:new Float32Array(6*size),faces:0};
      chunks.push(b);
    }
    return b;
  }
  // Whether a triangle, by its winding (what the GPU culls by; some stored normals predate later vertex edits), is turned
  // well away from the camera. Slivers are always kept: their winding is too fine to call the same way the GPU does.
  const SLIVER=1e-4;
  const turnedAway=(P,o)=>{
    const ux=P[o+3]-P[o],uy=P[o+4]-P[o+1],uz=P[o+5]-P[o+2],vx=P[o+6]-P[o],vy=P[o+7]-P[o+1],vz=P[o+8]-P[o+2];
    const cx=uy*vz-uz*vy,cy=uz*vx-ux*vz,cz=ux*vy-uy*vx;
    const length=Math.sqrt(cx*cx+cy*cy+cz*cz);
    return length>SLIVER&&cx*view.x+cy*view.y+cz*view.z< -.2*length;
  };
  function add(geometry,material=dark,shade=null,tint=1) {
    if(geometry.index){const source=geometry;geometry=source.toNonIndexed();source.dispose();}
    const shadeColor=shade||swatches[Math.floor(rand()*swatches.length)];
    const tile=Math.floor(rand()*16),redTile=Math.floor(rand()*8);
    // Fractured stone brings the bounds of all its faces, including the ones left out as never visible.
    const bounds=geometry.userData.bounds;
    geometry.userData={tile};
    const attrs=geometry.attributes;
    if(!bounds)geometry.computeBoundingBox();
    const center=(bounds||geometry.boundingBox).getCenter(new THREE.Vector3());
    const route=fuseRoute(center,'red');
    const redColor=new THREE.Color(0xffffff).multiplyScalar(.94*tint);
    const P=attrs.position.array,N=attrs.normal.array,U=attrs.uv.array,faces=attrs.position.count/3;
    const darkBatch=batchFor(dark,faces),redBatch=material===red?batchFor(red,faces):null;
    // Red stone marks the exposed tread/crown. Its vertical face stays charcoal.
    for(let i=0;i<attrs.position.count;i+=3){
      // Faces turned away from the camera are never drawn (single-sided stone, fixed view): leave them out.
      if(turnedAway(P,i*3))continue;
      const top=(N[i*3+1]+N[i*3+4]+N[i*3+7])/3>.58;
      const faceMaterial=material===red&&top?red:dark;
      const color=faceMaterial===red?redColor:shadeColor;
      // Static faces are merged into two draw calls below.
      const b=faceMaterial===red?redBatch:darkBatch,f9=b.faces*9,f6=b.faces*6;
      const faceTile=faceMaterial===red?redTile:tile;
      const col=faceTile%4,row=Math.floor(faceTile/4),span=faceMaterial === red ? .9375 : .62;
      for(let j=0;j<9;j++){b.position[f9+j]=P[i*3+j];b.normal[f9+j]=N[i*3+j];}
      for(let j=0;j<3;j++){b.color[f9+j*3]=color.r;b.color[f9+j*3+1]=color.g;b.color[f9+j*3+2]=color.b;b.pulseRoute[f6+j*2]=route[0];b.pulseRoute[f6+j*2+1]=route[1];}
      for(let j=0;j<6;j++){const v=U[i*2+j];b.uv[f6+j]=j%2===0?(col+(v-Math.floor(v))*span+.03125)/4:1-(row+(v-Math.floor(v))*span+.03125)/4;}
      b.faces++;
    }
    geometry.dispose();stoneCount++;
  }
  function polygon(points,z,depth,material=dark,bevel=.006,tint=1){
    if(points.length<3)return;
    // Remove redundant edge vertices, then notch occasional edges into broken stone.
    const clean=points.filter((p,i)=>{const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length];return Math.abs((p[0]-a[0])*(b[1]-p[1])-(p[1]-a[1])*(b[0]-p[0]))>.000005;});
    if(clean.length<3)return;
    const chipped=[];
    for(let i=0;i<clean.length;i++){
      const a=clean[i],b=clean[(i+1)%clean.length],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);chipped.push(a);
      if(len>.35&&rand()<.46){
        const t=.28+rand()*.4,w=Math.min(.11,len*.16),inset=.015+rand()*.025;
        for(const [at,dep]of [[t-w/len,0],[t-w/len,inset],[t,inset*.7],[t,0]])chipped.push([a[0]+dx*at-dy/len*dep,a[1]+dy*at+dx/len*dep]);
      }
    }
    const shape=new THREE.Shape();shape.moveTo(...chipped[0]);for(let i=1;i<chipped.length;i++)shape.lineTo(...chipped[i]);shape.closePath();
    let g=new THREE.ExtrudeGeometry(shape,{depth:depth-2*bevel,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:1,curveSegments:1,steps:1});
    g.translate(0,0,z+bevel);
    const uv=g.attributes.uv,pos=g.attributes.position,norm=g.attributes.normal;
    const bounds=new THREE.Box3().setFromBufferAttribute(pos),size=bounds.getSize(new THREE.Vector3());
    for(let i=0;i<uv.count;i++){
      const x=(pos.getX(i)-bounds.min.x)/Math.max(size.x,.001),y=(pos.getY(i)-bounds.min.y)/Math.max(size.y,.001),zz=(pos.getZ(i)-bounds.min.z)/Math.max(size.z,.001);
      const nx=Math.abs(norm.getX(i)),ny=Math.abs(norm.getY(i));
      uv.setXY(i,(nx>.7?zz:x)*.999,(ny>.7?zz:y)*.999);
    }
    // Only primary exposed masonry receives dense relief; island fragments retain crisp cuts.
    if(depth>.7&&size.y>.40)g=fractureGeometry(g,chipped,Math.floor(rand()*10000),view);
    add(g,material,null,tint);return g;
  }
  function slab(x,y,z,w,h,d,material=dark,chip=.023,tint=1){
    const a=chip*(.5+rand()),b=chip*(.5+rand());
    const pts=[[x-w/2+a,y-h/2],[x+w/2-b,y-h/2],[x+w/2,y-h/2+b],[x+w/2,y+h/2-a],[x+w/2-a,y+h/2],[x-w/2+b,y+h/2],[x-w/2,y+h/2-b],[x-w/2,y-h/2+a]];
    return polygon(pts,z-d/2,d,material,Math.min(.006,w*.015,h*.015),tint);
  }
  // Front-elevation silhouette measured from the supplied hero and close-ups.
  // A flat crown, tight stepped shoulder, broad upright and a small lower corner.
  const left=-2.05,stemRight=-.58,front=.62,back=-.48;
  const crown=4.64,shoulder=1.12,outerRight=2.42;
  const step=.075;
  const snap=x=>Math.round(x/step)*step;
  function outer(y){
    if(y>crown+.001)return stemRight;
    if(y>crown-shoulder)return snap(outerRight-shoulder+Math.sqrt(Math.max(0,shoulder**2-(y-(crown-shoulder))**2)));
    if(y<.82)return snap(outerRight-.72+Math.sqrt(Math.max(0,.72**2-(y-.82)**2)));
    return outerRight;
  }
  const center=.61,half=.70,sill=.48,spring=2.55,archTop=spring+half;
  function hole(y){return y<spring?half:snap(Math.sqrt(Math.max(0,half**2-(y-spring)**2)));}
  const rows=[.06,.48,1.13,1.82,2.55,3.25,3.92,4.64,5.60,6.60,7.58];
  for(let row=0;row<rows.length-1;row++){
    const y0=rows[row]+.004,y1=rows[row+1]-.004,ym=(y0+y1)/2;
    const nicheCenter=left+.43;
    const nicheWidth=y=>y<4.15||y>4.59?0:y<4.45?.14:Math.sqrt(Math.max(0,.14**2-(y-4.45)**2));
    const spans=ym>4.0&&ym<4.64?[[()=>left,y=>nicheCenter-nicheWidth(y)],[y=>nicheCenter+nicheWidth(y),outer]]:ym>sill&&ym<archTop?[[()=>left,y=>center-hole(y)],[y=>center+hole(y),outer]]:[[()=>left,outer]];
    for(const [lo,hi]of spans){
      let x=lo(ym),end=Math.max(hi(y0),hi(y1),hi(ym));
      while(x<end-.025){
        let width=.58+rand()*.40;if(end-x<width+.30)width=end-x;
        const a=x+.004,b=x+width-.004,right=[],leftSide=[];
        // Keep the tiny pixel steps on arches and the shoulder, rather than smoothing them.
        const count=Math.ceil((y1-y0)/step);
        for(let k=0;k<count;k++){
          const y=y0+(y1-y0)*k/count,yn=y0+(y1-y0)*(k+1)/count;
          const low=Math.max(a,lo((y+yn)/2)),high=Math.min(b,hi((y+yn)/2));
          if(high-low>.003){right.push([high,y],[high,yn]);leftSide.push([low,y],[low,yn]);}
        }
        if(right.length>=4){
          const isCrown=row===rows.length-2||row===6&&x>stemRight;
          polygon([...right,...leftSide.reverse()],back+(rand()-.5)*.016,front-back,isCrown&&rand()<.57?red:dark);
        }
        x+=width;
      }
    }
  }
  // Crown accents are broad tile groups, placed deliberately along exposed edges.
  for(const [x,z,w,d]of [[-1.69,-.21,.70,.53],[-1.69,.34,.70,.53],[-.96,-.21,.70,.53]])
    slab(x,7.584,z,w,.028,d,red,.012);
  for(const [x,z,w,d]of [[-.21,-.21,.68,.53],[.49,.34,.68,.53],[1.12,-.21,.54,.53]])
    slab(x,4.644,z,w,.028,d,red,.012);
  // Two larger lit facets turn over the shoulder; the front remains charcoal.
  for(let i=0;i<5;i++){
    const y=4.56-i*.105,x=outer(y)-.045;
    slab(x,y+.014,-.20,.13,.028,.53,red,.008);
  }
  // Reference-derived edge masks create broken red zones anchored to real edges.
  function wearPlane(x,y,z,w,h,side=false,tile=0){
    const g=new THREE.PlaneGeometry(w,h),uv=g.attributes.uv;
    const route=fuseRoute({x,y,z},'edge');
    g.setAttribute('pulseRoute',new THREE.Float32BufferAttribute(Array.from({length:g.attributes.position.count},()=>route).flat(),2));
    for(let i=0;i<uv.count;i++)uv.setXY(i,((tile%4)+.03125+uv.getX(i)*.9375)/4,1-(Math.floor(tile/4)+.03125+(1-uv.getY(i))*.9375)/4);
    if(side)g.rotateY(Math.PI/2);g.translate(x,y,z);edgeGeometries.push(g);
  }
  for(let row=0;row<rows.length-1;row++){
    const y0=rows[row],h=rows[row+1]-y0;
    wearPlane(left+.13,y0+h*.50,front+.018,.28,h*.97,false,row%2);
    if(y0>=4.64)wearPlane(stemRight+.018,y0+h*.50,back+.14,.30,h*.98,true,2+row%2);
  }
  for(let row=0;row<6;row++){
    const y=.47+row*.57;
    wearPlane(outer(y)+.016,y,back+.13,.31,.57,true,3+row%2);
  }

  // L staircase: four treads come around the stem; eight descend across its front.
  // Every tread has a solid masonry support laid in medium-sized courses.
  function stairColumn(x,z,w,d,top){
    const courses=Math.max(1,Math.round(top/.55)),h=(top-.08)/courses;
    for(let j=0;j<courses;j++)slab(x,.08+(j+.5)*h,z,w-.012,h-.014,d-.014,dark,.022);
    // The light climbs the stairs: lower treads are dimmer, the top ones full red (tuned by eye, climb 0.87).
    const climb=THREE.MathUtils.clamp((top+.0625-.6)/3.6,0,1);
    slab(x,top+.025,z,w+.018,.075,d+.02,red,.015,1-.87*.75*(1-climb));
  }
  const turnZ=1.46,turnX=-1.93;
  for(let i=0;i<4;i++)stairColumn(turnX,.63+i*.28,.74,.29,4.14-i*.36);
  for(let i=0;i<8;i++)stairColumn(turnX+i*.32,turnZ,.33,.74,3.06-i*.36);

  // Fractured floating island: coarse capstones, coherent descending columns,
  // then smaller broken ends. No cloud of evenly sized cubes below the platform.
  const nx=9,nz=6,cellX=.76,cellZ=.66;
  const depths=[
    [.85,1.05,1.6,1.25,2.1,1.65,1.05,.8,.6],
    [1.3,1.8,2.35,1.65,2.5,2.15,1.7,1.3,.9],
    [1.7,2.35,2.85,2.35,3.0,2.65,2.05,1.7,1.3],
    [1.25,1.65,2.05,2.65,2.3,3.15,2.45,1.8,1.5],
    [1.0,1.45,2.1,1.6,2.65,2.15,2.85,1.65,1.05],
    [.65,1.2,1.55,2.05,1.75,2.65,1.85,1.15,.8]
  ];
  for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){
    if((ix===0||ix===nx-1)&&(iz===0||iz===nz-1))continue;
    const x=(ix-(nx-1)/2)*cellX,z=(iz-(nz-1)/2)*cellZ+.08;
    // Red caps form grouped perimeter runs, not random illuminated speckles.
    const perimeter=ix===0||ix===nx-1||iz===0||iz===nz-1;
    const accent=perimeter&&((ix+2*iz)%5<2)||iz===0&&ix>1&&ix<5;
    const capY=-.14+(rand()-.5)*.018;
    const cap=slab(x,capY,z,cellX-.025,.35,cellZ-.025,accent?red:dark,.038);
    if(accent&&perimeter)rimContour(cap,x,capY,z,cellX-.025,.35,cellZ-.025,ix+iz*3);
    let level=-.32,remaining=depths[iz][ix],layer=0;
    while(remaining>.075){
      const h=Math.min(remaining,.23+rand()*.25),t=remaining/depths[iz][ix],scale=.20+.77*Math.pow(t,.58);
      const driftX=(rand()-.5)*.14,driftZ=(rand()-.5)*.11;
      const pieces=perimeter?2:1;
      for(let sx=0;sx<pieces;sx++)for(let sz=0;sz<pieces;sz++){
        const w=cellX*scale/pieces-.012,d=cellZ*scale/pieces-.012;
        const px=x+(sx-(pieces-1)/2)*(w+.014)+driftX,pz=z+(sz-(pieces-1)/2)*(d+.014)+driftZ;
        const ph=h*(.82+rand()*.22),py=level-h/2+(rand()-.5)*.06;
        const stone=slab(px,py,pz,w,ph,d,dark,.026);
        if(accent&&perimeter&&layer<2&&sz===pieces-1&&sx===(ix%2?0:pieces-1))rimContour(stone,px,py,pz,w,ph,d,100+ix+iz*3);
        // Broader, irregular red wear is connected to exposed sides, especially the tips.
        if(perimeter&&remaining<.75&&sx===0&&sz===pieces-1&&((ix+iz)%3!==1))
          wearPlane(px-w*.32,py,pz+d/2+.012,w*.38,ph,false,5+(ix+iz)%3);
      }
      remaining-=h;level-=h;layer++;
    }
    if(perimeter){
      const tip=.15+rand()*.07;
      slab(x-.045,level-.075,z+.03,tip,.16,tip*.85,dark,.016);
      if((ix+iz)%2===0)slab(x-.03,level-.20,z+.03,tip*.60,.10,tip*.55,dark,.012);
    }

  }

  // Half-depth capstones extend the island's rim without resizing its existing blocks.
  function rimChunk(x,z,w,d,depth,accent){
    const key=Math.abs(Math.round(x*7+z*13));
    const cap=slab(x,-.155,z,w-.012,.32,d-.012,accent?red:dark,.040);
    if(accent)rimContour(cap,x,-.155,z,w-.012,.32,d-.012,key);
    let level=-.315,remaining=depth,course=0;
    while(remaining>.06){
      const h=Math.min(remaining,.26+rand()*.13),t=remaining/depth,scale=.30+.69*Math.pow(t,.55);
      const px=x+(rand()-.5)*.035,pz=z+(rand()-.5)*.035;
      const stone=slab(px,level-h/2,pz,w*scale,h-.012,d*scale,dark,.027);
      if(accent&&course<2)rimContour(stone,px,level-h/2,pz,w*scale,h-.012,d*scale,100+key);
      if(course>1&&accent)wearPlane(x-w*scale*.27,level-h/2,z+d*scale/2+.012,w*scale*.40,h*.85,false,5+course%3);
      level-=h;remaining-=h;course++;
    }
  }
  for(const ix of [1,2,4,5,7])rimChunk((ix-4)*cellX,2.20,.74,.28,.65+[.4,.85,.25,1.05,.55][[1,2,4,5,7].indexOf(ix)],ix===1||ix===2||ix===5);
  for(const side of [-1,1])for(const iz of [1,2,3,4]){
    const accent=side<0?iz<3:iz>2;
    rimChunk(side*3.58,(iz-2.5)*cellZ+.08,.32,.63,.65+iz*.14,accent);
  }
  for(const ix of [2,3,6])rimChunk((ix-4)*cellX,-2.02,.74,.24,.72,ix===2||ix===3);

  // Sparse satellites repeat the taper of the island; their crowns carry the red.
  const fragments=[[-3.05,-1.9,2.55,.44],[3.55,-1.65,.8,.28],[1.22,-3.75,2.05,.38],[-1.2,-3.12,2.0,.43],[3.0,-2.6,2.3,.29]];
  for(const [x,y,z,s]of fragments){
    for(let j=0;j<3;j++)slab(x+j*.015,y-j*s*.6,z,s*(1-j*.24),s*.62,s*(1-j*.25),j===0?red:dark,.022);
  }

  // Two merged masonry meshes plus the grouped edge surfaces.
  for(const [material,chunks]of batches){
    const merged=new THREE.BufferGeometry(),faces=chunks.reduce((n,b)=>n+b.faces,0);
    for(const name of ['position','normal','uv','color','pulseRoute']){
      const itemSize=['uv','pulseRoute'].includes(name)?2:3,array=new Float32Array(faces*3*itemSize);let offset=0;
      for(const b of chunks){array.set(b[name].subarray(0,b.faces*3*itemSize),offset);offset+=b.faces*3*itemSize;}
      merged.setAttribute(name,new THREE.BufferAttribute(array,itemSize));
    }
    const mesh=new THREE.Mesh(merged,material);mesh.castShadow=shadows;mesh.receiveShadow=shadows;world.add(mesh);
  }
  for(let i=0;i<edgeGeometries.length;i++)if(edgeGeometries[i].index){const source=edgeGeometries[i];edgeGeometries[i]=source.toNonIndexed();source.dispose();}
  const edges=new THREE.BufferGeometry();
  for(const name of ['position','normal','uv','pulseRoute']){
    const size=edgeGeometries.reduce((n,g)=>n+g.attributes[name].array.length,0),array=new Float32Array(size);let offset=0;
    for(const g of edgeGeometries){array.set(g.attributes[name].array,offset);offset+=g.attributes[name].array.length;}
    edges.setAttribute(name,new THREE.BufferAttribute(array,['uv','pulseRoute'].includes(name)?2:3));
  }
  const edgeMesh=new THREE.Mesh(edges,edgeRed);edgeMesh.castShadow=shadows;edgeMesh.receiveShadow=shadows;world.add(edgeMesh);
  for(const g of edgeGeometries)g.dispose();
  const rimGeometry=new THREE.BufferGeometry();
  for(const [name,size,field]of [['position',3,'p'],['normal',3,'n'],['uv',2,'uv'],['rimUV',2,'rimUV'],['rimKey',1,'key'],['pulseRoute',2,'route']]){
    rimGeometry.setAttribute(name,new THREE.Float32BufferAttribute(rimFaces.flatMap(f=>f[field]),size));
  }
  const rimMaterial=referenceMaterial({map:materials.red.map,emissive:0xff0804,emissiveIntensity:.62,contour:1});rimMaterial.userData.kind='contour';
  world.add(new THREE.Mesh(rimGeometry,rimMaterial));
  // A deeply recessed arched back wall. The illuminated right reveal is brighter
  // than the left reveal, matching the two red planes seen in the close-ups.
  const doorShape=new THREE.Shape();doorShape.moveTo(-half,0);doorShape.lineTo(half,0);doorShape.lineTo(half,spring-sill);
  for(let i=0;i<=16;i++){const a=i*Math.PI/16;doorShape.lineTo(snap(half*Math.cos(a)),spring-sill+snap(half*Math.sin(a)));}doorShape.closePath();
  const doorMaterial=new THREE.ShaderMaterial({uniforms:{redMap:{value:materials.red.map},motionTime:{value:0},motionEnabled:{value:0},fuseTime:{value:-100}},vertexShader:portalVertex,fragmentShader:portalFragment,toneMapped:false,side:THREE.DoubleSide});doorMaterial.userData.kind='portal';
  const door=new THREE.Mesh(new THREE.ShapeGeometry(doorShape),doorMaterial);door.position.set(center,sill,back+.025);world.add(door);
  // Thin lit lining on the right interior wall; it is occluded by the real opening.
  const revealMat=referenceMaterial({color:0xbd130b,emissive:0xff1007,emissiveIntensity:.48,map:materials.red.map});revealMat.userData.kind='lining';
  function liningUV(geometry,tile=0){const a=geometry.attributes.uv;for(let n=0;n<a.count;n++)a.setXY(n,((tile%4)+.03125+a.getX(n)*.9375)/4,1-(Math.floor(tile/4)+.03125+(1-a.getY(n))*.9375)/4);return geometry;}
  const reveal=new THREE.Mesh(liningUV(new THREE.BoxGeometry(.024,spring-sill,front-back),0),revealMat);reveal.position.set(center+half-.018,(sill+spring)/2,(front+back)/2);world.add(reveal);
  for(let i=0;i<3;i++)for(let j=0;j<2;j++){
    const tile=new THREE.Mesh(liningUV(new THREE.BoxGeometry(half*2/3-.014,.045,(front-back+.4)/2-.014),2+(i+j)%5),revealMat);
    tile.position.set(center-half+(i+.5)*half*2/3,sill+.025,back+(j+.5)*(front-back+.4)/2);world.add(tile);
  }
  const nicheShape=new THREE.Shape();nicheShape.moveTo(-.14,0);nicheShape.lineTo(.14,0);nicheShape.lineTo(.14,.30);nicheShape.absarc(0,.30,.14,0,Math.PI,false);nicheShape.closePath();
  const niche=new THREE.Mesh(new THREE.ShapeGeometry(nicheShape,12),new THREE.MeshBasicMaterial({color:0x020202}));niche.position.set(left+.43,4.15,back+.02);world.add(niche);
  world.traverse(o=>{if(o.isMesh&&o.material.userData.referenceShading)prepareReferenceFaces(o);});
  const animatedMaterials=new Set();world.traverse(o=>{if(o.isMesh&&o.material.uniforms?.motionTime)animatedMaterials.add(o.material);});
  world.scale.set(...scale);
  world.userData={stoneCount,door,construction:'reference atlases with pixel wear and an extended stone rim',staircase:'L-shaped',character:false};
  return {world,applyStoneTexture(map){
    const old=new Set(),updated=new Set();
    world.traverse(o=>{
      if(!o.isMesh)return;const m=o.material;if(!m.map||updated.has(m))return;
      old.add(m.map);
      const kind=m.userData.kind;
      m.map=(['red','lining','contour'].includes(kind)?map.userData.red:kind==='edge'?map.userData.edge:map)||map;
      m.needsUpdate=true;updated.add(m);
    });
    doorMaterial.uniforms.redMap.value=map.userData.red||map;
    const retained=new Set([map,...Object.values(map.userData)]);for(const t of old)if(t&&!retained.has(t))t.dispose();return updated.size;
  },animate(time,motion=true,fuse=null){
    // fuse: seconds since the gate was lit (driven by Chip); without it the fuse cycles on its own as before.
    const lit=motion?(fuse??fusePhase(time)):-100;
    for(const m of animatedMaterials){m.uniforms.motionTime.value=motion?time:0;m.uniforms.motionEnabled.value=motion?1:0;m.uniforms.fuseTime.value=lit;}
    const pose=floatingPose(time,motion);
    world.position.set(pose.x,pose.y,0);world.rotation.z=pose.roll;
  }};
}
