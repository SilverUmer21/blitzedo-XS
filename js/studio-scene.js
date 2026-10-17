// The studio page's live workbench (scenes/workshop.js), drawn with the island's materials, lighting and camera.
import { loadStoneTexture } from '../island/stone.js?v=embers-13';
import { woodAtlas } from '../scenes/kit.js';
import { buildWorkshop } from '../scenes/workshop.js';
import { runStage } from '../scenes/stage.js';

const container = document.getElementById('workshop-stage');
if (container) {
  try {
    const stoneMap = await loadStoneTexture();
    const built = buildWorkshop({maps: {stone: stoneMap, red: stoneMap.userData.red, edge: stoneMap.userData.edge, wood: woodAtlas()}, stoneMap});
    runStage({container, canvas: container.querySelector('canvas'), scene: built});
  } catch (error) {
    console.warn('The workshop scene could not start.', error);
    container.classList.add('is-failed');
  }
}
