/* The level select (games.html): stages the visitor has already reached are marked cleared (js/transition.js keeps the
   list), the others wait to be visited, and the Arcade stays locked until the first game ships. */
(function () {
  'use strict';
  var seen = [];
  try { seen = JSON.parse(localStorage.getItem('blitzedo:stages') || '[]'); } catch (e) {}
  var tiles = document.querySelectorAll('.stage-tile[data-stage]');
  for (var i = 0; i < tiles.length; i++) {
    var cleared = seen.indexOf(tiles[i].getAttribute('data-stage')) >= 0;
    tiles[i].classList.toggle('is-cleared', cleared);
    tiles[i].querySelector('.stage-tile__state').textContent = cleared ? 'Cleared' : 'Not visited';
  }
})();
