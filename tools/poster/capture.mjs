// Serves the site and accepts one POST from tools/poster/capture.html, saving the raw 2x render.
//   node tools/poster/capture.mjs [out.png]   then open http://localhost:8001/tools/poster/capture.html
//   python tools/poster/finish.py out.png     downsamples to the poster and updates its manifest
import {createServer} from 'node:http';
import {createReadStream, createWriteStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {resolve, join, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const out = resolve(process.argv[2] || 'poster-2x.png');
const mime = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp'};
createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/__poster') {
    const file = createWriteStream(out);
    req.pipe(file);
    file.on('finish', () => { res.end(out); console.log('saved', out); setTimeout(() => process.exit(0), 100); });
    return;
  }
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!path.startsWith(resolve(root) + sep)) { res.writeHead(403); res.end(); return; }
    const info = await stat(path);
    const file = info.isDirectory() ? join(path, 'index.html') : path;
    res.writeHead(200, {'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
    createReadStream(file).pipe(res);
  } catch { res.writeHead(404); res.end(); }
}).listen(8001, '127.0.0.1', () => console.log('open http://localhost:8001/tools/poster/capture.html'));
