import * as THREE from '../island/assets/vendor/three.module.js';

// The island's art lighting (island/reference-shading.js), made reusable for the other scenes: the same fixed key, fill and
// red back light and the same display transform, so every scene on the site is lit alike. What changes per scene is where
// its red light comes from: up to four red point lights (a gate, a glowing box, a drawing) set through `lights`.

export const MAX_LIGHTS = 4;

const vertex = `
attribute vec3 color;
attribute vec3 faceCenter;
attribute vec3 faceNormal;
varying vec2 vUv;
varying vec3 vColor;
varying vec3 vCenter;
varying vec3 vNormal;
void main(){
  vUv=uv; vColor=color;
  vCenter=(modelMatrix*vec4(faceCenter,1.)).xyz;
  vec3 n=normalMatrix*faceNormal;
  vNormal=normalize(vec3(dot(n,viewMatrix[0].xyz),dot(n,viewMatrix[1].xyz),dot(n,viewMatrix[2].xyz)));
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
}`;

const fragment = `
uniform sampler2D map;
uniform vec3 baseColor;
uniform vec3 emission;
uniform float emissionStrength;
uniform float cutout;
uniform float edgeAccent;
uniform float keyLight;
uniform vec3 lightPos[${MAX_LIGHTS}];
uniform vec4 lightCol[${MAX_LIGHTS}];   // rgb, radius
uniform float breath;
varying vec2 vUv;
varying vec3 vColor;
varying vec3 vCenter;
varying vec3 vNormal;
const vec3 redLight=vec3(1.,.002,.001);
const float pi=3.14159265359;
vec3 pointLight(vec3 c,vec3 source,vec4 col,vec3 n){
  if(col.a<=0.)return c;
  vec3 delta=source-vCenter;float d=length(delta);
  float facing=max(dot(n,delta/max(d,.01)),0.);
  float falloff=pow(max(1.-pow(d/col.a,4.),0.),2.);
  return c+c*col.rgb*(1.+breath)/pi*facing/max(d*d,.25)*falloff;
}
vec3 displayColor(vec3 c){
  c=clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.,1.);
  return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));
}
void main(){
  vec4 texel=texture2D(map,vUv);
  if(texel.a<cutout)discard;
  vec3 n=normalize(vNormal);
  float light=.14+.08*max(n.y,0.)+keyLight*4./pi*max(dot(n,normalize(vec3(-4.,10.,3.5))),0.)+.55/pi*max(dot(n,normalize(vec3(7.,5.,4.))),0.);
  vec3 c=baseColor*vColor*texel.rgb*(light+redLight/pi*max(dot(n,normalize(vec3(5.,6.,-4.))),0.));
  c+=emission*texel.rgb*(emissionStrength*(1.+breath*.6)+edgeAccent*(1.-smoothstep(.28,.85,texel.a)));
  for(int i=0;i<${MAX_LIGHTS};i++)c=pointLight(c,lightPos[i],lightCol[i],n);
  gl_FragColor=vec4(displayColor(c),1.);
}`;

// lights: shared uniform values, so one scene's lights reach every material and can be animated once per frame.
export function createLights(list = []) {
  const pos = Array.from({length: MAX_LIGHTS}, () => new THREE.Vector3());
  const col = Array.from({length: MAX_LIGHTS}, () => new THREE.Vector4(0, 0, 0, 0));
  list.slice(0, MAX_LIGHTS).forEach((l, i) => { pos[i].set(...l.at); col[i].set(...l.color, l.radius); });
  return {lightPos: {value: pos}, lightCol: {value: col}, breath: {value: 0}};
}

export function sceneMaterial({map, lights, color = 0xffffff, emissive = 0x000000, emissiveIntensity = 0, alphaTest = 0, edgeAccent = 0, keyLight = 1, side = THREE.FrontSide}) {
  const material = new THREE.ShaderMaterial({
    vertexShader: vertex, fragmentShader: fragment, toneMapped: false, side,
    uniforms: {
      map: {value: map}, baseColor: {value: new THREE.Color(color)}, emission: {value: new THREE.Color(emissive)},
      emissionStrength: {value: emissiveIntensity}, cutout: {value: alphaTest}, edgeAccent: {value: edgeAccent}, keyLight: {value: keyLight},
      lightPos: lights.lightPos, lightCol: lights.lightCol, breath: lights.breath
    }
  });
  material.alphaTest = alphaTest;
  return material;
}

// Per-face centre and normal, as the island's prepareReferenceFaces(): the lighting is evaluated per face (flat, pixel-art).
export function prepareFaces(geometry) {
  const {position, normal} = geometry.attributes;
  const centers = new Float32Array(position.count * 3), normals = new Float32Array(position.count * 3);
  const c = new THREE.Vector3(), n = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 3) {
    c.set(0, 0, 0); n.set(0, 0, 0);
    for (let j = 0; j < 3; j++) { c.add(v.fromBufferAttribute(position, i + j)); n.add(v.fromBufferAttribute(normal, i + j)); }
    c.multiplyScalar(1 / 3); n.normalize();
    for (let j = 0; j < 3; j++) { c.toArray(centers, (i + j) * 3); n.toArray(normals, (i + j) * 3); }
  }
  geometry.setAttribute('faceCenter', new THREE.BufferAttribute(centers, 3));
  geometry.setAttribute('faceNormal', new THREE.BufferAttribute(normals, 3));
  return geometry;
}
