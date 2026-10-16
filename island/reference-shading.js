import * as THREE from './assets/vendor/three.module.js';
import { fuseRoute } from './fuse.js?v=embers-13';

// One color pipeline for the live sculpture and its initial artwork. Deliberately
// fixed art lighting keeps the reference's deep red rather than PBR orange glare.
export const masonryVertex = `
attribute vec3 color;
attribute vec3 faceCenter;
attribute vec3 faceNormal;
attribute vec2 rimUV;
attribute float rimKey;
attribute vec2 pulseRoute;
varying vec2 vUv;
varying vec3 vColor;
varying vec3 vCenter;
varying vec3 vNormal;
varying vec2 vRimUV;
varying float vRimKey;
varying vec2 vPulseRoute;
void main(){
  vUv=uv; vColor=color;vRimUV=rimUV;vRimKey=rimKey;vPulseRoute=pulseRoute;
  vCenter=(modelMatrix*vec4(faceCenter,1.)).xyz;
  vec3 n=normalMatrix*faceNormal;
  vNormal=normalize(vec3(dot(n,viewMatrix[0].xyz),dot(n,viewMatrix[1].xyz),dot(n,viewMatrix[2].xyz)));
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
}`;

export const masonryFragment = `
uniform sampler2D map;
uniform vec3 baseColor;
uniform vec3 emission;
uniform float emissionStrength;
uniform float cutout;
uniform float edgeAccent;
uniform float contour;
uniform float motionTime;
uniform float motionEnabled;
uniform float pulseEnabled;
// Seconds since the fuse was lit (Chip drops the ember into the gate); far negative while unlit.
uniform float fuseTime;
varying vec2 vUv;
varying vec3 vColor;
varying vec3 vCenter;
varying vec3 vNormal;
varying vec2 vRimUV;
varying float vRimKey;
varying vec2 vPulseRoute;
const vec3 redLight=vec3(1.,.002,.001);
const float pi=3.14159265359;
vec3 edgeLight(vec3 c,vec3 source,float power,float radius,vec3 n){
  vec3 delta=source-vCenter;float d=length(delta);
  float facing=max(dot(n,delta/max(d,.01)),0.);
  float falloff=pow(max(1.-pow(d/radius,4.),0.),2.);
  return c+c*redLight*power/pi*facing/max(d*d,.25)*falloff;
}
vec3 displayColor(vec3 c){
  c=clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.,1.);
  return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));
}
void main(){
  if(contour>.5){
    vec2 pixel=floor(clamp(vRimUV,0.,.999)*vec2(22.,14.));
    float key=mod(vRimKey,100.);
    float chip=fract(sin((floor(pixel.x/3.)+key*7.)*17.13)*437.58);
    float lip=2.+floor(chip*2.);
    float side=mod(key,2.);
    float corner=mix(pixel.x,21.-pixel.x,side);
    float width=2.+step(.45,fract(sin((floor(pixel.y/3.)+key)*13.7)*123.45));
    float depth=11.+mod(key,3.);
    bool top=vRimKey<100.&&pixel.y<lip&&chip<.91;
    bool turn=corner<width&&pixel.y<depth;
    if(!top&&!turn)discard;
  }
  vec2 atlasUV=contour>.5?(floor(vUv*256.)+.5)/256.:vUv;
  vec4 texel=texture2D(map,atlasUV);
  if(texel.a<cutout)discard;
  vec3 n=normalize(vNormal);
  float light=.14+.08*max(n.y,0.)+4./pi*max(dot(n,normalize(vec3(-4.,10.,3.5))),0.)+.55/pi*max(dot(n,normalize(vec3(7.,5.,4.))),0.);
  vec3 c=baseColor*vColor*texel.rgb*(light+redLight/pi*max(dot(n,normalize(vec3(5.,6.,-4.))),0.));
  // Edge masks come from the close-ups; emission remains inside those chipped contours.
  c+=emission*texel.rgb*(emissionStrength+edgeAccent*(1.-smoothstep(.28,.85,texel.a)));
  vec3 delta=vec3(.793,1.692,.162)-vCenter;float d=length(delta);
  if(d<3.6)c+=c*redLight*7./pi*max(dot(n,delta/max(d,.01)),0.)/max(d*d,.2);
  c=edgeLight(c,vec3(4.5,3.2,-1.),2.4,5.2,n);
  c=edgeLight(c,vec3(-.1,6.1,-1.1),.65,2.5,n);
  if(motionEnabled>.5&&pulseEnabled>.5){
    // The existing albedo and cutout are the circuit. Charcoal chips never light.
    float redMask=step(.08,texel.r)*step(texel.g*3.+.025,texel.r)*step(texel.b*3.+.025,texel.r);
    vec2 q=contour>.5?vec2(vRimUV.y,vRimUV.x):fract(vUv*4.);
    q=floor(q*22.)/22.;
    float lane=.43+.045*floor(sin(floor(q.x*11.)*2.7+vPulseRoute.y)*2.4);
    float trace=1.-smoothstep(.035,.075,abs(q.y-lane));
    if(contour>.5)trace=1.;
    float age=fuseTime-vPulseRoute.x-q.x*.10;
    float head=exp(-pow(age/.075,2.));
    float tail=step(0.,age)*exp(-max(age,0.)*4.2)*(1.-smoothstep(.75,1.35,age));
    c+=redMask*(vec3(1.4,.012,.004)*tail*.55+vec3(4.,3.3,2.8)*head*trace)*motionEnabled;
  }
  gl_FragColor=vec4(displayColor(c),1.);
}`;

