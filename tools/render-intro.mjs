// Offline deterministic export using the exact website renderer, not browser recording.
// Requires ffmpeg and @napi-rs/canvas; the website itself has no npm dependencies.
import { createRequire } from 'node:module';
import { mkdir,writeFile } from 'node:fs/promises';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { resolve,join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createFilm } from '../motion/renderer.js';
import { createScore } from '../motion/sound.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(import.meta.url);
let graphics;
try{graphics=require('@napi-rs/canvas');}catch{
  if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)throw new Error('Install @napi-rs/canvas to render offline.');
  graphics=await import(pathToFileURL(join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'@napi-rs/canvas/index.js')).href);
}
const {createCanvas,loadImage,GlobalFonts}=graphics;
GlobalFonts.registerFromPath(join(root,'assets/fonts/inter-tight-latin-wght-normal.woff2'),'Inter Tight');
const output=resolve(process.argv[2]||join(root,'design/previews/ignition'));
const web=process.argv.includes('--web'),stills=process.argv.includes('--stills'),duration=web?7:12.8,fps=30;
await mkdir(output,{recursive:true});
const canvas=createCanvas(1920,1080),ctx=canvas.getContext('2d');
const film=await createFilm(canvas,{loadImage:src=>loadImage(join(root,src)),createCanvas});
if(stills){for(const t of [.35,2.1,3.7,5.75,6.85,8.2,8.65,10.8]){film.draw(t);await writeFile(join(output,'frame-'+t+'.png'),canvas.toBuffer('image/png'));}console.log('Rendered 8 review frames.');process.exit(0);}
const rate=48000,data=[];
createScore({sampleRate:rate,createBuffer:(channels,n)=>({duration:n/rate,getChannelData:i=>(data[i]??=new Float32Array(n))})},duration);
const wav=Buffer.alloc(44+data[0].length*4);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
for(let i=0;i<data[0].length;i++)for(let ch=0;ch<2;ch++)wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,data[ch][i]))*32767),44+i*4+ch*2);
const name='Blitzedo-Ignition-'+(web?'Website':'Studio'),wavPath=join(output,name+'.wav');await writeFile(wavPath,wav);
const ffmpeg=spawn('ffmpeg',['-y','-loglevel','error','-f','rawvideo','-pixel_format','rgba','-video_size','1920x1080','-framerate',String(fps),'-i','pipe:0','-i',wavPath,'-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart','-shortest',join(output,name+'.mp4')],{stdio:['pipe','inherit','inherit']});
let failed=false;ffmpeg.on('error',error=>{failed=true;console.error(error);});
for(let i=0;i<Math.ceil(duration*fps);i++){
  if(failed)throw new Error('ffmpeg failed');
  film.draw(i/fps/duration*12.8);
  if(!ffmpeg.stdin.write(Buffer.from(ctx.getImageData(0,0,1920,1080).data)))await once(ffmpeg.stdin,'drain');
  if(i%90===0)console.log('Rendered '+i+'/'+Math.ceil(duration*fps)+' frames');
}
ffmpeg.stdin.end();const [code]=await once(ffmpeg,'exit');if(code)throw new Error('ffmpeg exited '+code);
console.log(join(output,name+'.mp4'));
