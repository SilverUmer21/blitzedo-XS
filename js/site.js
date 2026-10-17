/*
 * Small touches on every page:
 * - switching tabs pauses the game: the tab's title says so and its icon (the pixel b) turns into Chip asleep; coming
 *   back, Chip says hello, and the page hears `blitzedo:back` (detail.away: seconds gone), which wakes the island's Chip;
 * - a page is fetched the moment a pointer or focus heads for its link, so moving between pages rarely waits;
 * - the stages a visitor has reached are remembered for the level select (games.html);
 * - a note for whoever opens the developer console.
 */
(function () {
  'use strict';

  // ---- the tab -------------------------------------------------------------------------------------------------
  var script = document.currentScript;
  var base = script ? script.src : location.href;
  var icons = [].slice.call(document.querySelectorAll('link[rel~="icon"]'));
  var awake = icons.map(function (link) { return link.getAttribute('href'); });
  var asleep = new URL('../assets/icons/favicon-sleep-32.png', base).href;
  var title = document.title;
  var left = 0, restore = 0;
  function setIcons(sleeping) {
    icons.forEach(function (link, i) {
      link.setAttribute('href', sleeping ? asleep : awake[i]);
      if (link.type) link.type = sleeping ? 'image/png' : (awake[i].slice(-4) === '.svg' ? 'image/svg+xml' : 'image/png');
    });
  }
  document.addEventListener('visibilitychange', function () {
    clearTimeout(restore);
    if (document.hidden) {
      left = Date.now();
      document.title = 'Paused · Chip is napping';
      setIcons(true);
      return;
    }
    var away = left ? (Date.now() - left) / 1000 : 0;
    setIcons(false);
    if (away > 2) {
      document.title = 'Chip: you’re back!';
      restore = setTimeout(function () { document.title = title; }, 2200);
    } else {
      document.title = title;
    }
    document.dispatchEvent(new CustomEvent('blitzedo:back', {detail: {away: away}}));
  });

  // ---- prefetch ------------------------------------------------------------------------------------------------
  var fetched = {};
  function prefetch(event) {
    var link = event.target.closest && event.target.closest('a[href]');
    if (!link) return;
    var url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname === location.pathname || fetched[url.pathname] || !/(\.html|\/)$/.test(url.pathname)) return;
    fetched[url.pathname] = true;
    var hint = document.createElement('link');
    hint.rel = 'prefetch';
    hint.href = url.pathname;
    document.head.appendChild(hint);
  }
  ['pointerover', 'touchstart', 'focusin'].forEach(function (type) { document.addEventListener(type, prefetch, {passive: true}); });

  // ---- stages reached ------------------------------------------------------------------------------------------
  try {
    var file = location.pathname.split('/').pop() || 'index.html';
    var seen = JSON.parse(localStorage.getItem('blitzedo:stages') || '[]');
    if (['index.html', 'studio.html', 'contact.html'].indexOf(file) >= 0 && seen.indexOf(file) < 0) {
      seen.push(file);
      localStorage.setItem('blitzedo:stages', JSON.stringify(seen));
    }
  } catch (e) {}

  // ---- the back door -------------------------------------------------------------------------------------------
  var sprite = new URL('../assets/chip-sprites.png', base).href;
  var onIsland = !!document.querySelector('.hero__stage');
  console.log('%c ', 'font-size: 1px; padding: 48px; background: url("' + sprite + '") -480px 0 / 1056px 96px no-repeat; image-rendering: pixelated;');
  console.log('%cYou found the back door.', 'font: 700 18px/1.4 "Inter Tight", system-ui, sans-serif; color: #E8332A;');
  console.log('%cBlitzedo is a small game studio. If reading other people’s code is your idea of fun, we should talk: ' +
    new URL('../contact.html?topic=Working%20together', base).href + ' (say Chip sent you).',
    'font: 14px/1.5 system-ui, sans-serif; color: #c9c4b8;');
  console.log('%c' + (onIsland ? 'Psst. Chip knows a code: ↑ ↑ ↓ ↓ ← → ← → B A' : 'Psst. Chip knows a code. It only works on the island.'),
    'font: 12px/1.5 ui-monospace, monospace; color: #8a857b;');
})();
