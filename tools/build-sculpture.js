#!/usr/bin/env node
/*
 * Renders the home sculpture (tools/sculpture3d.js, three.js) in headless Chromium
 * and writes assets/sculpture.webp plus a smaller variant for narrow screens.
 *
 *   cd tools && npm install     # three.js (and playwright, unless installed globally)
 *   node tools/build-sculpture.js
 *
 * Set CHROMIUM_PATH to use an existing Chromium binary. WebGL runs on the software
 * renderer, so no GPU is needed. The artwork has a pure black background and is shown
 * on the page with mix-blend-mode: screen.
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
  // serve tools/ over http so ES module imports work
  const root = __dirname;
  const server = http.createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  }).listen(0);
  const port = server.address().port;

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
  });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  page.on('pageerror', (e) => { console.error('page error:', e.message); process.exitCode = 1; });
  page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(`http://127.0.0.1:${port}/render.html`);
  await page.waitForFunction('window.__sculptureReady === true', null, { timeout: 280000 });
  const size = await page.evaluate('window.__sculptureSize');
  console.log('scene', JSON.stringify(await page.evaluate('window.__sculptureStats')));

  const assets = path.join(__dirname, '..', 'assets');
  fs.mkdirSync(assets, { recursive: true });
  for (const [name, width] of [['sculpture.webp', size[0]], ['sculpture-1000.webp', 1000]]) {
    const url = await page.evaluate(([w]) => {
      const src = window.__sculptureCanvas;
      const c = document.createElement('canvas');
      c.width = w; c.height = Math.round(src.height * w / src.width);
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(src, 0, 0, c.width, c.height);
      return c.toDataURL('image/webp', 0.95);
    }, [width]);
    const out = path.join(assets, name);
    fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
    console.log(`wrote ${path.relative(process.cwd(), out)} (${width}px wide, ${(fs.statSync(out).size / 1024) | 0} KB); source ${size[0]}x${size[1]}`);
  }
  await browser.close();
  server.close();
})();
