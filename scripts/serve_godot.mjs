import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'build/web');
const port=Number(process.argv[3]||42819);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.wasm':'application/wasm','.pck':'application/octet-stream','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'};
http.createServer((req,res)=>{
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400).end();return}
  if(pathname==='/favicon.ico'){res.writeHead(204).end();return}
  // A nested-path alias exercises portal deployment without changing the export.
  pathname=pathname.replace(/^\/nested\/monarch\//,'/');
  const file=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
  fs.stat(file,(err,stat)=>{
    if(err||!stat.isFile()){res.writeHead(404).end('Not found');return}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    fs.createReadStream(file).pipe(res);
  });
}).listen(port,'127.0.0.1',()=>console.log(`Godot preview http://127.0.0.1:${port}/`));
