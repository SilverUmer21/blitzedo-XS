#!/usr/bin/env node
/*
 * Renders a voxel scene other than the home sculpture (for now: the contact mailbox, tools/mailbox-vox.js) in headless
 * Chromium and writes assets/<scene>.webp (full size) and assets/<scene>-1000.webp.
 *
 *   CHROMIUM_PATH=/opt/pw-browsers/chromium SCENE=mailbox node tools/build-scene.js
 *   FRAME=flag-up ...   renders one animation state to the scratch file given by OUT instead
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

function loadPlaywright() {
  try { return require('playwright'); } catch (e) { /* try global */ }
  const { execSync } = require('child_process');
  return require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };

(async () => {
  const scene = process.env.SCENE || 'mailbox';
  const root = __dirname;
  const server = http.createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  }).listen(0);
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
  });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  page.on('pageerror', (e) => { console.error('page error:', e.message); process.exitCode = 1; });
  const frame = process.env.FRAME ? `?frame=${process.env.FRAME}` : '';
  await page.goto(`http://127.0.0.1:${server.address().port}/render-${scene}.html${frame}`, { waitUntil: 'commit' });
  await page.waitForFunction('window.__sceneReady === true', null, { timeout: 280000 });
  console.log(scene, JSON.stringify(await page.evaluate('window.__sceneStats')), JSON.stringify(await page.evaluate('window.__sceneSize')));
  const save = async (file, width) => {
    const url = await page.evaluate(([w, png]) => {
      const src = window.__sceneCanvas, c = document.createElement('canvas');
      c.width = w || src.width; c.height = Math.round(src.height * c.width / src.width);
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, c.width, c.height);
      return c.toDataURL(png ? 'image/png' : 'image/webp', 0.95);
    }, [width, /\.png$/.test(file)]);
    fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote', file);
  };
  if (process.env.OUT) await save(process.env.OUT);
  else {
    await save(path.join(root, '..', 'assets', `${scene}.webp`));
    await save(path.join(root, '..', 'assets', `${scene}-1000.webp`), 1000);
  }
  await browser.close();
  server.close();
})();
