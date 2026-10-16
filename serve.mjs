// Dependency-free local server for the site (ES modules need http://, not file://).
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('./',import.meta.url));
const port=Number(process.argv[2]||process.env.PORT||8000);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.mp4':'video/mp4','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
const server=createServer(async(req,res)=>{
  try{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let path=resolve(root,'.'+pathname);
    if(path!==resolve(root)&&!path.startsWith(resolve(root)+sep)){res.writeHead(403);res.end('Forbidden');return;}
    let info=await stat(path);if(info.isDirectory()){path=join(path,'index.html');info=await stat(path);}
    if(!info.isFile()){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':mime[extname(path).toLowerCase()]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-store'});
    if(req.method==='HEAD'){res.end();return;}
    const stream=createReadStream(path);stream.on('error',()=>res.destroy());stream.pipe(res);
  }catch(error){res.writeHead(error.code==='ENOENT'?404:400);res.end(error.code==='ENOENT'?'Not found':'Bad request');}
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`blitzedo: http://localhost:${port}`));
