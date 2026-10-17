import { createFilm } from './renderer.js';
import { createScore } from './sound.js';
const $=s=>document.querySelector(s),canvas=$('#film'),player=$('.player');
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),query=new URLSearchParams(location.search);
let cut=query.get('cut')==='web'?'web':'studio',duration=cut==='web'?7:12.8;
let film,playing=false,elapsed=0,origin=0,frame=0,audio,source,master,audioDestination,score;
let sound=true,recording=false,recorder,visibilityPaused=false;
const clock=t=>'00:'+String(Math.floor(t)).padStart(2,'0');
function ui(){
  $('#clock').textContent=clock(elapsed);$('#duration').textContent=clock(duration+.3);$('#seek').max=duration;$('#seek').value=elapsed;$('#seek').style.setProperty('--progress',elapsed/duration*100+'%');
  $('#play').textContent=playing?'Ⅱ':'▶';$('#play').setAttribute('aria-label',playing?'Pause intro':'Play intro');
  player.classList.toggle('playing',playing);$('.end-actions').hidden=elapsed<duration;
}
function silence(){if(source){try{source.stop();}catch{}source.disconnect();source=null;}}
async function audioStart(){
  silence();if(!sound&&!recording)return;
  audio??=new (window.AudioContext||window.webkitAudioContext)();await audio.resume();
  if(!master){master=audio.createGain();master.gain.value=.8;master.connect(audio.destination);audioDestination=audio.createMediaStreamDestination();master.connect(audioDestination);}
  if(!score||Math.abs(score.duration-duration)>.1)score=createScore(audio,duration);
  master.gain.value=sound?.8:0;
  source=audio.createBufferSource();source.buffer=score;source.connect(master);source.start(0,Math.min(elapsed,duration-.01));
}
function tick(now){
  if(!playing)return;elapsed=Math.min(duration,(now-origin)/1000);film.draw(elapsed/duration*12.8);ui();
  if(elapsed>=duration){playing=false;silence();ui();if(recording)finishRecording();else if(cut==='web'&&query.has('enter'))location.href='index.html';return;}
  frame=requestAnimationFrame(tick);
}
async function play(reset=false){
  if(!film)return;if(reset||elapsed>=duration)elapsed=0;
  $('#launch').classList.add('hidden');$('.end-actions').hidden=true;playing=true;await audioStart();origin=performance.now()-elapsed*1000;cancelAnimationFrame(frame);frame=requestAnimationFrame(tick);ui();
}
function pause(){playing=false;cancelAnimationFrame(frame);silence();ui();}
$('#launch').onclick=()=>play(true);$('#play').onclick=()=>playing?pause():play();$('#again').onclick=()=>play(true);
$('#sound').onclick=()=>{sound=!sound;$('#sound').setAttribute('aria-pressed',String(sound));$('#sound span').textContent=sound?'on':'off';if(playing)audioStart();};
$('#seek').oninput=()=>{if(recording)return;const target=Number($('#seek').value);pause();$('#launch').classList.add('hidden');elapsed=target;film.draw(elapsed/duration*12.8);ui();};
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await player.requestFullscreen();}catch{$('#status').textContent='Fullscreen is unavailable in this browser.';}};
for(const button of document.querySelectorAll('[data-cut]'))button.onclick=()=>{
  if(recording)return;pause();cut=button.dataset.cut;duration=cut==='web'?7:12.8;elapsed=0;score=null;
  for(const b of document.querySelectorAll('[data-cut]')){b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));}
  film.poster();$('#launch-label').textContent='Play '+(cut==='web'?'website':'studio')+' cut';$('#launch').classList.remove('hidden');ui();
};
document.addEventListener('keydown',event=>{if(!recording&&event.code==='Space'&&!['INPUT','BUTTON','A'].includes(event.target.tagName)){event.preventDefault();playing?pause():play();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing&&!recording){visibilityPaused=true;pause();$('#status').textContent='Paused while this tab is hidden.';}else if(!document.hidden&&visibilityPaused){visibilityPaused=false;}});
reduced.addEventListener('change',event=>{if(event.matches&&!recording){pause();elapsed=duration;film.draw(12.8);ui();$('.motion-note').hidden=false;}});
let chunks=[],recordTracks=[];
function finishRecording(){if(recorder?.state==='recording')recorder.stop();}
$('#export').onclick=async()=>{
  if(recording||!film)return;
  if(!canvas.captureStream||!window.MediaRecorder){$('#status').textContent='Video export is unavailable in this browser. The intro still plays normally.';return;}
  pause();sound=true;$('#sound').setAttribute('aria-pressed','true');$('#sound span').textContent='on';elapsed=0;
  try{
    audio??=new (window.AudioContext||window.webkitAudioContext)();await audio.resume();
    if(!master){master=audio.createGain();master.gain.value=.8;master.connect(audio.destination);audioDestination=audio.createMediaStreamDestination();master.connect(audioDestination);}
    const videoStream=canvas.captureStream(60),stream=new MediaStream([...videoStream.getVideoTracks(),...audioDestination.stream.getAudioTracks()]);
    recordTracks=videoStream.getTracks();
    const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/mp4','video/webm'].find(m=>MediaRecorder.isTypeSupported(m));
    if(!mime)throw new Error('No supported video encoder');
    chunks=[];recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:14000000});
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    recorder.onstop=()=>{const blob=new Blob(chunks,{type:mime}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='Blitzedo-Ignition-'+cut+(mime.includes('mp4')?'.mp4':'.webm');link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);recordTracks.forEach(t=>t.stop());recording=false;$('#export').disabled=false;$('#play').disabled=false;$('#seek').disabled=false;for(const b of document.querySelectorAll('[data-cut]'))b.disabled=false;$('#status').textContent='Film saved with the original sound sting.';};
    recorder.onerror=()=>{$('#status').textContent='Video recording failed. Try replaying the intro.';recording=false;recordTracks.forEach(t=>t.stop());$('#export').disabled=false;};
    recording=true;$('#export').disabled=true;$('#play').disabled=true;$('#seek').disabled=true;for(const b of document.querySelectorAll('[data-cut]'))b.disabled=true;
    $('#status').textContent='Recording the '+(cut==='web'?'website':'studio')+' cut… keep this tab open.';film.draw(0);recorder.start(200);await play(true);
  }catch(error){recording=false;$('#status').textContent='Export could not start: '+error.message;$('#export').disabled=false;}
};
try{
  film=await createFilm(canvas);await document.fonts.ready;
  for(const b of document.querySelectorAll('[data-cut]')){b.classList.toggle('selected',b.dataset.cut===cut);b.setAttribute('aria-pressed',String(b.dataset.cut===cut));}
  if(reduced.matches){elapsed=duration;film.draw(12.8);$('.motion-note').hidden=false;}else film.poster();
  $('#launch-label').textContent='Play '+(cut==='web'?'website':'studio')+' cut';for(const id of ['launch','play','export'])$('#'+id).disabled=false;
  ui();document.documentElement.dataset.film='ready';
  if(query.has('autoplay')&&!reduced.matches){sound=false;$('#sound').setAttribute('aria-pressed','false');$('#sound span').textContent='off';play(true);}
}catch(error){$('#launch-label').textContent='Artwork could not load';$('#status').textContent='Please reload to try again. '+error.message;document.documentElement.dataset.film='error';}
