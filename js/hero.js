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

  import('../island/scene.js').catch(function (error) {
    console.warn('The live sculpture module could not load.', error);
    stage.classList.remove('is-3d-ready');
    var motion = stage.querySelector('.motion-toggle');
    if (motion) motion.hidden = true;
    if (notice) notice.hidden = false;
  });
})();
