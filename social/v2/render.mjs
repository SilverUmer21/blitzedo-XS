// Renders the reel frame by frame in headless Chromium (software GL, no GPU needed) and encodes it with ffmpeg.
//   node social/v2/render.mjs frames  <dir> [--workers 3] [--scale 1] [--from 0] [--to N]   PNG frames
//   node social/v2/render.mjs video   <dir> <out.mp4>                                          encode frames (silent)
//   node social/v2/render.mjs stills  <dir> t1,t2,...                                          single frames by time
// Needs playwright (global or npm i), ffmpeg, and `npm install` in social/v2 (three, gsap, postprocessing).
import {spawn, spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdirSync, existsSync, writeFileSync, readdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
let playwright;
for (const where of ['playwright', process.env.PLAYWRIGHT_PATH, '/opt/node-tools/node_modules/playwright', resolve(root, 'tools/node_modules/playwright')].filter(Boolean)) { try { playwright = require(where); break; } catch {} }
if (!playwright) throw new Error('playwright not found: npm i playwright');

const argv = process.argv.slice(2);
const mode = argv[0], dir = resolve(argv[1] || 'frames');
const opt = (name, d) => { const i = argv.indexOf('--' + name); return i >= 0 ? +argv[i + 1] : d; };
const FPS = 30;
mkdirSync(dir, {recursive: true});

if (mode === 'video') {
  const out = resolve(argv[2] || 'reel.mp4');
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${dir}/f%04d.png`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', out], {stdio: 'inherit'});
  console.log(r.status === 0 ? 'wrote ' + out : 'ffmpeg failed');
  process.exit(r.status);
}

const port = 9300 + Math.floor(Math.random() * 400);
const server = spawn('node', ['serve.mjs', String(port)], {cwd: root, stdio: 'ignore'});
await new Promise(r => setTimeout(r, 700));
const scale = opt('scale', 1);
async function open() {
  const browser = await playwright.chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
  const page = await browser.newPage({viewport: {width: 1080, height: 1920}});
  page.on('pageerror', e => { console.log('[page error]', e.message); process.exit(1); });
  await page.goto(`http://127.0.0.1:${port}/social/v2/index.html?render&scale=${scale}`);
  await page.waitForFunction(() => window.ready, null, {timeout: 180000});
  return {browser, page};
}
try {
  if (mode === 'stills') {
    const {browser, page} = await open();
    for (const t of argv[2].split(',').map(Number)) { await page.evaluate(t => window.seek(t), t); await page.screenshot({path: `${dir}/t${t.toFixed(2).padStart(5, '0')}.png`}); console.log('still', t); }
    await browser.close();
  } else if (mode === 'frames') {
    const workers = opt('workers', 3);
    const probe = await open();
    const duration = await probe.page.evaluate(() => window.DURATION);
    const events = await probe.page.evaluate(() => ({T: Object.fromEntries(Object.entries(T)), duration: window.DURATION, fps: 30}));
    await probe.browser.close();
    writeFileSync(`${dir}/timeline.json`, JSON.stringify(events, null, 1));
    const total = Math.round(duration * FPS), from = opt('from', 0), to = Math.min(total, opt('to', total));
    console.log(`${total} frames, ${workers} workers, scale ${scale}`);
    const t0 = Date.now(); let done = 0;
    await Promise.all(Array.from({length: workers}, async (_, k) => {
      const {browser, page} = await open();
      for (let n = from + k; n < to; n += workers) {
        const file = `${dir}/f${String(n).padStart(4, '0')}.png`;
        if (!existsSync(file)) { await page.evaluate(t => window.seek(t), n / FPS); await page.screenshot({path: file}); }
        if (++done % 30 === 0) console.log(`${done}/${to - from}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
      }
      await browser.close();
    }));
    console.log('frames done');
  }
} finally { server.kill(); }
