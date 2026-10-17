import * as THREE from '../island/assets/vendor/three.module.js';

// The island's camera (island/composition.js): orthographic, from the same direction, so every scene on the site is seen
// from one angle. A scene gives a target point and the height of world it should show.
export const VIEW_DIR = new THREE.Vector3(14.2, 10.4, 19).normalize();

export function sceneCamera(target, viewHeight, aspect) {
  const camera = new THREE.OrthographicCamera(-viewHeight * aspect / 2, viewHeight * aspect / 2, viewHeight / 2, -viewHeight / 2, .1, 90);
  camera.position.copy(target).addScaledVector(VIEW_DIR, 40);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  return camera;
}

export function frame(camera, viewHeight, aspect) {
  camera.left = -viewHeight * aspect / 2; camera.right = viewHeight * aspect / 2;
  camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2;
  camera.updateProjectionMatrix();
}

// Runs a scene in a page: sized to its container, a slow float and a slight lean toward the pointer (as the island), paused
// off screen, in background tabs and with reduced motion. The container gets .is-3d-ready once textures have rendered,
// and its loading picture (.scene__poster) steps aside.
export function runStage({container, canvas, scene: built, onFrame}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const compact = matchMedia('(max-width: 760px)');
  const renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: true, powerPreference: 'low-power'});
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.add(built.group);
  scene.add(root);
  const camera = sceneCamera(built.target, built.viewHeight, 1);
  let pixelRatio = Math.min(devicePixelRatio || 1, compact.matches ? 1.5 : 2);
  let visible = true, paused = reduced.matches, elapsed = 0, previous = performance.now(), raf = 0;
  const pointer = new THREE.Vector2();

  function resize() {
    const {width, height} = container.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    frame(camera, built.viewHeight, width / height);
    render();
  }
  function render() { renderer.render(scene, camera); }
  new ResizeObserver(resize).observe(container);
  new IntersectionObserver(e => { visible = e[0].isIntersecting; }, {threshold: .02}).observe(container);
  reduced.addEventListener('change', e => { paused = e.matches; });
  (built.hoverTarget || container).addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' || paused) return;
    const b = container.getBoundingClientRect();
    pointer.set(THREE.MathUtils.clamp((e.clientX - b.left) / b.width - .5, -.5, .5), THREE.MathUtils.clamp((e.clientY - b.top) / b.height - .5, -.5, .5));
  }, {passive: true});
  container.addEventListener('pointerleave', () => pointer.set(0, 0));

  // Phones draw at most 30 frames a second (the motion is slow, so it looks the same and saves battery); if the first
  // frames are slow anyway, the resolution steps down, as on the home island.
  const minGap = compact.matches ? 32 : 0;
  let last = 0, measured = 0, slow = 0;
  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (now - last < minGap) return;
    last = now;
    const dt = Math.min((now - previous) / 1000, .1);
    previous = now;
    if (document.hidden || !visible) return;
    if (!paused) elapsed += dt;
    built.animate?.(elapsed, !paused, dt);
    onFrame?.(elapsed, !paused, dt);
    // the float eases in from the loading picture's pose instead of leaving it at full speed
    const settle = Math.min(1, elapsed / 1.8), ease = settle * settle * (3 - 2 * settle);
    root.position.y = paused ? 0 : Math.sin(elapsed * Math.PI * 2 / 6.6) * .05 * ease;
    root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, paused ? 0 : pointer.x * .08, .045);
    root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, paused ? 0 : pointer.y * .03, .045);
    const t0 = performance.now();
    render();
    if (!paused && measured < 90) {
      measured++;
      if (performance.now() - t0 > 20) slow++;
      if (measured === 90 && slow > 25) { pixelRatio = Math.max(.85, pixelRatio * .7); resize(); }
    }
  }
  // the first frame is the scene's own pose at time 0, the moment its loading picture was taken (tools/scene-poster.html)
  built.animate?.(0, !paused, 0);
  resize();
  container.classList.add('is-3d-ready');
  raf = requestAnimationFrame(tick);
  return {renderer, scene, camera, root, render, stop: () => cancelAnimationFrame(raf)};
}

// Start a scene only once the page has finished its first work (load, an idle moment and the wordmark's intro) and the
// scene is within a screen of view, so the text and form are never held up by the 3D.
export function whenReady(el) {
  const near = new Promise(resolve => {
    if (!('IntersectionObserver' in window)) return resolve();
    const io = new IntersectionObserver(e => { if (e.some(x => x.isIntersecting)) { io.disconnect(); resolve(); } }, {rootMargin: '100% 0px'});
    io.observe(el);
  });
  const loaded = document.readyState === 'complete' ? Promise.resolve() : new Promise(r => addEventListener('load', r, {once: true}));
  const idle = () => new Promise(r => (window.requestIdleCallback || (f => setTimeout(f, 60)))(r, {timeout: 700}));
  // the wordmark's pixel intro is SVG, animated on the page's own thread: building a scene under it makes it stutter
  const wordmark = document.querySelector('.wordmark');
  const intro = Promise.race([
    Promise.all((wordmark?.getAnimations?.({subtree: true}) || []).filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))),
    new Promise(r => setTimeout(r, 2000))
  ]);
  return Promise.all([near, loaded.then(idle), intro]);
}
