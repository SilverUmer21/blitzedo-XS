#!/usr/bin/env node
/*
 * Renders the home sculpture (tools/sculpture-render.js) in headless Chromium and
 * writes assets/sculpture.webp. Requires `playwright` (npm i -D playwright) or a
 * global install; set CHROMIUM_PATH to use an existing browser binary.
 *
 *   node tools/build-sculpture.js
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

function loadPlaywright() {
  try { return require('playwright'); } catch (e) { /* try global */ }
  const { execSync } = require('child_process');
  return require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
}

(async () => {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage();
  page.on('pageerror', (e) => { console.error('page error:', e.message); process.exitCode = 1; });
  await page.goto(pathToFileURL(path.join(__dirname, 'render.html')).href);
  await page.waitForFunction('window.__sculptureReady === true', null, { timeout: 280000 });
  const size = await page.evaluate('window.__sculptureSize');
  fs.mkdirSync(path.join(__dirname, '..', 'assets'), { recursive: true });
  // full size, plus a smaller variant for narrow screens (same artwork, downscaled)
  for (const [name, width] of [['sculpture.webp', size[0]], ['sculpture-1000.webp', 1000]]) {
    const url = await page.evaluate(([w]) => {
      const src = document.getElementById('sculpture');
      const c = document.createElement('canvas');
      c.width = w; c.height = Math.round(src.height * w / src.width);
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(src, 0, 0, c.width, c.height);
      return c.toDataURL('image/webp', 0.94);
    }, [width]);
    const out = path.join(__dirname, '..', 'assets', name);
    fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
    console.log(`wrote ${path.relative(process.cwd(), out)} (${width}px wide, ${(fs.statSync(out).size / 1024) | 0} KB); source ${size[0]}x${size[1]}`);
  }
  await browser.close();
})();
