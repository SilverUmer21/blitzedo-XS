// Seconds along the electrical route; the random-looking pixel cuts never alter
// this order. The return to the exact quiet red is intentional between cycles.
export const FUSE_CYCLE=6.5;
export function fuseRoute({x,y,z},kind='red'){
  const seed=Math.abs(Math.round(x*157+y*73+z*97))%97;
  if(kind==='stone')return [-20,seed];
  if(kind==='lining')return [y<.65?2.50+Math.abs(x-.61)*.04:2.40+y*.06,seed];
  if(kind==='red'&&y>.3&&z>.98){
    const i=Math.round((x+1.93)/.32);
    if(i>=0&&i<=7&&Math.abs(y-(3.085-i*.36))<.13&&Math.abs(z-1.46)<.42)return [2.65+(7-i)*.085,seed];
  }
  if(kind==='red'&&x<-1.5&&y>3&&y<4.3){
    const i=Math.round((z-.63)/.28);
    if(i>=0&&i<=3&&Math.abs(y-(4.165-i*.36))<.13)return [3.245+(3-i)*.09,seed];
  }
  // Perimeter and stair routes start together at the gate. Distance controls
  // travel inside each branch, rather than waiting for the staircase to finish.
  if(y<.25)return [2.65+(Math.abs(x-.61)+Math.abs(z-.65))*.10+Math.max(0,-y)*.10,seed];
  if(x<-.5&&y>4.05)return [3.15+(y-4.05)*.11+(x+2.05)*.04,seed];
  if(y>3.3)return [3.32+Math.max(0,x+.5)*.10+(4.64-y)*.04,seed];
  if(x>1.4)return [2.95+(3.3-y)*.10,seed];
  return [2.85+Math.max(0,4.05-y)*.08,seed];
}

// CPU-side values feed the logo and provide the same timing for motion tests.
export function fusePhase(time){return ((time%FUSE_CYCLE)+FUSE_CYCLE)%FUSE_CYCLE;}

export function floatingPose(time,enabled=true){
  if(!enabled)return {x:0,y:0,roll:0};
  return {x:Math.sin(time*Math.PI*2/9.8)*.018,
    y:Math.sin(time*Math.PI*2/6.6)*.105,
    roll:Math.sin(time*Math.PI*2/8.8)*.003};
}
