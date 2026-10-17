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
// off screen, in background tabs and with reduced motion. The container gets .is-3d-ready once textures have rendered.
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

  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min((now - previous) / 1000, .1);
    previous = now;
    if (document.hidden || !visible) return;
    if (!paused) elapsed += dt;
    built.animate?.(elapsed, !paused, dt);
    onFrame?.(elapsed, !paused, dt);
    root.position.y = paused ? 0 : Math.sin(elapsed * Math.PI * 2 / 6.6) * .05;
    root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, paused ? 0 : pointer.x * .08, .045);
    root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, paused ? 0 : pointer.y * .03, .045);
    render();
  }
  resize();
  container.classList.add('is-3d-ready');
  raf = requestAnimationFrame(tick);
  return {renderer, scene, camera, root, render, stop: () => cancelAnimationFrame(raf)};
}
