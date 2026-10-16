// Red tuning panel, for finding the island's red by eye. Opens only with ?tune in the address, never for visitors.
// It patches the live shaders at runtime, so the approved island sources (and the loading artwork's provenance) stay
// untouched. Once a look is chosen, its values get baked into the island and the loading artwork is regenerated.

const STORE = 'blitzedo-red-tune';
const CONTROLS = [
  {key: 'master', label: 'Redness', hint: 'All the red at once', min: 0, max: 2, value: 1},
  {key: 'surface', label: 'Red stone', hint: 'Lit tops, treads and crown', min: 0, max: 2, value: 1},
  {key: 'glow', label: 'Glow', hint: 'Light the red gives off', min: 0, max: 3, value: 1},
  {key: 'wear', label: 'Edge wear', hint: 'Broken red on edges and hanging tips', min: 0, max: 2, value: 1},
  {key: 'gate', label: 'Gate', hint: 'The doorway', min: 0, max: 2, value: 1},
  {key: 'bounce', label: 'Red spill', hint: 'Red light falling on the charcoal', min: 0, max: 3, value: 1},
  {key: 'warmth', label: 'Hue', hint: 'Crimson ← → scarlet', min: -1, max: 1, value: 0, signed: true},
  {key: 'saturation', label: 'Saturation', hint: 'Grey ← → vivid', min: 0, max: 1.6, value: 1}
];
const defaults = Object.fromEntries(CONTROLS.map(c => [c.key, c.value]));

const GRADE = `
uniform float tuneBounce;
uniform float tuneWarmth;
uniform float tuneSaturation;
uniform float tuneGate;
uniform float tuneAmount;
vec3 tuneGrade(vec3 c){
  float l=dot(c,vec3(.2126,.7152,.0722));
  float redness=clamp((c.r-max(c.g,c.b))/max(c.r,.001),0.,1.);
  // Below 1 the red fades into charcoal; above 1 it runs hotter.
  c=tuneAmount<1.?mix(mix(c,vec3(l*.9+.004),redness),c,sqrt(tuneAmount)):c*(1.+(tuneAmount-1.)*redness);
  // Small linear shifts: at the ends roughly scarlet #FF2400 and crimson #DC143C.
  c+=redness*c.r*vec3(0.,max(tuneWarmth,0.)*.022,max(-tuneWarmth,0.)*.035);
  l=dot(c,vec3(.2126,.7152,.0722));
  return mix(vec3(l),c,tuneSaturation);
}
`;

function patch(material, shared) {
  let source = GRADE + material.fragmentShader;
  if (material.userData.kind === 'portal') {
    source = source.replace('gl_FragColor=vec4(clamp(c,0.,1.),1.);', 'c=tuneGrade(c*tuneGate);gl_FragColor=vec4(clamp(c,0.,1.),1.);');
  } else {
    source = source
      .replace('const vec3 redLight=vec3(1.,.002,.001);', '#define redLight (vec3(1.,.002,.001)*tuneBounce)')
      .replace('gl_FragColor=vec4(displayColor(c),1.);', 'gl_FragColor=vec4(displayColor(tuneGrade(c)),1.);');
  }
  material.fragmentShader = source;
  Object.assign(material.uniforms, shared, {tuneAmount: {value: 1}});
  material.userData.tuneBase = {emission: material.uniforms.emissionStrength?.value ?? 0};
  material.needsUpdate = true;
}

function apply(materials, shared, v) {
  const m = v.master;
  shared.tuneBounce.value = v.bounce * m;
  shared.tuneGate.value = v.gate * m;
  shared.tuneWarmth.value = v.warmth;
  shared.tuneSaturation.value = v.saturation;
  for (const material of materials) {
    const kind = material.userData.kind;
    const amount = kind === 'red' || kind === 'lining' ? v.surface * m : kind === 'edge' || kind === 'contour' ? v.wear * m : 1;
    material.uniforms.tuneAmount.value = amount;
    if (material.uniforms.emissionStrength) material.uniforms.emissionStrength.value = material.userData.tuneBase.emission * v.glow * m * Math.min(amount, 1);
  }
}

