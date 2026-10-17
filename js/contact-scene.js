// The contact page's live mailbox (scenes/mailbox.js), drawn with the island's materials, lighting and camera.
// The stage holds its space while the textures load; if WebGL fails the page simply shows no scene.
import { loadStoneTexture } from '../island/stone.js?v=embers-13';
import { buildMailbox } from '../scenes/mailbox.js';
import { runStage } from '../scenes/stage.js';

const container = document.getElementById('mailbox-stage');
if (container) {
  try {
    const stoneMap = await loadStoneTexture();
    const built = buildMailbox({maps: {stone: stoneMap, red: stoneMap.userData.red, edge: stoneMap.userData.edge}, stoneMap});
    runStage({container, canvas: container.querySelector('canvas'), scene: built});
    document.addEventListener('contact:delivered', () => built.deliver());
    // Dev check of the delivery motion: ?deliver plays it once, without sending anything.
    if (/[?&]deliver\b/.test(location.search)) setTimeout(() => built.deliver(), 1200);
  } catch (error) {
    console.warn('The mailbox scene could not start.', error);
    container.classList.add('is-failed');
  }
}
