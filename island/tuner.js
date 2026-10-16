// Stair tuning panel, for finding the red of the stair treads by eye. Opens only with ?tune in the address, never for
// visitors. It patches the live red shader at runtime and touches only the twenty stair treads (picked out by their
// position in world.js; their climbing light is already baked in at 0.87); the crown, island and gate keep the approved red. The island sources and the loading artwork's
// provenance stay untouched. Once a look is chosen, its values get baked into the island and the artwork regenerated.

import * as THREE from './assets/vendor/three.module.js';

const STORE = 'blitzedo-stairs-tune';
const ATLAS_RED = '#e50d0a';   // the red texture's main colour (82% of its pixels)
const CONTROLS = [
  {key: 'brightness', label: 'Brightness', hint: 'Darker ← → hotter', min: .05, max: 2.5, value: 1, format: 'percent'},
  {key: 'hue', label: 'Hue', hint: 'Crimson ← → scarlet', min: -1, max: 1, value: 0, format: 'hue'},
  {key: 'saturation', label: 'Saturation', hint: 'Dusty ← → vivid', min: 0, max: 1.6, value: 1, format: 'percent'},
  {key: 'glow', label: 'Glow', hint: 'Light the treads give off', min: 0, max: 8, value: 1, format: 'percent'},
  {key: 'speckle', label: 'Wear', hint: 'Clean ← → the dark chips in the stone', min: 0, max: 1, value: 1, format: 'percent'},
  {key: 'edge', label: 'Lit edge', hint: 'A bright pixel lip on each step’s edge', min: 0, max: 1.5, value: 0, format: 'percent'},
  {key: 'fade', label: 'Climb', hint: 'Light falls down ← → light climbs up', min: -1, max: 1, value: 0, format: 'climb'}
];
const defaults = {...Object.fromEntries(CONTROLS.map(c => [c.key, c.value])), color: ATLAS_RED};

// Object-space test for the treads: an eight-step flight along the stem's front and four steps turning round it.
const HEADER = `
uniform float tuneBright;
uniform float tuneHue;
uniform float tuneSat;
uniform float tuneGlow;
uniform float tuneSpeckle;
uniform float tuneEdge;
uniform float tuneFade;
uniform vec3 tuneBase;
uniform float tuneAtlasRed;
varying vec3 vTunePos;
float tuneStair(vec3 p){
  if(p.y<.3||p.y>4.3)return 0.;
  bool flight=p.x>-2.35&&p.x<.52&&abs(p.z-1.46)<.42;
  bool turn=abs(p.x+1.93)<.42&&p.z>.45&&p.z<1.9;
  return flight||turn?1.:0.;
}
float tuneEdgeDist(vec3 p){
  if(abs(p.z-1.46)<.42&&p.x>-1.75){
    float i=floor((p.x+1.93)/.32+.5);
    return min(-1.93+i*.32+.174-p.x,1.84-p.z);
  }
  float i=floor((p.z-.63)/.28+.5);
  return min(.63+i*.28+.155-p.z,-1.551-p.x);
}
vec3 tuneGrade(vec3 c,vec3 p){
  float t=clamp((p.y-.6)/3.6,0.,1.);
  c*=tuneBright*(1.-max(tuneFade,0.)*t*.75-max(-tuneFade,0.)*(1.-t)*.75);
  c+=step(tuneEdgeDist(p),.045)*tuneEdge*vec3(.9,.16,.1);   // hotter than the red, so the lip reads after display clipping
  float redness=clamp((c.r-max(c.g,c.b))/max(c.r,.001),0.,1.);
  c+=redness*c.r*vec3(0.,max(tuneHue,0.)*.022,max(-tuneHue,0.)*.035);
  float l=dot(c,vec3(.2126,.7152,.0722));
  return mix(vec3(l),c,tuneSat);
}
`;
const TEXEL = 'vec4 texel=texture2D(map,atlasUV);';
const TREAD_TEXEL = `${TEXEL}
  float stair=tuneStair(vTunePos);
  if(stair>.5){
    float chip=1.-smoothstep(.08,.3,texel.r);
    texel.rgb=mix(tuneBase*(texel.r/max(tuneAtlasRed,.001)),texel.rgb,chip);
    texel.rgb=mix(texel.rgb,tuneBase,chip*(1.-tuneSpeckle));
  }`;
