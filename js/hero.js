/*
 * The live island (island/scene.js, a Three.js scene of fractured stone). The finished artwork image stays on screen until
 * every material has rendered, then the canvas takes over in one step. This loader also catches the module failing to
 * download or parse, not only errors inside the renderer, and shows Retry.
 */
(function () {
  'use strict';

  var stage = document.querySelector('.hero__stage');
  if (!stage) return;
  var notice = stage.querySelector('.scene-error');
  var retry = stage.querySelector('.retry-scene');
  if (retry) retry.addEventListener('click', function () { location.reload(); });

  // Building the island keeps the page busy for a moment, and the wordmark's pixel intro (SVG, animated on the same thread)
  // would stutter under it; the artwork is already on screen, so the build waits for the intro to finish (at most 2 s).
  var wordmark = document.querySelector('.wordmark');
  var intro = wordmark && wordmark.getAnimations ? wordmark.getAnimations({subtree: true}).filter(function (a) {
    return a.effect && a.effect.getComputedTiming().iterations !== Infinity;
  }).map(function (a) { return a.finished.catch(function () {}); }) : [];
  Promise.race([Promise.all(intro), new Promise(function (r) { setTimeout(r, 2000); })]).then(function () {
    return import('../island/scene.js');
  }).catch(function (error) {
    console.warn('The live sculpture module could not load.', error);
    stage.classList.remove('is-3d-ready');
    if (notice) notice.hidden = false;
  });
})();
