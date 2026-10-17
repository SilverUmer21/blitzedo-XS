/*
 * When the visitor switches tabs the game pauses: the tab's title says so and its icon shows Chip asleep. Coming back,
 * Chip says hello for a moment, and the page hears `blitzedo:back` (detail.away: seconds gone), which the island's
 * keeper uses to wake Chip with a start.
 */
(function () {
  'use strict';

  var icon = document.getElementById('favicon');
  var title = document.title;
  var awake = icon ? icon.getAttribute('href') : '';
  var asleep = awake.replace('favicon-32.png', 'favicon-sleep-32.png');
  var left = 0, restore = 0;

  document.addEventListener('visibilitychange', function () {
    clearTimeout(restore);
    if (document.hidden) {
      left = Date.now();
      document.title = 'Paused · Chip is napping';
      if (icon) icon.setAttribute('href', asleep);
      return;
    }
    var away = left ? (Date.now() - left) / 1000 : 0;
    if (icon) icon.setAttribute('href', awake);
    if (away > 2) {
      document.title = 'Chip: you’re back!';
      restore = setTimeout(function () { document.title = title; }, 2200);
    } else {
      document.title = title;
    }
    document.dispatchEvent(new CustomEvent('blitzedo:back', {detail: {away: away}}));
  });
})();