export const portalVertex = `varying vec2 p;void main(){p=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
export const portalFragment = `
varying vec2 p;
uniform sampler2D redMap;
uniform float motionTime;
uniform float motionEnabled;
uniform float fuseTime;
void main(){
  vec2 uv=clamp(vec2((p.x+.7)/1.4,p.y/2.8),0.,1.);
  vec2 pixel=floor(uv*64.)/64.;
  float photographed=texture2D(redMap,vec2((.03125+pixel.x*.9375)/4.,1.-(.03125+(1.-pixel.y)*.9375)/4.)).r;
  float right=clamp((1.3*(p.x+.61)-.1),0.,1.);
  vec3 c=mix(vec3(.38,.001,.002),vec3(1.,.025,.014),right);
  c*=.82+.18*photographed;
  float phase=fuseTime;
  vec2 cell=floor(p*32.)/32.;
  float breath=sin(motionTime*.82)*.035;
  float charge=smoothstep(1.8,2.25,phase)*(1.-smoothstep(2.45,3.1,phase));
  float radius=max(0.,phase-2.12)*2.5;
  float ring=exp(-pow((length((cell-vec2(0.,1.22))*vec2(1.,.76))-radius)/.045,2.));
  float gateHead=ring*smoothstep(2.12,2.24,phase)*(1.-smoothstep(2.7,2.95,phase));
  float ripple=(sin(cell.y*8.-motionTime*1.8)-sin(cell.y*8.))*.018;
  c+=motionEnabled*(c*(breath+ripple+charge*.13)+vec3(.95,.83,.74)*gateHead);
  gl_FragColor=vec4(clamp(c,0.,1.),1.);
}`;

export function referenceMaterial({map,color=0xffffff,emissive=0x000000,emissiveIntensity=0,alphaTest=0,edgeAccent=0,contour=0,side=THREE.FrontSide}={}){
  const material=new THREE.ShaderMaterial({
    vertexShader:masonryVertex,fragmentShader:masonryFragment,toneMapped:false,side,
    uniforms:{map:{value:map},baseColor:{value:new THREE.Color(color)},emission:{value:new THREE.Color(emissive)},emissionStrength:{value:emissiveIntensity},cutout:{value:alphaTest},edgeAccent:{value:edgeAccent},contour:{value:contour},motionTime:{value:0},motionEnabled:{value:0},pulseEnabled:{value:0},fuseTime:{value:-100}}
  });
  material.color=material.uniforms.baseColor.value;
  material.emissive=material.uniforms.emission.value;
  Object.defineProperties(material,{
    map:{get(){return this.uniforms.map.value;},set(v){this.uniforms.map.value=v;}},
    emissiveIntensity:{get(){return this.uniforms.emissionStrength.value;},set(v){this.uniforms.emissionStrength.value=v;}}
  });
  material.alphaTest=alphaTest;
  material.defaultAttributeValues.rimUV=[0,0];material.defaultAttributeValues.rimKey=[0];material.defaultAttributeValues.pulseRoute=[-20,0];
  material.userData.referenceShading=true;
  return material;
}

export function prepareReferenceFaces(mesh){
  const source=mesh.geometry;
  const geometry=source.index?source.toNonIndexed():source;
  const {position,normal}=geometry.attributes;
  const centers=new Float32Array(position.count*3),normals=new Float32Array(position.count*3);
  for(let i=0;i<position.count;i+=3){
    const center=new THREE.Vector3(),n=new THREE.Vector3();
    for(let j=0;j<3;j++){
      center.add(new THREE.Vector3().fromBufferAttribute(position,i+j));
      n.add(new THREE.Vector3().fromBufferAttribute(normal,i+j));
    }
    center.multiplyScalar(1/3);n.normalize();
    for(let j=0;j<3;j++){center.toArray(centers,(i+j)*3);n.toArray(normals,(i+j)*3);}
  }
  geometry.setAttribute('faceCenter',new THREE.BufferAttribute(centers,3));
  geometry.setAttribute('faceNormal',new THREE.BufferAttribute(normals,3));
  if(!geometry.attributes.pulseRoute){
    geometry.computeBoundingBox();
    const center=geometry.boundingBox.getCenter(new THREE.Vector3()).add(mesh.position);
    const route=fuseRoute(center,mesh.material.userData.kind);
    geometry.setAttribute('pulseRoute',new THREE.Float32BufferAttribute(Array.from({length:position.count},()=>route).flat(),2));
  }
  mesh.material.uniforms.pulseEnabled.value=mesh.material.userData.kind==='stone'?0:1;
  mesh.geometry=geometry;if(geometry!==source)source.dispose();
}
