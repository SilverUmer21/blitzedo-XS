import * as THREE from './assets/vendor/three.module.js';

export function frameSculpture(camera,aspect){
  const vertical=13.3;
  camera.left=-vertical*aspect/2-.4;camera.right=vertical*aspect/2-.4;
  camera.top=vertical/2-.15;camera.bottom=-vertical/2-.15;
  camera.updateProjectionMatrix();
}
// The direction the island is always seen from (camera position minus its target, below). Faces turned well away from it
// are never drawn (the stone is single-sided), so world.js leaves them out.
export const VIEW_DIRECTION=new THREE.Vector3(14.2,10.4-1.65,19).normalize();
export function sculptureCamera(aspect){
  const camera=new THREE.OrthographicCamera(-5,5,6,-6,.1,90);
  camera.position.set(14.2,10.4,19);camera.lookAt(0,1.65,0);
  frameSculpture(camera,aspect);camera.updateMatrixWorld();return camera;
}
