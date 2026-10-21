// Renders the reel in headless Chromium (software GL is fine) and encodes it with ffmpeg. No GPU or paid tools needed.
//   node social/render.mjs stills 1.5,4,9.2 [outDir]     PNG stills at those times (seconds)
//   node social/render.mjs video out.mp4 [from] [to]      silent H.264 render of the whole reel (or a frame range)
// Needs playwright (npm i playwright, or a global install) and ffmpeg on the PATH. Also writes <out>.events.json, the
// moments the soundtrack is cut to (social/audio.py).
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdirSync, writeFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let playwright;
for (const where of ['playwright', process.env.PLAYWRIGHT_PATH, '/opt/node-tools/node_modules/playwright', resolve(root, 'tools/node_modules/playwright')].filter(Boolean)) {
  try { playwright = require(where); break; } catch {}
}
if (!playwright) throw new Error('playwright not found: npm i playwright');

const [mode, arg1, arg2, arg3] = process.argv.slice(2);
const port = 8765 + Math.floor(Math.random() * 200);
const server = spawn('node', ['serve.mjs', String(port)], {cwd: root, stdio: 'ignore'});
await new Promise(r => setTimeout(r, 700));
const browser = await playwright.chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync']});
const page = await browser.newPage({viewport: {width: 540, height: 960}});
page.on('pageerror', e => console.log('[page error]', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('[page]', m.text().slice(0, 300)); });
await page.goto(`http://127.0.0.1:${port}/social/reel.html?render`);
await page.waitForFunction(() => window.reelReady, null, {timeout: 180000});
const info = await page.evaluate(() => ({fps: reel.fps, duration: reel.duration, timeline: reel.timeline}));
console.log('duration', info.duration, 's', JSON.stringify(Object.fromEntries(Object.entries(info.timeline).filter(([, v]) => typeof v === 'number').map(([k, v]) => [k, +v.toFixed(2)]))));
const grab = n => page.evaluate(n => { reel.frame(n); return document.querySelector('#out').toDataURL('image/png'); }, n).then(d => Buffer.from(d.split(',')[1], 'base64'));

try {
  if (mode === 'stills') {
    const dir = resolve(arg2 || 'stills'); mkdirSync(dir, {recursive: true});
    for (const t of arg1.split(',').map(Number).sort((a, b) => a - b)) {
      const n = Math.round(t * info.fps);
      writeFileSync(`${dir}/t${t.toFixed(2).padStart(5, '0')}.png`, await grab(n));
      console.log('still', t);
    }
  } else if (mode === 'video') {
    const outFile = resolve(arg1 || 'reel.mp4');
    const total = Math.round(info.duration * info.fps), from = +(arg2 || 0), to = Math.min(total, +(arg3 || total));
    mkdirSync(dirname(outFile), {recursive: true});
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(info.fps), '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', outFile], {stdio: ['pipe', 'inherit', 'inherit']});
    const t0 = Date.now();
    for (let n = from; n < to; n++) {
      const png = await grab(n);
      if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
      if (n % 30 === 0) console.log(`frame ${n}/${to}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    writeFileSync(outFile.replace(/\.mp4$/, '') + '.events.json', JSON.stringify({fps: info.fps, duration: info.duration, timeline: info.timeline, events: await page.evaluate(() => reel.events)}, null, 1));
    console.log('wrote', outFile);
  }
} finally {
  await browser.close();
  server.kill();
}