const DELTA = 'vec3 delta=vec3(.793,1.692,.162)-vCenter;';

function patch(material, uniforms) {
  const replace = (source, from, to) => {
    if (!source.includes(from)) throw new Error('Stair tuner: shader no longer matches ' + from);
    return source.replace(from, to);
  };
  material.vertexShader = replace(material.vertexShader, 'void main(){', 'varying vec3 vTunePos;\nvoid main(){vTunePos=position;');
  let source = HEADER + material.fragmentShader;
  source = replace(source, TEXEL, TREAD_TEXEL);
  source = replace(source, DELTA, `c+=stair*emission*texel.rgb*emissionStrength*(tuneGlow-1.);\n  ${DELTA}`);
  source = replace(source, 'gl_FragColor=vec4(displayColor(c),1.);', 'if(stair>.5)c=tuneGrade(c,vTunePos);\n  gl_FragColor=vec4(displayColor(c),1.);');
  material.fragmentShader = source;
  Object.assign(material.uniforms, uniforms);
  material.needsUpdate = true;
}

const STYLE = `
.red-tuner{position:fixed;left:16px;bottom:16px;z-index:50;width:min(300px,calc(100vw - 32px));max-height:calc(100svh - 32px);overflow:auto;
  background:rgba(9,10,8,.94);border:1px solid var(--rule);color:var(--ivory);font:500 14px/1.3 var(--font);letter-spacing:-.005em;
  backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.red-tuner__head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid var(--rule)}
.red-tuner__title{display:flex;align-items:center;gap:10px;font-weight:700;font-size:15px}
.red-tuner__title i{width:10px;height:10px;background:var(--swatch,#e50d0a);box-shadow:0 0 10px var(--swatch,#e50d0a)}
.red-tuner button{min-height:32px;padding:0 10px;background:none;border:1px solid var(--rule);color:var(--ivory);font:inherit;font-size:13px;cursor:pointer}
.red-tuner button:hover{border-color:var(--ivory-muted)}
.red-tuner__fold{border:0!important;min-width:32px;font-size:18px!important;line-height:1}
.red-tuner__body{padding:6px 14px 14px}
.red-tuner[data-folded] .red-tuner__body{display:none}
.red-tuner__row{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:9px 0;border-bottom:1px solid rgba(244,240,230,.07)}
.red-tuner__row small{grid-column:1/-1;color:var(--ivory-muted);font-size:12px;font-weight:400}
.red-tuner__row output{font-variant-numeric:tabular-nums;color:var(--ivory-muted)}
.red-tuner input[type=range]{grid-column:1/-1;width:100%;margin:4px 0 0;accent-color:var(--red-hover);height:22px}
.red-tuner input[type=color]{width:44px;height:28px;padding:0;border:1px solid var(--rule);background:none;cursor:pointer}
.red-tuner__actions{display:flex;flex-wrap:wrap;gap:8px;padding-top:12px}
.red-tuner__compare{flex:1;background:var(--red)!important;border-color:var(--red)!important}
`;