const STYLE = `
.red-tuner{position:fixed;left:16px;bottom:16px;z-index:50;width:min(320px,calc(100vw - 32px));max-height:calc(100svh - 32px);overflow:auto;
  background:rgba(9,10,8,.94);border:1px solid var(--rule);color:var(--ivory);font:500 14px/1.3 var(--font);letter-spacing:-.005em;
  backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.red-tuner__head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid var(--rule)}
.red-tuner__title{display:flex;align-items:center;gap:10px;font-weight:700;font-size:15px}
.red-tuner__title i{width:10px;height:10px;background:var(--red-hover);box-shadow:0 0 10px var(--red-hover)}
.red-tuner button{min-height:32px;padding:0 10px;background:none;border:1px solid var(--rule);color:var(--ivory);font:inherit;font-size:13px;cursor:pointer}
.red-tuner button:hover{border-color:var(--ivory-muted)}
.red-tuner__fold{border:0!important;min-width:32px;font-size:18px!important;line-height:1}
.red-tuner__body{padding:6px 14px 14px}
.red-tuner[data-folded] .red-tuner__body{display:none}
.red-tuner__row{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:9px 0;border-bottom:1px solid rgba(244,240,230,.07)}
.red-tuner__row:first-child{padding-bottom:12px;border-bottom-color:var(--rule)}
.red-tuner__row:first-child label{font-size:16px;font-weight:700}
.red-tuner__row small{grid-column:1/-1;color:var(--ivory-muted);font-size:12px;font-weight:400}
.red-tuner__row output{font-variant-numeric:tabular-nums;color:var(--ivory-muted)}
.red-tuner input[type=range]{grid-column:1/-1;width:100%;margin:4px 0 0;accent-color:var(--red-hover);height:22px}
.red-tuner__actions{display:flex;flex-wrap:wrap;gap:8px;padding-top:12px}
.red-tuner__compare{flex:1;background:var(--red)!important;border-color:var(--red)!important}
`;

export function mountTuner(world, render) {
  const materials = [];
  world.traverse(o => {
    const m = o.material;
    if (o.isMesh && m?.isShaderMaterial && m.userData.kind && !materials.includes(m)) materials.push(m);
  });
  const shared = {tuneBounce: {value: 1}, tuneWarmth: {value: 0}, tuneSaturation: {value: 1}, tuneGate: {value: 1}};
  materials.forEach(m => patch(m, shared));

  let values = {...defaults};
  try { Object.assign(values, JSON.parse(localStorage.getItem(STORE)) || {}); } catch {}

  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.append(style);
  const panel = document.createElement('section');
  panel.className = 'red-tuner';
  panel.setAttribute('aria-label', 'Island red tuning');
  panel.innerHTML = `<div class="red-tuner__head"><span class="red-tuner__title"><i></i>Island red</span>
    <button class="red-tuner__fold" type="button" aria-expanded="true" aria-label="Collapse">–</button></div>
    <div class="red-tuner__body"><div class="red-tuner__rows"></div>
    <div class="red-tuner__actions"><button class="red-tuner__compare" type="button">Hold: original</button>
    <button data-act="reset" type="button">Reset</button><button data-act="copy" type="button">Copy values</button></div></div>`;
  const rows = panel.querySelector('.red-tuner__rows');
  const format = (c, x) => c.signed ? (x === 0 ? 'neutral' : (x < 0 ? 'crimson ' : 'scarlet ') + Math.round(Math.abs(x) * 100)) : Math.round(x * 100) + '%';
  const inputs = {};
  for (const c of CONTROLS) {
    const row = document.createElement('div');
    row.className = 'red-tuner__row';
    const id = 'tune-' + c.key;
    row.innerHTML = `<label for="${id}">${c.label}</label><output for="${id}"></output><input id="${id}" type="range" min="${c.min}" max="${c.max}" step="0.01"><small>${c.hint}</small>`;
    const input = row.querySelector('input'), out = row.querySelector('output');
    input.value = values[c.key];
    out.textContent = format(c, values[c.key]);
    input.addEventListener('input', () => {
      values[c.key] = Number(input.value);
      out.textContent = format(c, values[c.key]);
      update();
    });
    inputs[c.key] = {input, out, c};
    rows.append(row);
  }
  function update(v = values) {
    apply(materials, shared, v);
    render();
    try { localStorage.setItem(STORE, JSON.stringify(values)); } catch {}
  }
  function sync() { for (const k in inputs) { inputs[k].input.value = values[k]; inputs[k].out.textContent = format(inputs[k].c, values[k]); } }

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
  update();
}
