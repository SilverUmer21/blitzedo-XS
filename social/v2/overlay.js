// The 2D half: kinetic type over the 3D film, and the end card the flat b hands over to. One paused GSAP timeline that
// is seeked to the frame's time, so any frame can be rendered on its own. The type is the site's own: Inter Tight
// (variable, so its weight animates), ivory on near-black, red used sparingly.
import {gsap} from 'gsap';

const IVORY = '#FBF5EB', HOT = '#FF8A66', RED = '#E8332A';

function chars(el, text) {
  el.textContent = '';
  const out = [];
  for (const ch of text) { const s = document.createElement('span'); s.className = 'ch'; s.textContent = ch === ' ' ? ' ' : ch; el.appendChild(s); out.push(s); }
  return out;
}

export async function createOverlay(root, T, flat) {
  const svgText = await (await fetch(new URL('../../assets/wordmark.svg', import.meta.url))).text();
  root.innerHTML = `
    <div id="endbg"></div>
    <div class="cap" id="cap1"><span class="k"></span><span class="v"></span></div>
    <div class="cap" id="cap2"><span class="k"></span><span class="v"></span></div>
    <div class="cap" id="cap3"><span class="k"></span><span class="v"></span></div>
    <div class="label" id="lab1"><i style="background:#6FD6B8"></i><small>Orbit Shift</small><b>A tiny world<br>in motion</b></div>
    <div class="label" id="lab2"><i style="background:#E8332A"></i><small>Harvest &amp; Hearth</small><b>Light<br>the hearth</b></div>
    <div id="end">
      <div id="wm">${svgText}</div>
      <div id="rule"></div>
      <div class="head" id="h1"></div><div class="head" id="h2"></div>
      <p id="tag"><span>We build worlds we want</span><span>to get lost in.</span></p>
      <div id="btn"><span>Explore games</span><svg viewBox="0 0 44 36" width="44" height="36"><path d="M0 18H42M26 2L42 18L26 34" fill="none" stroke="#FBF5EB" stroke-width="4"/></svg></div>
      <div id="url"></div>
    </div>`;
  const $ = s => root.querySelector(s);
  const tl = gsap.timeline({paused: true});

  // ---- captions: "One pixel." / "One strike." / "One door." ----------------------------------------------------------------
  function caption(id, word, tIn, tOut, {blast = false} = {}) {
    const el = $(id), k = chars(el.querySelector('.k'), 'One '), v = chars(el.querySelector('.v'), word);
    const all = [...k, ...v];
    tl.set(el, {opacity: 1}, 0).set(all, {yPercent: 118, rotate: 5, fontVariationSettings: "'wght' 200"}, 0);
    tl.to(all, {yPercent: 0, rotate: 0, duration: .9, ease: 'expo.out', stagger: .045}, tIn);
    tl.to(k, {fontVariationSettings: "'wght' 300", duration: .9, ease: 'power2.out', stagger: .045}, tIn);
    tl.to(v, {fontVariationSettings: "'wght' 800", duration: 1.1, ease: 'power3.out', stagger: .045}, tIn);
    if (blast) {
      tl.set(el, {overflow: 'visible'}, tOut - .01);
      // the strike blows the line apart, tile by tile
      tl.to(all, {x: () => gsap.utils.random(-260, 260), y: () => gsap.utils.random(-340, 40), rotate: () => gsap.utils.random(-50, 50), opacity: 0, duration: .5, ease: 'steps(5)', stagger: {each: .012, from: 'random'}}, tOut);
    } else {
      tl.to(all, {yPercent: -118, duration: .55, ease: 'expo.in', stagger: .022}, tOut);
    }
    tl.set(el, {opacity: 0}, tOut + 1.2);
  }
  gsap.set('.cap', {opacity: 0});
  caption('#cap1', 'pixel.', .4, T.hero + .15);
  caption('#cap2', 'strike.', T.hero + .75, T.strike - .02, {blast: true});
  caption('#cap3', 'door.', T.reform + .45, T.doorDone + .5);

  // ---- world labels (the two games) -------------------------------------------------------------------------------
  function label(id, tIn, tOut) {
    const el = $(id);
    tl.set(el, {opacity: 1, clipPath: 'inset(0 100% 0 0)'}, 0);
    tl.to(el, {clipPath: 'inset(0 0% 0 0)', duration: .55, ease: 'steps(9)'}, tIn);
    tl.to(el, {clipPath: 'inset(0 0% 0 100%)', duration: .4, ease: 'steps(6)'}, tOut);
    tl.set(el, {opacity: 0}, tOut + .45);
  }
  gsap.set('.label', {opacity: 0});
  label('#lab1', T.flash + 1.05, T.w2 - .45);
  label('#lab2', T.w2 + .55, T.collapse - .15);

  // ---- end card ---------------------------------------------------------------------------------------------------------
  const tH = T.hand;
  const svg = $('#wm svg');
  const S1 = 640 / 7683, X1 = 84, Y1 = 410;
  svg.setAttribute('width', 7683 * S1); svg.setAttribute('height', 1627 * S1);
  const wmEl = $('#wm');
  const cell = (flat.x1 - flat.x0) / 7, k0 = (cell / 159.7) / S1;
  Object.assign(wmEl.style, {position: 'absolute', left: X1 + 'px', top: Y1 + 'px', transformOrigin: '0 0'});
  const startX = flat.x0 - X1, startY = (flat.y0 - 159.6 * S1 * k0) - Y1;
  gsap.set(wmEl, {x: startX, y: startY, scale: k0, opacity: 0});
  const px = [...svg.querySelectorAll('.wm-px')].map(r => { const st = r.getAttribute('style') || '', g = n => parseFloat((new RegExp('--' + n + ':(-?[\\d.]+)')).exec(st)[1]); return {r, x: +r.getAttribute('x'), d: g('d'), ox: g('x'), oy: g('y'), p: g('p')}; });
  const solid = svg.querySelector('.wm-solid'), zedo = svg.querySelector('g[transform]');
  const sparks = [...svg.querySelectorAll('.wm-spark')].map(s => { const st = s.getAttribute('style'); return {s, sx: parseFloat(/--sx:(-?[\d.]+)/.exec(st)[1]), sy: parseFloat(/--sy:(-?[\d.]+)/.exec(st)[1])}; });
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = '<clipPath id="zc"><rect id="zcr" x="3050" y="-15" width="0" height="1650"/></clipPath>';
  svg.prepend(defs); zedo.setAttribute('clip-path', 'url(#zc)');
  gsap.set(solid, {opacity: 0}); gsap.set(sparks.map(o => o.s), {opacity: 0});
  for (const p of px) gsap.set(p.r, {opacity: p.x < 1300 ? 1 : 0, fill: IVORY});
  tl.set(wmEl, {opacity: 1}, tH);
  tl.to(wmEl, {x: 0, y: 0, scale: 1, duration: .62, ease: 'power3.inOut'}, tH + .22);
  // the other letters copy in, pixel by pixel, from the corners the site's wordmark uses
  for (const p of px) if (p.x >= 1300) tl.fromTo(p.r, {opacity: 0, x: p.ox, y: p.oy}, {opacity: 1, x: 0, y: 0, duration: .5, ease: 'steps(4)'}, tH + .95 + p.d * .8 + p.p * .35);
  tl.to($('#zcr'), {attr: {width: 4800}, duration: .75, ease: 'steps(30)'}, tH + 1.25);
  tl.set(solid, {opacity: 1}, tH + 2.0);
  // a red glow runs through the pixels, as on the site
  for (const p of px) { const t0 = tH + 2.0 + p.p * .55; tl.set(p.r, {fill: HOT}, t0).set(p.r, {fill: RED}, t0 + .09).set(p.r, {fill: HOT}, t0 + .18).set(p.r, {fill: IVORY}, t0 + .28); }
  // warm sparks drift up off the letters
  sparks.forEach(({s, sx, sy}, i) => {
    tl.fromTo(s, {opacity: 1, x: 0, y: 0}, {x: sx * .6, y: sy * .55, opacity: 0, duration: 1.0, ease: 'steps(9)', immediateRender: false}, tH + 2.2 + (i % 9) * .22 + (i > 8 ? 1.2 : 0));
  });

  // rule, headline, tagline, button, address
  const ruleY = Y1 + 1627 * S1 + 30;
  Object.assign($('#rule').style, {top: ruleY + 'px'});
  tl.fromTo('#rule', {scaleX: 0, opacity: 1}, {scaleX: 1, duration: .8, ease: 'expo.out'}, tH + 1.1);
  const headTop = ruleY + 20, headSize = 262;
  for (const [id, text, tIn, idx] of [['#h1', 'Play', tH + 1.15, 0], ['#h2', 'beyond', tH + 1.32, 1]]) {
    const el = $(id); el.style.top = (headTop + idx * headSize * .86) + 'px'; el.style.fontSize = headSize + 'px';
    const cs = chars(el, text);
    tl.set(el, {opacity: 0}, 0).set(el, {opacity: 1}, tIn - .01);
    tl.set(cs, {yPercent: 175, fontVariationSettings: "'wght' 150"}, 0);
    tl.to(cs, {yPercent: 0, duration: .85, ease: 'expo.out', stagger: .04}, tIn);
    tl.to(cs, {fontVariationSettings: "'wght' 700", duration: 1.0, ease: 'power3.out', stagger: .04}, tIn);
  }
  const tagTop = headTop + 2 * headSize * .86 + 40;
  Object.assign($('#tag').style, {top: tagTop + 'px'});
  tl.fromTo('#tag span', {yPercent: 110, opacity: 0}, {yPercent: 0, opacity: 1, duration: .7, ease: 'power3.out', stagger: .1}, tH + 1.95);
  const btnTop = tagTop + 190;
  Object.assign($('#btn').style, {top: btnTop + 'px'});
  tl.fromTo('#btn', {clipPath: 'inset(0 100% 0 0)'}, {clipPath: 'inset(0 0% 0 0)', duration: .5, ease: 'steps(8)'}, tH + 2.25);
  tl.fromTo('#btn svg', {x: -16, opacity: 0}, {x: 0, opacity: 1, duration: .45, ease: 'power3.out'}, tH + 2.6);
  Object.assign($('#url').style, {top: btnTop + 116 + 38 + 'px'});
  const uc = chars($('#url'), 'blitzedo-xs.vercel.app');
  tl.set(uc, {opacity: 0}, 0).to(uc, {opacity: 1, duration: .01, stagger: .028}, tH + 2.75);
  // a press: the button answers (hover colour, arrow nudge, a small dip)
  tl.to('#btn', {backgroundColor: '#C4161B', duration: .12}, tH + 3.5).to('#btn svg', {x: 9, duration: .25, ease: 'power3.out'}, tH + 3.5);
  tl.to('#btn', {y: 5, duration: .08, yoyo: true, repeat: 1, ease: 'power2.inOut'}, tH + 3.75);

  tl.progress(1, false); tl.progress(0, false);                 // apply every starting state, so frame 0 is clean
  return {seek: t => tl.time(t, false), duration: T.hand + 4.7, tl};
}