export function mountTuner(world, render) {
  let red;
  world.traverse(o => { if (o.isMesh && o.material?.userData.kind === 'red') red = o.material; });
  if (!red) return;
  const uniforms = {
    tuneBright: {value: 1}, tuneHue: {value: 0}, tuneSat: {value: 1}, tuneGlow: {value: 1}, tuneSpeckle: {value: 1},
    tuneEdge: {value: 0}, tuneFade: {value: 0}, tuneBase: {value: new THREE.Color(ATLAS_RED)},
    tuneAtlasRed: {value: new THREE.Color(ATLAS_RED).r}
  };
  patch(red, uniforms);

  let values = {...defaults};
  try { Object.assign(values, JSON.parse(localStorage.getItem(STORE)) || {}); } catch {}

  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.append(style);
  const panel = document.createElement('section');
  panel.className = 'red-tuner';
  panel.setAttribute('aria-label', 'Stair red tuning');
  panel.innerHTML = `<div class="red-tuner__head"><span class="red-tuner__title"><i></i>Stair red</span>
    <button class="red-tuner__fold" type="button" aria-expanded="true" aria-label="Collapse">–</button></div>
    <div class="red-tuner__body"><div class="red-tuner__rows">
    <div class="red-tuner__row"><label for="tune-color">Base red</label><input id="tune-color" type="color"><small>The red the treads are made of</small></div></div>
    <div class="red-tuner__actions"><button class="red-tuner__compare" type="button">Hold: original</button>
    <button data-act="reset" type="button">Reset</button><button data-act="copy" type="button">Copy values</button></div></div>`;
  const rows = panel.querySelector('.red-tuner__rows');
  const colorInput = panel.querySelector('#tune-color');
  const formats = {
    percent: x => Math.round(x * 100) + '%',
    hue: x => x === 0 ? 'neutral' : (x < 0 ? 'crimson ' : 'scarlet ') + Math.round(Math.abs(x) * 100),
    climb: x => x === 0 ? 'even' : (x < 0 ? 'falls ' : 'climbs ') + Math.round(Math.abs(x) * 100)
  };
  const inputs = {};
  for (const c of CONTROLS) {
    const row = document.createElement('div');
    row.className = 'red-tuner__row';
    const id = 'tune-' + c.key;
    row.innerHTML = `<label for="${id}">${c.label}</label><output for="${id}"></output><input id="${id}" type="range" min="${c.min}" max="${c.max}" step="0.01"><small>${c.hint}</small>`;
    const input = row.querySelector('input'), out = row.querySelector('output');
    input.addEventListener('input', () => { values[c.key] = Number(input.value); sync(); update(); });
    inputs[c.key] = {input, out, c};
    rows.append(row);
  }
  colorInput.addEventListener('input', () => { values.color = colorInput.value; sync(); update(); });

  function sync() {
    for (const k in inputs) { inputs[k].input.value = values[k]; inputs[k].out.textContent = formats[inputs[k].c.format](values[k]); }
    colorInput.value = values.color;
    panel.style.setProperty('--swatch', values.color);
  }
  function update(v = values) {
    uniforms.tuneBright.value = v.brightness;
    uniforms.tuneHue.value = v.hue;
    uniforms.tuneSat.value = v.saturation;
    uniforms.tuneGlow.value = v.glow;
    uniforms.tuneSpeckle.value = v.speckle;
    uniforms.tuneEdge.value = v.edge;
    uniforms.tuneFade.value = -v.fade;
    uniforms.tuneBase.value.set(v.color);
    render();
    try { localStorage.setItem(STORE, JSON.stringify(values)); } catch {}
  }

  const compare = panel.querySelector('.red-tuner__compare');
  const hold = on => () => update(on ? defaults : values);
  compare.addEventListener('pointerdown', hold(true));
  for (const e of ['pointerup', 'pointerleave', 'pointercancel']) compare.addEventListener(e, hold(false));
  compare.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); hold(true)(); } });
  compare.addEventListener('keyup', hold(false));
  panel.querySelector('[data-act=reset]').addEventListener('click', () => { values = {...defaults}; sync(); update(); });
  panel.querySelector('[data-act=copy]').addEventListener('click', async event => {
    const text = JSON.stringify(values);
    try { await navigator.clipboard.writeText(text); event.target.textContent = 'Copied'; }
    catch { prompt('Copy these values', text); }
    setTimeout(() => { event.target.textContent = 'Copy values'; }, 1400);
  });
  const fold = panel.querySelector('.red-tuner__fold');
  fold.addEventListener('click', () => {
    const folded = panel.toggleAttribute('data-folded');
    fold.textContent = folded ? '+' : '–';
    fold.setAttribute('aria-expanded', String(!folded));
    fold.setAttribute('aria-label', folded ? 'Expand' : 'Collapse');
  });
  document.body.append(panel);
  sync();
  update();
}
